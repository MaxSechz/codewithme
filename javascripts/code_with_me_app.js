var codeWithMeApp = angular.module("CodeWithMeApp", []);

codeWithMeApp.util = {};

codeWithMeApp.util.combine = function (arr1, arr2) {
  for (var i = 0; i < arr2.length; i++) {
    arr1.push(arr2[i]);
  }
};

codeWithMeApp.service("Session", function ($http) {
  this.repos = [];

  this.create = function (userData) {
    for (var attr in userData) {
      this[attr] = userData[attr];
    }
  };

  this.getRepos = function () {
    $http.get(this.repos_url)
         .success(function (data) {
           codeWithMeApp.util.combine(this.repos, data);
         }.bind(this))
         .error(function (data) {
            console.log(data);
         });
  };
});

codeWithMeApp.service('AuthService', function ($http, Session, $rootScope) {
  this.login = function (scope) {
    $http.get("https://api.github.com/users/" + scope.username)
         .success(function (data) {
            Session.create(data);
            Session.getRepos();
            $rootScope.hasUser = true;
         })
         .error(function (data) {
            console.log(data);
         });
  };

  this.isAuthenticated = function () {
    return !!Session.id;
  };
});

codeWithMeApp.controller("UserCtrl", function ($scope, AuthService) {
  $scope.getUser = function () {
    AuthService.login($scope);
  };
});

codeWithMeApp.controller("SidePaneCtrl", function ($scope, Session) {
  $scope.repos = Session.repos;
});

codeWithMeApp.controller("MainCtrl", function ($scope, Session, $http) {
  $scope.getRepo = function ($event) {
    $scope.repo = angular.element($event.target).scope().repo;
    $http.get($scope.repo.contents_url.replace(/\{.*\}/, ""))
          .success(function (data) {
            $scope.repo.files = data;
          })
          .error(function (data) {
            console.log(data);
          });
  };
});
