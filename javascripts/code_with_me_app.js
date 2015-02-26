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

codeWithMeApp.directive("recursive", function($compile) {
    return {
        restrict: "E",
        priority: 100000,
        compile: function(tElement, tAttr) {
            var contents = tElement.contents().remove();
            var compiledContents;
            return function(scope, iElement, iAttr) {
                if(!compiledContents) {
                    compiledContents = $compile(contents);
                }
                var result = compiledContents(scope,
                                 function(clone) {
                                     return clone; });
                iElement.append(result);
            };
        }
    };
});

codeWithMeApp.directive("tree", function() {
    return {
        scope: { file: '=', subshow: '=' },
        template: "<ul class='subfiles' ng-show='subshow' > <li class='file' ng-repeat='(key, value) in file' ng-if='value | file' ng-init='subshow = false' ng-click='subshow = !subshow; $event.stopPropagation()'> {{ key }} <recursive> <div tree='file' file='value' subshow='subshow'></div> </recurisve> </li> </ul>",
        compile: function() {
            return  function() {
            };
        }
    };
});

codeWithMeApp.filter('file', function() {
  return function(input) {
    var result = input && input.filename ? input : false;
    return result;
  };
});

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
  this.login = function (username, password) {
    var auth = "Basic " + window.btoa(username + ":" + password);
    $http.defaults.headers.common.Authorization = auth;
    $http.get("https://api.github.com/users/" + username)
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
    AuthService.login($scope.username, $scope.password);
  };
});

codeWithMeApp.controller("SidePaneCtrl", function ($scope, Session) {
  $scope.repos = Session.repos;
});

codeWithMeApp.controller("MainCtrl", function ($scope, Session, $http) {
  $scope.getRepo = function ($event, $targetScope) {
    $scope.repo = new repository($targetScope.repo);
    console.log($scope.repo);
    $scope.repo.getCommits(null, $http);
  };
});

var repository = function (repoData) {
 for (var attr in repoData) {
   this[attr] = repoData[attr];
 }
 this.commits = [];
 this.files = {};
};

repository.prototype.getCommits = function (page, $http) {
  var repo = this;
  var queryString = "?per_page=100&page=";
  var page = page || 0;
  repo.commits.length > 0 || $http.get(repo.commits_url.replace(/\{.*\}/, "") + queryString + page)
        .success(function (data) {
          console.log(data);
          if (data.length === 100) {
            repo.getCommits(page + 1, $http);
          }
          data.forEach(function (commit) {
            repo.commits.push(commit);
            $http.get(commit.url)
                  .success(function (data) {
                    commit.files = data.files;
                    repo.addFiles(data.files);
                  });
          });
        })
        .error(function (data) {
          console.log(data);
        });
};

repository.prototype.addFiles = function (files) {
  var repo = this;
  files.forEach(function (file) {
    var path = file.filename.split("/");
    var root = repo.files;
    for (var index = 0; index < path.length; index++) {
      var directory = path[index];
      if (index === path.length - 1) {
        root[directory] = file;
      } else {
        root[directory] = root[directory] || {};
      }
      root[directory].filename = directory;
      root[directory].fileType = "file";
      root = root[directory];
    }
  });
}
