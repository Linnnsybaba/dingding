(function($, owner) {
	owner.serverPath = 'https://m.ddxysc.com/bizapi/'
	owner.serverAddress = owner.serverPath + 'shop/login'

	owner.login = function(loginInfo, callback) {
		callback = callback || $.noop;
		loginInfo = loginInfo || {};
		loginInfo.account = loginInfo.account || '';
		loginInfo.password = loginInfo.password || '';

		if (loginInfo.account.length < 11) {
			return callback('手机号最短为 11 个字符');
		}
		if (loginInfo.password.length < 6) {
			return callback('密码最短为 6 个字符');
		}


		var jsonData;
		var date = owner.timest()
		var hash = hex_md5("pass=" + loginInfo.password + "&timestamp=" + date + "&user=" + loginInfo.account +
			"&pPfuuq0ZeEteK2yd").toUpperCase()


		mui.ajax({
			url: owner.serverAddress,
			type: 'POST',
			data: {
				"user": loginInfo.account,
				"pass": loginInfo.password,
				"timestamp": date,
				"sign": hash
			},
			header: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			async: true,
			dataType: 'json',
			success: function(data) {
				jsonData = data
				if (jsonData.net === 2000) {
					localStorage.setItem('sess_id', jsonData.sess_id)
					localStorage.setItem('timestamp', date)
					localStorage.setItem('sign', hash)
					return owner.createState(loginInfo.account, jsonData.sess_id, callback);
				} else if (jsonData.net === 4000) {
					return callback('用户名或密码错误');
				} else {
					return callback('登陆超时！');
				}
			},
			error: function(error) {
				mui.alert('无法获取服务器数据！请确保网络畅通，或稍后重试!')
			}
		})


	};

	owner.createState = function(account, id, callback) {
		var state = owner.getState();
		state.account = account;
		state.sess_id = id
		state.token = "token123456789";
		owner.setState(state);
		return callback();
	};

	owner.timest = function() {
		var tmp = Date.parse(new Date()).toString();
		tmp = tmp.substr(0, 10);
		return tmp;
	}

	/**
	 * 获取当前状态
	 **/
	owner.getState = function() {
		var stateText = localStorage.getItem('$state') || "{}";
		return JSON.parse(stateText);
	};

	/**
	 * 设置当前状态
	 **/
	owner.setState = function(state) {
		state = state || {};
		localStorage.setItem('$state', JSON.stringify(state));
		//var settings = owner.getSettings();
		//settings.gestures = '';
		//owner.setSettings(settings);
	};


	/**
	 * 获取应用本地配置
	 **/
	owner.setSettings = function(settings) {
		settings = settings || {};
		localStorage.setItem('$settings', JSON.stringify(settings));
	}

	/**
	 * 设置应用本地配置
	 **/
	owner.getSettings = function() {
		var settingsText = localStorage.getItem('$settings') || "{}";
		return JSON.parse(settingsText);
	}
	/**
	 * 获取本地是否安装客户端
	 **/

}(mui, window.app = {}));
