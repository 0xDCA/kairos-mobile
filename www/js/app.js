angular.module('kairos', ['ionic', 'kairos.controllers', 'kairos.services', 'ion-autocomplete'])

//.constant('SiaApiUrl', 'http://sia.bogota.unal.edu.co')
.constant('SiaApiUrl', '/external/siabogota')

.run(function($ionicPlatform, $window) {
  'use strict';

  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if ($window.cordova && $window.cordova.plugins.Keyboard) {
      $window.cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      $window.cordova.plugins.Keyboard.disableScroll(true);
    }

    if ($window.StatusBar) {
      // org.apache.cordova.statusbar required
      $window.StatusBar.styleDefault();
    }
  });
})

.config(function($stateProvider, $urlRouterProvider) {
  'use strict';

  $stateProvider
  .state('app', {
    url: '/app',
    abstract: true,
    templateUrl: 'templates/menu.html',
    controller: 'AppController'
  })
  .state('app.start', {
    url: '/start',
    views: {
      'menuContent': {
        templateUrl: 'templates/start.html',
        controller: 'StartController'
      }
    }
  })
  .state('app.savedSchedules', {
    url: '/saved-schedules',
    views: {
      'menuContent': {
        templateUrl: 'templates/saved-schedules.html'
      }
    }
  });

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/app/start');
});
