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

.controller('AddCourseController', function($scope, $ionicPopup, siaCourseRetrieverFactory,
  SiaApiUrl) {
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
      university.retriever.getMajors().then(function(majors) {
        $scope.majors = majors;
      }, function() {
        $ionicPopup.alert({
          title: 'Error',
          template: 'No pudimos obtener las carreras en este momento. Inténtelo de nuevo más tarde'
        });
      });
    } else {
      $scope.majors = null;
    }
    $scope.majors = university != null ? university.retriever.getMajors() : null;
  }

  $scope.$watch('data.university', function() {
    updateMajors();
  });

  updateMajors();
});
