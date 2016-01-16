angular.module('kairos.services', [])

/**
 * Provides convenience methods to wrap an Ionic dialog inside a promise.
 */
.factory('dialogService', function($q, $rootScope, $ionicModal) {
  'use strict';

  return {
    fromTemplateUrl: function(templateUrl, options) {
      var deferred = $q.defer();

      var newOptions = angular.extend({}, options);
      newOptions.scope = (newOptions.scope || $rootScope).$new();

      var scope = newOptions.scope;
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
//          'startTime': number (minutes),
//          'endTime': number (minutes),
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
