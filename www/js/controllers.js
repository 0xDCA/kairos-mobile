angular.module('kairos.controllers', ['kairos.services'])

.controller('AppController', function($scope) {
  'use strict';
})

.controller('StartController', function($scope, dialogService, FirstScheduleTime, LastScheduleTime,
  ScheduleTimeStep, scheduleManager, $rootScope) {
  'use strict';

  $scope.dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  $scope.timeBlocks = [];
  for (var i = FirstScheduleTime; i <= LastScheduleTime; i += ScheduleTimeStep) {
    $scope.timeBlocks.push({
      startTime: i,
      endTime: i + ScheduleTimeStep
    });
  }

  $scope.schedule = scheduleManager.createSchedule();

  $scope.addCourse = function() {
    dialogService.fromTemplateUrl('templates/add-course.html', null, {
      schedule: $scope.schedule
    }).then(function(groupData) {
      $scope.schedule.addGroupData(groupData);
      $scope.schedule.save();
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
});
