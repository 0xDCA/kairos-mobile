angular.module('kairos.services', [])

/**
 * Provides convenience methods to wrap an Ionic dialog inside a promise.
 */
.factory('dialogService', function($q, $rootScope, $ionicModal) {
  'use strict';

  return {
    fromTemplateUrl: function(templateUrl, options, params) {
      var deferred = $q.defer();

      var newOptions = angular.extend({}, options);
      newOptions.scope = (newOptions.scope || $rootScope).$new();

      var scope = newOptions.scope;
      scope.params = params;
      var modal;

      $ionicModal.fromTemplateUrl(templateUrl, newOptions).then(function(_modal_) {
        modal = _modal_;
        modal.show();
      });

      var resolved = false, hidden = false;
      function cleanUp() {
        if (resolved) {
          return false;
        }

        resolved = true;

        if (hidden) {
          modal.remove();
        } else {
          modal.hide().then(function() {
            modal.remove();
          });
        }

        return true;
      }

      scope.$on('modal.hidden', function() {
        hidden = true;
        if (cleanUp()) {
          deferred.reject();
        }
      });

      scope.close = function(result) {
        if (cleanUp()) {
          deferred.resolve(result);
        }
      };

      scope.dismiss = function(result) {
        if (cleanUp()) {
          deferred.reject(result);
        }
      };

      return deferred.promise;
    }
  };
})

/**
 * Provides utilities to handle strings.
 */
.factory('stringUtils', function() {
  'use strict';

  var stringUtils = {
    /**
     * Returns an array of the elements that match the given substring, in case insensitive and
     * diacritic-insensitive way. This function optionally recieves an elementMapping to convert
     * between an element of elementList and a string.
     */
    normalizedSearch: function(substring, elementList, elementMapping) {
      elementMapping = elementMapping || function(element) {
        return element;
      };

      var results = [];

      for (var i = 0; i < elementList.length; ++i) {
        if (stringUtils.isNormalizedSubstring(substring, elementMapping(elementList[i]))) {
          results.push(elementList[i]);
        }
      }

      return results;
    },

    /**
     * Returns a boolean indicating if substring is contained in originalString, in a
     * case-insensitive and a diacritic-insensitive way.
     */
    isNormalizedSubstring: function(substring, originalString) {
      if (substring === '') {
        return true;
      }

      return stringUtils.normalizeString(originalString).indexOf(
        stringUtils.normalizeString(substring)) !== -1;
    },

    /**
     * Returns a normalized form of the string (to perform searches in a case-insensitive and
     * diacritic-insensitive way).
     */
    normalizeString: function(str) {
      var upperCase = str.toUpperCase();

      // This is just for Spanish. We handle it manually to keep it simple.
      var diacriticsDict = {
        'Á': 'A',
        'É': 'E',
        'Í': 'I',
        'Ó': 'O',
        'Ú': 'U'
      };

      var result = [];
      for (var i = 0; i < upperCase.length; ++i) {
        var char = upperCase.charAt(i);
        result.push(diacriticsDict[char] == null ? char : diacriticsDict[char]);
      }

      return result.join('');
    }
  };

  return stringUtils;
})

.factory('universityRepository', function(siaCourseRetrieverFactory, SiaApiUrl) {
  'use strict';

  return {
    getUniversities: function() {
      return [
        {
          id: 1,
          name: 'Universidad Nacional de Colombia (Bogotá)',
          retriever: siaCourseRetrieverFactory(SiaApiUrl)
        },
        {
          id: 2,
          name: 'Universidad Nacional de Colombia (Bogotá)',
          retriever: siaCourseRetrieverFactory(SiaApiUrl)
        }
      ];
    }
  };
})

.factory('localStorageWrapper', function($window) {
  'use strict';

  return {
    getItem: function(key) {
      return angular.fromJson($window.localStorage.getItem(key));
    },
    setItem: function(key, value) {
      $window.localStorage.setItem(key, angular.toJson(value));
    }
  };
})

