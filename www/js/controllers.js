angular.module('kairos.controllers', ['kairos.services'])

.controller('AppController', function($scope) {
  'use strict';
})

.controller('StartController', function($scope, dialogService) {
  'use strict';

  $scope.addCourse = function() {
    dialogService.fromTemplateUrl('templates/add-course.html');
  };
})

.controller('AddCourseController', function($scope, $ionicPopup, $q, siaCourseRetrieverFactory,
  SiaApiUrl, stringUtils) {
  'use strict';

  $scope.universities = [
    {
      id: 1,
      name: 'Universidad Nacional de Colombia (Bogotá)',
      retriever: siaCourseRetrieverFactory(SiaApiUrl)
    }
  ];
  $scope.majors = [];

  $scope.data = {
    university: $scope.universities[0],
    major: null
  };

  function updateMajors() {
    var university = $scope.data.university;
    if (university != null) {
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
    } else {
      $scope.majors = [];
      return $q.resolve($scope.majors);
    }
  }

  $scope.$watch('data.university', function() {
    updateMajors();
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
    console.log('querying universities for ' + query);
    var result = stringUtils.normalizedSearch(query, $scope.universities, function(university) {
      return university.name;
    });

    console.log(result);
    return result;
  };
});
