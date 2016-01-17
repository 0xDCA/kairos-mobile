Kairos Mobile
=====================

A mobile application to create schedules for Universidad Nacional de Colombia.

## Environment setup

Make sure you have ```npm``` installed. Then, ```cd``` into the project's root and run:

1. ```npm install -g bower cordova ionic gulp```
2. ```npm install```
3. ```bower install```

## Build and run

This app uses [Ionic Framework](http://ionicframework.com/), and you can build and run it just like
any other Ionic app: ```ionic run android```.

If you use the live-reloading feature (i.e ```ionic run something -l```), you will need to access
SIA's servers using the Ionic's built-in proxy, to avoid Same-Origin policy restrictions. Just
comment the default URL constants in ```app.js``` and uncomment the constants that use the proxy
(e.g comment ```.constant('SiaApiUrl', 'http://sia.bogota.unal.edu.co')``` and uncomment
```.constant('SiaApiUrl', '/external/siabogota')```).
