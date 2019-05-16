mui.init();
var viewApi = mui('#app').view({
	defaultPage: '#setting'
});
mui('.mui-scroll-wrapper').scroll();
document.getElementById("reBootBlueTooth").addEventListener('tap', function() {
	var bluetoothTool = BluetoothTool();
	bluetoothTool.disConnDevice();
	bluetoothTool.turnOffBluetooth();
	setTimeout(function() {
		bluetoothTool.turnOnBluetooth();
		localStorage.setItem('sheetAlert', true);
		mui.back();
	}, 2500);
});
document.getElementById("checkUpdate").addEventListener('tap', function() {
	var apkVer = null;
	var checkUrl = 'http://update.ddxysc.com/sht/version.txt';
	var wgtUrl = 'http://update.ddxysc.com/sht/dingding.apk';

	function plusReady() {
		plus.runtime.getProperty(plus.runtime.appid, function(inf) {
			apkVer = inf.version;
			mui.toast("当前应用版本：" + apkVer);
		});
	}
	if (window.plus) {
		plusReady();
		checkUpdate();
	} else {
		document.addEventListener('plusready', plusReady, false);
	}

	function checkUpdate() {
		plus.nativeUI.showWaiting("正在检测版本更新");
		setTimeout(function() {
			mui.ajax(checkUrl, {
				type: 'get',
				timeout: 2000,
				success: function(data) {
					plus.nativeUI.closeWaiting();
					console.log("检测更新成功! 最新版本:" + data);
					console.log("当前版本:" + apkVer);
					var newVer = data;
					if (apkVer && newVer && (apkVer != newVer)) {
						downApk();
					} else {
						plus.nativeUI.alert("已是最新版本！");
					}
				},
				error: function(data) {
					plus.nativeUI.closeWaiting();
					console.log("检测更新失败！请检查网络连接状态");
					plus.nativeUI.alert("检测更新失败！\n请检查网络连接状态");
				}
			});
		}, 1000);
	}

	function downApk() {
		plus.nativeUI.showWaiting("下载apk文件...");
		plus.downloader.createDownload(wgtUrl, {
			filename: "_doc/update/"
		}, function(d, status) {
			if (status == 200) {
				console.log("下载apk成功：" + d.filename);
				installApk(d.filename);
			} else {
				console.log("下载apk失败！");
				plus.nativeUI.alert("下载apk失败！");
			}
			plus.nativeUI.closeWaiting();
		}).start();
	}

	function installApk(path) {
		plus.nativeUI.showWaiting("安装apk文件...");
		plus.runtime.install(path, {}, function() {
			plus.nativeUI.closeWaiting();
			console.log("安装apk文件成功！");
			plus.nativeUI.alert("应用资源更新完成！", function() {
				plus.runtime.restart();
			});
		}, function(e) {
			plus.nativeUI.closeWaiting();
			console.log("安装apk文件失败[" + e.code + "]：" + e.message);
			plus.nativeUI.alert("安装apk文件失败[" + e.code + "]：" + e.message);
		});
	}
});
document.getElementById('exit').addEventListener('tap', function() {
	if (mui.os.ios) {
		app.setState({});
		mui.openWindow({
			url: 'login.html',
			id: 'login',
			show: {
				aniShow: 'pop-in'
			},
			waiting: {
				autoShow: false
			}
		});
		return;
	}
	var btnArray = [{
		title: "注销当前账号"
	}, {
		title: "直接关闭应用"
	}];
	plus.nativeUI.actionSheet({
		cancel: "取消",
		buttons: btnArray
	}, function(event) {
		var index = event.index;
		switch (index) {
			case 1:
				app.setState({});
				plus.webview.getLaunchWebview().show("pop-in");
				break;
			case 2:
				plus.runtime.quit();
				break;
		}
	});
}, false);
var view = viewApi.view;
(function($) {
	var oldBack = $.back;
	$.back = function() {
		if (viewApi.canBack()) {
			viewApi.back();
		} else {
			oldBack();
		}
	};
})(mui);
