angular.module('kairos.controllers', ['kairos.services'])

.controller('AppController', function($scope) {
  'use strict';
})

.controller('StartController', function($scope, dialogService, FirstScheduleTime, LastScheduleTime,
  ScheduleTimeStep, scheduleManager, $rootScope, $ionicActionSheet) {
  'use strict';

  $scope.dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  $scope.timeBlocks = [];
  for (var i = FirstScheduleTime; i <= LastScheduleTime; i += ScheduleTimeStep) {
    $scope.timeBlocks.push({
      startTime: i,
      endTime: i + ScheduleTimeStep
    });
  }

  function initSchedule() {
    $scope.schedule = scheduleManager.getActiveSchedule();
  }

  initSchedule();

  $scope.$watch(scheduleManager.getActiveSchedule, function() {
    initSchedule();
  });

  $scope.addCourse = function(toReplace) {
    if (toReplace != null) {
      // Remove the group first to avoid conflicts with other groups. It's important not to persist
      // the schedule in case of errors.
      $scope.schedule.removeGroupData(toReplace);
    }
    dialogService.fromTemplateUrl('templates/add-course.html', null, {
      schedule: $scope.schedule,
      existingGroupData: toReplace
    }).then(function(groupData) {
      $scope.schedule.addGroupData(groupData);
      $scope.schedule.save();
    }).catch(function() {
      // If the user dismissed the dialog, let's re-add the old group.
      $scope.schedule.addGroupData(toReplace);
    });
  };

  $scope.removeGroupData = function(groupData) {
    if (groupData == null) {
      return;
    }

    $scope.schedule.removeGroupData(groupData);
    $scope.schedule.save();
  };

  $scope.getGroupData = function(day, timeBlock) {
    var result = $scope.schedule.getGroupScheduleByTimeAndDay(timeBlock.startTime, day);

    return result ? result.groupData : null;
  };

  function isFirstGroupBlock(schedule, timeBlock) {
    return timeBlock.startTime - schedule.startTime < ScheduleTimeStep;
  }

  $scope.filteredDayIndexes = function(timeBlock) {
    var result = [];
    for (var i = 0; i < 7; ++i) {
      var groupSchedule = $scope.schedule.getGroupScheduleByTimeAndDay(timeBlock.startTime, i);

      if (groupSchedule == null ||
        isFirstGroupBlock(groupSchedule.groupData.group.schedules[i][groupSchedule.scheduleIndex],
          timeBlock)) {
        result.push(i);
      }
    }

    return result;
  };

  $scope.getNumberOfBlocks = function(day, timeBlock) {
    var groupSchedule = $scope.schedule.getGroupScheduleByTimeAndDay(timeBlock.startTime, day);
    if (groupSchedule == null) {
      return 1;
    }

    var schedule = groupSchedule.groupData.group.schedules[day][groupSchedule.scheduleIndex];
    return Math.ceil((schedule.endTime - schedule.startTime) / ScheduleTimeStep);
  };

  $scope.showGroupMenu = function(groupData) {
    if (groupData == null) {
      return;
    }

    $ionicActionSheet.show({
      buttons: [
        {text: '<i class="icon ion-edit"> </i> Editar'}
      ],
      destructiveText: '<i class="icon ion-trash-b"> </i> Eliminar',
      titleText: groupData.course.name,
      cancelText: 'Cancelar',
      buttonClicked: function(index) {
        $scope.addCourse(groupData);
        return true;
      },
      destructiveButtonClicked: function() {
        $scope.removeGroupData(groupData);
        return true;
      }
    });
  };
})

