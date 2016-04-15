'use strict';

var app = angular.module('postApp', ['ui.router', 'ngResource', 'lbServices']);
app
.config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
	$urlRouterProvider.
		otherwise("/hello");
	$stateProvider
		.state('hello', {
			url: '/hello',
			template: "Hello world!"
		})
		.state('home', {
			url: "/",
			templateUrl: "views/my.post.html",
			controller: "MyPostCtrl",
			auth: true
		})
		.state('signup', {
			url: "/sign-up",
			templateUrl: "views/reg.auth.html",
			controller: "RegAuthCtrl"
		})
		.state('login', {
			url: "/login",
			templateUrl: "views/login.auth.html",
			controller: "LoginAuthCtrl"
		})
		.state('logout', {
			url: "/logout",
			controller: "LogoutAuthCtrl",
			auth: true
		})
		.state('forbidden', {
			url: "/forbidden",
			template: "<div class='text-center'><h2>403 Access Forbidden</h2><br><p><a ui-sref='login'>Please login</a></p></div>"
		})
		.state('settings', {
			url: "/settings",
			templateUrl: "views/settings.user.html",
			controller: "SettingsUserCtrl",
			auth: true
		});
}])
.run(['$rootScope', '$state', 'Author', 'socialsService', function($rootScope, $state, User, socialsService) {
	
	socialsService.setCredentials({
		app_id: "Gu74r20E9GstEHuQU_qneaw7OVI",
		socials: {
			twitter: function(result) {
				return {
					access_token_key: result.oauth_token,
					access_token_secret: result.oauth_token_secret
				}
			},
			facebook: function(result) {
				return {
					access_token: result.access_token
				}
			},
			vk: function(result) {
				return {
					access_token: result.access_token
				}
			}
		}
	});

	if (localStorage.getItem('$LoopBack$accessTokenId')) {
		var _token = localStorage.getItem('$LoopBack$accessTokenId'),
				_userId = localStorage.getItem('$LoopBack$currentUserId');

		$rootScope.currentUser = {
			tokenId: _token,
			id: _userId
		};

		User.findById({
			id: _userId
		}, function(data) {
			$rootScope.currentUser = {
				tokenId: _token,
				id: _userId,
				email: data.email,
				userName: data.username,
				showName: data.username || data.email,
				socials: socialsService.socials()
			};
			socialsService.isConnected();
		},
		function(err) {
			if(err.data.error.code==="AUTHORIZATION_REQUIRED") {
				localStorage.setItem('$LoopBack$accessTokenId',''),
				localStorage.setItem('$LoopBack$currentUserId','');
				$rootScope.currentUser = null;
				$state.go('login');
			}
		});
	}

	$rootScope.$on('$stateChangeStart', function(event, next) {
    if (next.auth && !$rootScope.currentUser) {
      event.preventDefault();
      $state.go('forbidden');
    }
  });
}])
.factory('socialsService', ['$q', '$rootScope', 'Author', function($q, $rootScope, User) {
	var priv, pub, socials;
	priv = {
		credentials: {},
		remember: function(provider, user) {
			provider && typeof user === "object" ?
				$rootScope.currentUser.socials[provider] = user :
				!provider && typeof user === "object" ?
					$rootScope.currentUser.socials.connected = user : false;
		}
	};
	pub = {
		setCredentials: function(credentials) {
			priv.credentials = credentials;
		},
		connect: function(provider) {
			var defer = $q.defer();
			OAuth.initialize(priv.credentials.app_id);
			OAuth.popup(provider, {cache: false}, function(error, result) {
				if (!error) {
					console.log(result);
					User.connect({
		  			id: $rootScope.currentUser.id,
		  			provider: provider,
		  			params: priv.credentials.socials[provider](result)
		  		}).$promise.then(function(data) {
		  			priv.remember(provider, data.connected);
		  			defer.resolve(data);
		  		}, function(err) {
		  			alert('Ошибка записи данных');
						console.error('Error insert tokens: ', error);
		  			defer.reject(err);
		  		});
				} else {
		  		alert('Ошибка подключения '+provider);
					console.error(provider+' not connected: ', error);
					defer.reject(error);
				}
			});
			return defer.promise;
		},
		isConnected: function() {
			var defer = $q.defer();
			User.isConnected({
				id: $rootScope.currentUser.id
			}).$promise.then(function(socials) {
				priv.remember(null, socials.connected);
				defer.resolve(socials);
			}, function(err) {
				defer.reject(err);
			});
			return defer.promise;
		},
		disconnect: function(provider) {
			var defer = $q.defer();
			User.disconnect({
				id: $rootScope.currentUser.id,
				provider: provider
			}, function(res) {
				$rootScope.currentUser.socials[provider] = false;
				defer.resolve(res);
			}, function(err) {
				if(typeof err==="object" && err.data.error.message==="NOT_CONNECTED") {
					$rootScope.currentUser.socials[provider] = false;
					defer.resolve();
				} else {
					alert("Ошибка отключения " + err.config.data.provider + err);
					console.log("Ошибка отключения " + err.config.data.provider, err);
					defer.reject(err);
				}
			});
			return defer.promise;
		},
		socials: function(enabled) {
			var socials = {};
			if(!enabled)
				Object.keys(priv.credentials.socials).forEach(function(social) {
					socials[social] = false;
				});
			else if(typeof enabled==="object")
				for(var key in enabled)
					socials[key] = enabled[key];
			Object.defineProperty(socials, 'enabled', {
				enumerable: false,
				configurable: false,
				get: function() {
					return Object.keys(socials).length;
				}
			});
			Object.defineProperty(socials, 'connected', {
				enumerable: false,
				configurable: false,
				get: function() {
					var count = 0;
					for(var key in socials)
						if(socials[key])
							count++;
					return count;
				},
				set: function(newSocials) {
					for(var key in newSocials)
						socials[key] = newSocials[key];
				}
			});
			return socials;
		}
	};

	return pub;
}]);