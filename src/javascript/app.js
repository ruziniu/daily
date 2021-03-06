;(function(angular, debug) {
  'use strict';
  var log;

  if (!angular)
    throw new Error('Angular.js is required');
  if (debug)
    log = debug('tuchong-daily:app');

  angular
    .module('tuchong-daily', [
      'ionic',
      'avoscloud',
      'ngResource',
      'ngCordova'
    ])
    .constant('API_TOKEN', appConfigs.API_TOKEN)
    .constant('API_SERVER', appConfigs.API_SERVER)
    .constant('API_TOKEN_KEY', 'tuchong-daily-token')
    .constant('TC_SERVER', 'http://tuchong.com/api/')
    .config([
      '$httpProvider',
      '$stateProvider', 
      '$urlRouterProvider',
      'avoscloudProvider', 
      'API_TOKEN',
      'API_TOKEN_KEY',
      config
    ])
    .run([
      '$ionicPlatform',
      '$cordovaDevice', 
      '$cordovaNetwork',
      '$cordovaPush',
      '$timeout',
      'avoscloud',
      '$cordovaDialogs',
      '$ionicSlideBoxDelegate',
      '$rootScope',
      '$state',
      init
    ]);

  function init($ionicPlatform, $cordovaDevice, $cordovaNetwork, $cordovaPush, $timeout, avoscloud, $cordovaDialogs, $ionicSlideBoxDelegate, $rootScope, $state) {
    // Clear reading history
    if (localStorage.lastSlideIndexHome) 
      localStorage.removeItem('lastSlideIndexHome');

    // Listen to page changing event,
    // And jump to lastSlideIndex
    $rootScope.$on('$stateChangeSuccess', stateChangeSuccess);

    // When Push Received,
    // Jump to single collection page
    $rootScope.$on('pushNotificationReceived', pushNotificationReceived);

    $ionicPlatform.ready(function() {
      var device = $cordovaDevice.getDevice();
      var newtork = $cordovaNetwork.getNetwork();

      if (log) {
        log(device);
        log(newtork);
      }

      if (newtork !== 'wifi' && newtork !== 'Connection.WIFI') {
        $cordovaDialogs.alert(
          '检查到当前使用的网络不是 Wi-Fi，除非您使用 3G/4G 网络，图虫日报不建议在非 Wi-Fi 网络下加载大图', // message
          'ヾ(´ρ｀)〃 流量提示', // title,
          '继续浏览'
        );
      }

      authPushService(device, function(installation){
        if (log) log(installation);

        avoscloud
          .installations
          .post(installation, syncInstallationSuccess, syncError);

        // When sync device infomation success
        function syncInstallationSuccess(result) {
          if (log) log(result);
        }

        // Ignore the error for tmp.
        function syncError(err) {
          if (log) log(err);
        }
      });
    });

    function authPushService(device, callback) {
      var options = {
        "badge": "true",
        "sound": "true",
        "alert": "true"
      };

      $cordovaPush
        .register(options)
        .then(function(token) {
        if (log) log('Push service signup success, token: %s', token);

        var installation = {};

        installation.deviceType = device.platform ? 
          device.platform.toLowerCase() : 
          'ios';

        if (installation.deviceType === 'ios')
          installation.deviceToken = token;

        if (installation.deviceType === 'android')
          installation.installationId = token;

        angular.forEach(['model', 'uuid', 'version'], function(item){
          if (device[item])
            installation[item] = device[item];
        });

        return callback(installation);
      }, pushSignupError);

      // Ignore the error for tmp.
      function pushSignupError(err) {
        if (log) log(err);

        $cordovaDialogs.alert(
          // '(¬_¬)ﾉ 请手动在 设置 > 通知 启用推送' + err.toString(), // message
          err,
          '获取推送权限失败...', // title,
          '知道了' // button
        )
      }
    }

    function pushNotificationReceived(event, notification) {
      if (notification.collectionId) {
        $state.go('collection', {
          id: notification.collectionId
        });
        return;
      }

      $cordovaDialogs.alert(
        notification.alert, // message
        '收到通知', // title,
        '知道了' // button
      )
    }

    // When stats changes success, Go to the latest slide index
    function stateChangeSuccess(e, toState, toParams, fromState, fromParams) {
      if (log) log('%s => %s', fromState.name || 'init', toState.name);

      var isGoBackHome = toState.name === 'home' && fromState.name;
      var isGoToCollection = fromState.name === 'home' && toState.name === 'collection';
      var isBackToCollection = fromState.name === 'collection-single' && toState.name === 'collection';

      if (!isGoBackHome && !isGoToCollection && !isBackToCollection) return;
      if (isGoToCollection) return;

      var gotoIndex = isGoBackHome ?
        localStorage.lastSlideIndexHome :
        localStorage.lastSlideIndexCollection;

      if (!gotoIndex)
        gotoIndex = 0;

      gotoIndex = parseInt(gotoIndex);

      if (log) log('Going back to %s', gotoIndex);

      // Slide to last visited index.
      $timeout(function(){
        $ionicSlideBoxDelegate.slide(gotoIndex);
      }, 300);
    }
  }

  function config($httpProvider, $stateProvider, $urlRouterProvider, avoscloudProvider, API_TOKEN, API_TOKEN_KEY) {
    // Configs push service
    avoscloudProvider.config(appConfigs.avoscloud);

    // Use X-Domain to request cross domain
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
    $httpProvider.defaults.headers.common[API_TOKEN_KEY || 'tuchong-daily-token'] = API_TOKEN;

    // States Routers
    $stateProvider
      .state('home', {
        url: '/',
        templateUrl: 'templates/home.html',
        controller: 'home'
      })
      .state('collection', {
        url: '/collection/:id',
        templateUrl: 'templates/collection.html',
        controller: 'collection'
      })
      .state('collection-single', {
        url: '/images?uri',
        templateUrl: 'templates/single.html',
        controller: 'collection-single'
      })
    
    // 404 Router
    $urlRouterProvider.otherwise('/');
  }

})(window.angular, window.debug);