.factory('scheduleManager', function(localStorageWrapper) {
  'use strict';

  function Schedule(id) {
    this._data = [];
    this.name = '';
    this.id = id;
  }

  Schedule.prototype.getGroupScheduleByTimeAndDay = function(timeInMinutes, day) {
    for (var i = 0; i < this._data.length; ++i) {
      var groupData = this._data[i];
      var group = groupData.group;

      if (group.schedules[day] == null) {
        continue;
      }

      for (var j = 0; j < group.schedules[day].length; ++j) {
        var schedule = group.schedules[day][j];
        if (schedule.startTime <= timeInMinutes &&
          timeInMinutes < schedule.endTime) {
          return {
            groupData: groupData,
            scheduleIndex: j
          };
        }
      }
    }
  };

  Schedule.prototype.getAllGroupData = function() {
    return angular.copy(this._data);
  };

  Schedule.prototype.addGroupData = function(groupData) {
    if (groupData == null) {
      throw new Error('Cannot add a null group');
    }

    if (this.getConflictsWithGroupData(groupData).length > 0) {
      throw new Error('The groupData is in conflict with the existing data');
    }

    this._data.push(groupData);
  };

  Schedule.prototype.removeGroupData = function(groupData) {
    if (groupData == null) {
      throw new Error('Cannot remove a null group');
    }

    for (var i = 0; i < this._data.length; ++i) {
      var data = this._data[i];
      if (data.group.id === groupData.group.id && data.course.id === groupData.course.id &&
        data.university.id === groupData.university.id) {
        this._data.splice(i, 1);
      }
    }
  };

  Schedule.prototype.getConflictsWithGroupData = function(newGroupData) {
    var result = [];
    for (var i = 0; i < this._data.length; ++i) {
      var groupData = this._data[i];
      var group = groupData.group;

      var isConflict = false;

      for (var day = 0; day < 7 && !isConflict; ++day) {
        if (group.schedules[day] == null || newGroupData.group.schedules[day] == null) {
          continue;
        }

        for (var j = 0; j < group.schedules[day].length && !isConflict; ++j) {
          var scheduleA = group.schedules[day][j];
          var startA = scheduleA.startTime;
          var endA = scheduleA.endTime;

          for (var k = 0; k < newGroupData.group.schedules[day].length; ++k) {
            var scheduleB = newGroupData.group.schedules[day][k];
            var startB = scheduleB.startTime;
            var endB = scheduleB.endTime;

            if (endA > startB && startA < endB) {
              isConflict = true;
              result.push(groupData);
              break;
            }
          }
        }
      }
    }

    return result;
  };

  function getSavedSchedulesMap() {
    return localStorageWrapper.getItem('savedSchedules') || {};
  }

  function saveSchedulesMap(map) {
    return localStorageWrapper.setItem('savedSchedules', map);
  }

  Schedule.prototype.save = function() {
    var map = getSavedSchedulesMap();
    var now = new Date();
    var createdAt = map[this.id] != null ? map[this.id].createdAt : now;
    map[this.id] = {
      lastModified: now,
      createdAt: createdAt,
      version: 1,
      id: this.id,
      name: this.name,
      data: this._data
    };
    saveSchedulesMap(map);
  };

  function consumeId() {
    var newId = (localStorageWrapper.getItem('scheduleSequence') || 0) + 1;
    localStorageWrapper.setItem('scheduleSequence', newId);
    return newId;
  }

  var activeSchedule;

  var scheduleManager = {
    createSchedule: function() {
      return new Schedule(consumeId());
    },
    loadSchedule: function(id) {
      var schedulesMap = getSavedSchedulesMap();
      var scheduleData = schedulesMap[id];

      if (scheduleData == null) {
        return null;
      }

      var result = new Schedule(scheduleData.id);
      result.name = scheduleData.name;
      for (var i = 0; i < scheduleData.data.length; ++i) {
        var groupData = scheduleData.data[i];
        result.addGroupData(groupData);
      }

      return result;
    },
    removeSchedule: function(id) {
      var map = getSavedSchedulesMap();
      delete map[id];
      saveSchedulesMap(map);
    },
    getSavedSchedules: function() {
      var result = [];

      angular.forEach(getSavedSchedulesMap(), function(value) {
        result.push({
          lastModified: value.lastModified,
          id: value.id,
          createdAt: value.createdAt,
          name: value.name
        });
      });

      return result;
    },
    getActiveSchedule: function() {
      if (activeSchedule == null) {
        scheduleManager.setActiveSchedule(scheduleManager.createSchedule());
      }

      return activeSchedule;
    },
    setActiveSchedule: function(schedule) {
      if (schedule == null) {
        return;
      }

      activeSchedule = schedule;
      localStorageWrapper.setItem('activeScheduleId', schedule.id);
    }
  };

  // Load schedule from last session.
  activeSchedule = scheduleManager.loadSchedule(localStorageWrapper.getItem('activeScheduleId'));

  return scheduleManager;
})

