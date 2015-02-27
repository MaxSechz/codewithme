var codeWithMeApp = angular.module("CodeWithMeApp", []);

codeWithMeApp.util = {};

codeWithMeApp.util.combine = function (arr1, arr2) {
  for (var i = 0; i < arr2.length; i++) {
    arr1.push(arr2[i]);
  }
};

codeWithMeApp.util.lazyIndex = function (obj, array) {
  var target = obj;
  for (var i = 0; i < array.length; i++) {
    target = target[array[i]];
  }
  return target;
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

codeWithMeApp.directive("tree", function($compile) {
    return {
        template:
          "<li class='file' ng-repeat='(key, value) in value' ng-if='value | file'" +
            "ng-init='subshow = false' ng-click='toggleSubshow(this, $event)'>" +

            "{{ key }}" +
            "<ul class='subfiles' ng-show='subshow' tree='file'" +
            "</ul>" +
          "</li>",
        compile: function(tElement, tAttr) {
            var contents = tElement.contents().remove();
            var compiledContents;
            return function(scope, iElement, iAttr) {
                if(!compiledContents) {
                    compiledContents = $compile(contents);
                }
                var result = compiledContents(scope, function(clone) {
                    return clone; });
                iElement.append(result);
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
    $scope.repo.getCommits($http, null);
  };

  $scope.openFile = function ($event, $targetScope) {
    $scope.openFiles = $scope.openFiles || [];
    !$scope.openFiles.some(function (file) {
      return file.filename == $targetScope.value.filename;
    }) && $targetScope.value.content && $scope.openFiles.push($targetScope.value);
  };

  $scope.prettify = function (line) {
    return line.replace(/^\+|^-/, '');
  };

  $scope.toggleSubshow = function ($scope, $event) {
    if (!$event.used) $scope.subshow = !$scope.subshow;
    $event.used = true;
  };
  $scope.arrayify = function (obj) {
    var arrayed = [];
    for (var i = 1; obj[i]; i++) {
      arrayed.push(obj[i]);
    }
    return arrayed;
  }
});

var repository = function (repoData) {
 for (var attr in repoData) {
   this[attr] = repoData[attr];
 }
 this.commits = [];
 this.files = {};
};

repository.prototype.getCommits = function ($http, sha) {
  var repo = this;
  var queryString = "?per_page=100&page=";
  sha = sha || '';
  repo.commits.length > 0 || $http.get(repo.commits_url.replace(/\{.*\}/, "") + queryString + sha)
        .success(function (data) {
          if (data.length === 100) {
            repo.getCommits($http, "&sha=" + data[data.length-1].sha );
          } else {
            repo.loaded = true;
          }
          for (var index = 0; index < data.length; index++) {
            var commit = data[index];
            repo.commits.push(commit);
            commit.date = new Date(commit.commit.author.date);

            (function () {
              var commitNum = repo.commits.length,
                  targetCommit = commit;

              $http.get(commit.url)
                  .success(function (data) {
                    targetCommit.files = data.files;
                    repo.addFiles(data.files);
                    if (commitNum === repo.commits.length) repo.setupHistory();
                  });
            })();
          }
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
    file.content = {};
    for (var index = 0; index < path.length; index++) {
      var directory = path[index];
      if (index === path.length - 1) {
        root[directory] = angular.extend({}, file);
      } else {
        root[directory] = root[directory] || {};
      }
      root[directory].filename = directory;
      root[directory].fileType = "file";
      root = root[directory];
    }
  });
};

repository.prototype.processCommits = function () {
  this.commits.forEach(function (commit) {
    commit.files.forEach(function (file) {
      if (!file.patch) return -1;
      file.patch = file.patch.split(/@@\s/ )
                              .filter(function (el) { return el !== "";});
      for (var i = 0; i < file.patch.length; i += 2) {
          file.patch[i] = file.patch[i].split(/\D/)
                                  .filter(function (el) { return el !== "";});
      }

      for (var j = 1; j < file.patch.length; j += 2) {
        var lines = file.patch[j].split("\n");
        var startLine = parseInt(file.patch[j-1][2]);
        if (typeof file.patch[j] !== "object") file.patch[j] = {};
        for (var line = 0; line < lines.length; line++) {
          file.patch[j][startLine + line] = lines[line];
        }
      }
    });
  });
};

repository.prototype.loadCommit = function (index) {
  var repo = this;
  this.commits[index].files.forEach(function (file) {
    if (!file.patch) return -1;
    var name = file.filename.split("/");
    var targetFile = codeWithMeApp.util.lazyIndex(repo.files, name);
    console.log(targetFile);
    for (var i = 1; i < file.patch.length; i += 2) {
      angular.extend(targetFile.content, file.patch[i]);
    }
  });
};

repository.prototype.setupHistory = function () {
  this.processCommits();
  this.sortCommits();
  this.loadCommit(0);
};

repository.prototype.sortCommits = function () {
  this.commits.sort(function (commit1, commit2) {
    if (commit1.date < commit2.date) {
      return -1;
    } else if (commit1.date > commit2.date) {
      return 1;
    } else {
      return 0;
    }
  });
};
