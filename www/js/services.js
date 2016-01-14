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
//    'name': string
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

.factory('siaCourseRetrieverFactory', function($http, $q) {
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
              tag: '<select id="valor_criterio_planestudio_PRE">'
            },
            {
              category: 'Posgrado',
              tag: '<select style="display:none" id="valor_criterio_planestudio_POS">'
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
                category: categoryTag.category
              });
            }
          }

          return majors;
        });
      },
      getCoursesByName: function(name, major) {

      },
      getGroupsForCourse: function(course) {

      }
    };
  };
});

// Course retrievers END
