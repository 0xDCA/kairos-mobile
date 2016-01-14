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
//    'schedules': {
//      day: [
//        {
//          startTime: number (minutes),
//          endTime: number (minutes),
//          notes: string
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
// - getGroupsByCourse: Retrieves the available groups for a given course (type Course). The result
//    is promise that resolves to an array of CourseGroup.

.factory('siaCourseRetrieverFactory', function($http, $q, MaxCourseResults) {
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
        return $http.post(apiUrl + '/buscador/JSON-RPC', {
          'method': 'buscador.obtenerAsignaturas',
          'params': [name, 'PRE', '', major.internalCategory, major.id, '', 1, MaxCourseResults]
        }).then(function(httpData) {
          if (httpData.data.error) {
            return $q.reject(httpData.data.error);
          }
          console.log(httpData);
          return httpData.data['result']['asignaturas']['list'].map(function(courseEntry) {
            return {
              credits: courseEntry['creditos'],
              id: courseEntry['codigo'],
              name: courseEntry['nombre']
            };
          });
        });
      },
      getGroupsForCourse: function(course) {

      }
    };
  };
});

// Course retrievers END