.filter('minutesToDate', function() {
  'use strict';

  return function(minutes) {
    var result = new Date();
    result.setHours(0);
    result.setMinutes(minutes);
    return result;
  };
})

// Course retrievers START
//
// Definitions:
//  Major:
//  {
//    'id': string,
//    'name': string,
//    'category': string
//  }
//
//  Course:
//  {
//    'id': string,
//    'name': string,
//    'credits': number
//  }
//
//  CourseGroup:
//  {
//    'id': string,
//    'teacher': string,
//    'availablePlaces': number,
//    'totalPlaces': number,
//    'notes': string,
//    'schedules': {
//      day: [
//        {
//          'startTime': number (minutes, inclusive),
//          'endTime': number (minutes, exclusive),
//          'place': string
//        }
//      ] (where day is a number between 0 and 6)
//    }
//  }
// Every course retriever is an object with the following methods:
// - getMajors(): Retrieves the available majors. The result must be promise that resolves to an
//    array of Major.
// - getCoursesByName(name, major): Retrieves the courses that contain the given name (string). The
//    optional parameter major (Major) can be used to further filter the results. The result is a
//    promise that resolves to an array of Course.
// - getGroupsByCourse(course, major): Retrieves the available groups for a given course (type
//    Course) and a given major. The result is a promise that resolves to an array of CourseGroup.

