var codeWithMeApp = angular.module("CodeWithMeApp", []);

codeWithMeApp.util = {};

codeWithMeApp.util.combine = function (arr1, arr2) {
  for (var i = 0; i < arr2.length; i++) {
    arr1.push(arr2[i]);
  }
};

codeWithMeApp.directive("delegateClick", ['$parse', '$rootScope', function($parse, $rootScope) {
  return {
    restrict: 'A',
    compile: function($element, attr) {
      var fn = $parse(attr.delegateClick, /* interceptorFn */ null, /* expensiveChecks */ true);
      return function ngEventHandler(scope, element) {
        element.on("click", function(event) {
          for (var key in attr) {
            if (attr.hasOwnProperty(key)) {
              var attrTest = new RegExp(attr[key].toString(), "i");
              if (event.target[key] && !attrTest.test(event.target[key].toString())) {
                return;
              }
            }
          }

          var targetScope = angular.element(event.target).scope();
          var callback = function() {
            fn(scope, {$event:event, $targetScope:targetScope});
          };
          scope.$apply(callback);
        });
      };
    }
  };
}]);

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
  $scope.getRepo = function ($event, $targetScope) {
    $scope.repo = $targetScope.repo;
    $scope.repo.files || $http.get($scope.repo.contents_url.replace(/\{.*\}/, ""))
          .success(function (data) {
            $scope.repo.files = data;
          })
          .error(function (data) {
            console.log(data);
          });
  };
});