.controller('AddCourseController', function($scope, $ionicPopup, $q, stringUtils,
  universityRepository) {
  'use strict';

  $scope.universities = universityRepository.getUniversities();
  $scope.majors = [];
  $scope.groupConflicts = {};

  // Although we only allow one university, major and course, we use an array because
  // ion-autocomplete requires it.
  $scope.data = {
    selectedUniversities: [$scope.universities[0]],
    selectedMajors: [],
    selectedCourses: []
  };

  function updateMajors() {
    var university = $scope.data.selectedUniversities[0];
    if (university == null) {
      $scope.majors = null;
      return $q.resolve($scope.majors);
    }

    return university.retriever.getMajors().then(function(majors) {
      $scope.majors = majors;
      return majors;
    }, function(reason) {
      $scope.majors = null;
      $ionicPopup.alert({
        title: 'Error',
        template: 'No pudimos obtener las carreras en este momento. Inténtalo de nuevo más tarde'
      });

      return $q.reject(reason);
    });
  }

  function updateGroups() {
    var university = $scope.data.selectedUniversities[0];
    var major = $scope.data.selectedMajors[0];
    var course = $scope.data.selectedCourses[0];

    if (university == null || major == null || course == null) {
      $scope.groups = null;
      return $q.resolve($scope.groups);
    }

    return university.retriever.getGroupsByCourse(course, major).then(function(groups) {
      $scope.groups = groups;
      return groups;
    }, function(reason) {
      $scope.groups = null;
      $ionicPopup.alert({
        title: 'Error',
        template: 'No pudimos obtener los grupos en este momento. Inténtalo de nuevo más tarde'
      });

      return $q.reject(reason);
    });
  }

  function getGroupData(group) {
    var course = $scope.data.selectedCourses[0];
    var major = $scope.data.selectedMajors[0];
    var university = $scope.data.selectedUniversities[0];
    return {
      group: group,
      course: course,
      major: major,
      university: university
    };
  }

  function updateGroupConflicts() {
    $scope.groupConflicts = {};
    var groups = $scope.groups || [];
    var schedule = $scope.params.schedule;

    for (var i = 0; i < groups.length; ++i) {
      $scope.groupConflicts[groups[i].id] =
        schedule.getConflictsWithGroupData(getGroupData(groups[i]));
    }
  }

  $scope.$watchCollection('data.selectedUniversities', function() {
    updateMajors();
    updateGroups();
  });

  $scope.$watchCollection('data.selectedMajors', function() {
    updateGroups();
  });

  $scope.$watchCollection('data.selectedCourses', function() {
    updateGroups();
  });

  $scope.$watch('groups', function() {
    updateGroupConflicts();
  });

  $scope.queryMajors = function(query, isInitializing) {
    var promise = $scope.majors == null ? updateMajors() : $q.resolve($scope.majors);

    return promise.then(function(majors) {
      return stringUtils.normalizedSearch(query, majors, function(major) {
        return major.name;
      });
    });
  };

  $scope.queryUniversities = function(query, isInitializing) {
    return stringUtils.normalizedSearch(query, $scope.universities, function(university) {
      return university.name;
    });
  };

  $scope.queryCourses = function(query, isInitializing) {
    var university = $scope.data.selectedUniversities[0];
    var major = $scope.data.selectedMajors[0];

    if (university == null || major == null) {
      return [];
    }

    var retriever = university.retriever;
    return retriever.getCoursesByName(query, major).catch(function(reason) {
      $ionicPopup.alert({
        title: 'Error',
        template: 'No pudimos obtener los cursos en este momento. Inténtalo de nuevo más tarde'
      });

      return $q.reject(reason);
    });
  };

  $scope.dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  $scope.hasMoreScheduleDays = function(group, day) {
    for (var i = day + 1; i < 7; ++i) {
      if (group.schedules[i] != null && group.schedules[i].length > 0) {
        return true;
      }
    }

    return false;
  };

  $scope.selectGroup = function(group) {
    if ($scope.groupConflicts[group.id].length) {
      return;
    }

    $scope.close(getGroupData(group));
  };
})

.controller('SavedSchedulesController', function($scope, scheduleManager, $ionicActionSheet,
  $ionicPopup, $rootScope) {
  'use strict';

  $scope.data = {
    activeScheduleId: null
  };

  function updateActiveSchedule() {
    var activeSchedule = scheduleManager.getActiveSchedule();
    $scope.data.activeScheduleId = activeSchedule == null ? null : activeSchedule.id;
  }

  $scope.$watch(scheduleManager.getActiveSchedule, function() {
    updateActiveSchedule();
  });

  $scope.$watch(function() {
    return $scope.data.activeScheduleId;
  }, function() {
    scheduleManager.setActiveSchedule(scheduleManager.loadSchedule($scope.data.activeScheduleId));
  });

  $scope.savedSchedules = [];

  function updateSavedSchedules() {
    $scope.savedSchedules = scheduleManager.getSavedSchedules();
  }

  $scope.$on('$ionicView.enter', function() {
    updateSavedSchedules();
  });

  $scope.createSchedule = function() {
    var schedule = scheduleManager.createSchedule();
    schedule.save();
    scheduleManager.setActiveSchedule(schedule);
    updateSavedSchedules();
  };

  $scope.showScheduleMenu = function(scheduleData) {
    if (scheduleData == null) {
      return;
    }

    $ionicActionSheet.show({
      buttons: [
        {text: '<i class="icon ion-edit"> </i> Cambiar nombre'}
      ],
      destructiveText: '<i class="icon ion-trash-b"> </i> Eliminar',
      titleText: scheduleData.name || 'Horario sin nombre',
      buttonClicked: function(index) {
        var newScope = $rootScope.$new();
        newScope.data = {
          name: scheduleData.name || ''
        };
        $ionicPopup.show({
          template: '<input type="text" ng-model="data.name">',
          scope: newScope,
          title: 'Introduzca el nombre para el horario',
          buttons: [
            {text: 'Cancelar'},
            {
              text: 'Guardar',
              type: 'button-positive',
              onTap: function(e) {
                var schedule = scheduleManager.loadSchedule(scheduleData.id);
                schedule.name = newScope.data.name;
                schedule.save();
                updateSavedSchedules();
              }
            }
          ]
        });
        return true;
      },
      destructiveButtonClicked: function() {
        scheduleManager.removeSchedule(scheduleData.id);

        var newActive = null;
        angular.forEach(scheduleManager.getSavedSchedules(), function(value) {
          if (newActive == null ||
            (new Date(value.lastModified)).getTime() >
              (new Date(newActive.lastModified)).getTime()) {
            newActive = value;
          }
        });

        scheduleManager.setActiveSchedule(newActive != null ?
          scheduleManager.loadSchedule(newActive.id) : scheduleManager.createSchedule());
        updateSavedSchedules();
        return true;
      }
    });
  };
});