.factory('siaCourseRetrieverFactory', function($http, $q, stringUtils, MaxCourseResults) {
  'use strict';

  return function siaCourseRetrieverFactory(apiUrl) {
    return {
      getMajors: function() {
        return $http.get(apiUrl + '/buscador/service/action.pub').then(function(httpData) {
          var html = httpData.data;
          var deferred = $q.defer();
          var categoryTags = [
            {
              category: 'Pregrado',
              tag: '<select id="valor_criterio_planestudio_PRE">',
              internalCategory: 'PRE'
            },
            {
              category: 'Posgrado',
              tag: '<select style="display:none" id="valor_criterio_planestudio_POS">',
              internalCategory: 'POS'
            }
          ];
          var endTag = '</select>';

          var majors = [];

          for (var i = 0; i < categoryTags.length; ++i) {
            var categoryTag = categoryTags[i];
            var startIndex = html.indexOf(categoryTag.tag);

            if (startIndex === -1) {
              deferred.reject('Start tag not found for category: ' + categoryTag.category);
              return;
            }

            var endIndex = html.indexOf(endTag, startIndex + categoryTag.tag.length);
            if (endIndex === -1) {
              deferred.reject('End tag not found for category: ' + categoryTag.category);
              return;
            }

            var content = html.substring(startIndex + categoryTag.tag.length, endIndex);
            var pattern = /<option value="(\d+)">\((\d+)\) ([^<]+)<\/option>/ig;

            var match;
            while ((match = pattern.exec(content)) != null) {
              majors.push({
                id: match[1],
                name: match[3],
                category: categoryTag.category,
                internalCategory: categoryTag.internalCategory
              });
            }
          }

          return majors;
        });
      },
      getCoursesByName: function(name, major) {
        var normalizedQuery = stringUtils.normalizeString(name);
        return $http.post(apiUrl + '/buscador/JSON-RPC', {
          'method': 'buscador.obtenerAsignaturas',
          'params': [normalizedQuery, 'PRE', '', major.internalCategory, major.id, '', 1,
            MaxCourseResults]
        }).then(function(httpData) {
          if (httpData.data.error) {
            return $q.reject(httpData.data.error);
          }

          return httpData.data['result']['asignaturas']['list'].map(function(courseEntry) {
            return {
              credits: courseEntry['creditos'],
              id: courseEntry['codigo'],
              name: courseEntry['nombre']
            };
          });
        });
      },
      getGroupsByCourse: function(course, major) {
        return $http.post(apiUrl + '/buscador/JSON-RPC', {
          'method': 'buscador.obtenerGruposAsignaturas',
          'params': [course.id, '']
        }).then(function(httpData) {
          if (httpData.data.error) {
            return $q.reject(httpData.data.error);
          }

          var result = httpData.data['result']['list'];
          if (major != null) {
            // If we have a major, let's filter manually
            result = result.filter(function(groupEntry) {
              // Check major restrictions
              var restrictions = groupEntry['planlimitacion']['list'];
              var hasInclusionRestrictions = false;
              var hasExclusionRestrictions = false;
              for (var i = 0; i < restrictions.length; ++i) {
                var restriction = restrictions[i];
                var restrictionMajor = restriction['plan'];
                var majorAllowed = restriction['tipo_limitacion'] === 'A';

                hasInclusionRestrictions += majorAllowed ? 1 : 0;
                hasExclusionRestrictions += !majorAllowed ? 1 : 0;

                // Handle cases where the major is explicitly excluded or explicitly included.
                if (restrictionMajor === major.id) {
                  return majorAllowed;
                }
              }

              // If the group has exclusion restrictions, assume the major is allowed, as it was not
              // excluded.
              if (hasExclusionRestrictions) {
                return true;
              }

              // If the groups has inclusion restrictions, assume the major is not allowed, because
              // it was not explicitly included.
              if (hasInclusionRestrictions) {
                return false;
              }

              // Otherwise, there are no restrictions, so we assume the major is allowed.
              return true;
            });
          }

          return result.map(function(groupEntry) {
            var schedules = {};
            var scheduleKeys = [
              {schedule: 'horario_lunes', place: 'aula_lunes'},
              {schedule: 'horario_martes', place: 'aula_martes'},
              {schedule: 'horario_miercoles', place: 'aula_miercoles'},
              {schedule: 'horario_jueves', place: 'aula_jueves'},
              {schedule: 'horario_viernes', place: 'aula_viernes'},
              {schedule: 'horario_sabado', place: 'aula_sabado'},
              {schedule: 'horario_domingo', place: 'aula_domingo'}
            ];

            var isUnreliable = false;
            for (var i = 0; i < 7 /* days of the week */; ++i) {
              var scheduleEntry = groupEntry[scheduleKeys[i].schedule];
              var placeEntry = groupEntry[scheduleKeys[i].place];

              if (scheduleEntry === '--') {
                continue;
              }

              var daySchedulesEntry = scheduleEntry.split(' ');
              var placesEntry = placeEntry === '--' ? [] : placeEntry.split(' ');

              var zippedPlaces = [];
              var j;
              for (j = 0; j < placesEntry.length; ++j) {
                // Generate a new item only if the string length is > 2 or its the first element.
                if (j === 0 || placesEntry[j].length >= 2) {
                  zippedPlaces.push(placesEntry[j]);
                } else {
                  zippedPlaces[zippedPlaces.length - 1] += ' ' + placesEntry[j];
                }
              }

              isUnreliable = isUnreliable || zippedPlaces.length > daySchedulesEntry.length;

              var daySchedules = [];
              for (j = 0; j < daySchedulesEntry.length; ++j) {
                var times = daySchedulesEntry[j].split('-');
                var schedule = {
                  startTime: parseInt(times[0], 10) * 60,
                  endTime: parseInt(times[1], 10) * 60,
                  place: (zippedPlaces[j] === 'null' ? null : zippedPlaces[j]) || null
                };

                daySchedules.push(schedule);
              }

              schedules[i] = daySchedules;
            }

            return {
              'id': groupEntry['codigo'],
              'teacher': groupEntry['nombredocente'].trim() || null,
              'availablePlaces': groupEntry['cuposdisponibles'],
              'totalPlaces': groupEntry['cupostotal'],
              'notes': isUnreliable ? 'El aula para este horario puede tener errores' : null,
              'schedules': schedules
            };
          });
        });
      }
    };
  };
});

// Course retrievers END
