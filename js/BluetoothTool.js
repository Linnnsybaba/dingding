function BluetoothTool() {
	var BluetoothAdapter = plus.android.importClass("android.bluetooth.BluetoothAdapter");
	var OutputStreamWriter = plus.android.importClass("java.io.OutputStreamWriter");
	var Intent = plus.android.importClass("android.content.Intent");
	var IntentFilter = plus.android.importClass("android.content.IntentFilter");
	var BluetoothDevice = plus.android.importClass("android.bluetooth.BluetoothDevice");
	var UUID = plus.android.importClass("java.util.UUID");
	var Toast = plus.android.importClass("android.widget.Toast");
	var MY_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
	var invoke = plus.android.invoke;
	var btAdapter = BluetoothAdapter.getDefaultAdapter();
	var activity = plus.android.runtimeMainActivity();
	var btSocket = null;
	var btInStream = null;
	var btOutStream = null;
	var setIntervalId = 0;
	var btFindReceiver = null;
	var btStatusReceiver = null;
	var WIDTH_PIXEL = 384;
	var IMAGE_SIZE = 320;
	var state = {
		bluetoothEnable: false,
		bluetoothState: "",
		discoveryDeviceState: false,
		readThreadState: false
	};
	var options = {
		listenBTStatusCallback: function(state) {},
		discoveryDeviceCallback: function(newDevice) {},
		discoveryFinishedCallback: function() {},
		readDataCallback: function(dataByteArr) {},
		connExceptionCallback: function(e) {}
	};
	var bluetoothToolInstance = {
		state: state,
		init: init,
		isSupportBluetooth: isSupportBluetooth,
		getBluetoothStatus: getBluetoothStatus,
		turnOnBluetooth: turnOnBluetooth,
		turnOffBluetooth: turnOffBluetooth,
		getPairedDevices: getPairedDevices,
		discoveryNewDevice: discoveryNewDevice,
		listenBluetoothStatus: listenBluetoothStatus,
		connDevice: connDevice,
		disConnDevice: disConnDevice,
		cancelDiscovery: cancelDiscovery,
		readData: readData,
		sendData: sendData
	};
	if (window.bluetoothToolInstance) {
		return window.bluetoothToolInstance;
	} else {
		window.bluetoothToolInstance = bluetoothToolInstance;
		return bluetoothToolInstance;
	}

	function init(setOptions) {
		Object.assign(options, setOptions);
		state.bluetoothEnable = getBluetoothStatus();
		listenBluetoothStatus();
	}

	function shortToast(msg) {
		Toast.makeText(activity, msg, Toast.LENGTH_SHORT).show();
	}

	function isSupportBluetooth() {
		if (btAdapter != null) {
			return true;
		}
		return false;
	}

	function getBluetoothStatus() {
		if (btAdapter != null) {
			return btAdapter.isEnabled();
		}
		return false;
	}

	function turnOnBluetooth() {
		if (btAdapter == null) {
			shortToast("没有蓝牙");
			return;
		}
		if (!btAdapter.isEnabled()) {
			if (activity == null) {
				shortToast("未获取到activity");
				return;
			} else {
				var intent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
				var requestCode = 1;
				activity.startActivityForResult(intent, requestCode);
				shortToast("蓝牙已经打开");
				return;
			}
		} else {
			shortToast("蓝牙已经打开");
		}
	}

	function turnOffBluetooth() {
		if (btAdapter != null && btAdapter.isEnabled()) {
			btAdapter.disable();
		}
		if (btFindReceiver != null) {
			try {
				activity.unregisterReceiver(btFindReceiver);
			} catch (e) {}
			btFindReceiver = null;
		}
		state.bluetoothEnable = false;
		cancelDiscovery();
		closeBtSocket();
		if (btAdapter != null && btAdapter.isEnabled()) {
			btAdapter.disable();
			shortToast("蓝牙关闭成功");
		} else {
			shortToast("蓝牙已经关闭");
		}
	}

	function getPairedDevices() {
		var pairedDevices = [];
		var pairedDevicesAndroid = null;
		if (btAdapter != null && btAdapter.isEnabled()) {
			pairedDevicesAndroid = btAdapter.getBondedDevices();
		} else {
			shortToast("蓝牙未开启");
		}
		if (!pairedDevicesAndroid) {
			return pairedDevices;
		}
		var it = invoke(pairedDevicesAndroid, "iterator");
		while (invoke(it, "hasNext")) {
			var device = invoke(it, "next");
			pairedDevices.push({
				"name": invoke(device, "getName"),
				"address": invoke(device, "getAddress")
			});
		}
		return pairedDevices;
	}

	function discoveryNewDevice() {
		shortToast("蓝牙设备搜索中");
		if (btFindReceiver != null) {
			try {
				activity.unregisterReceiver(btFindReceiver);
			} catch (e) {
				console.error(e);
			}
			btFindReceiver = null;
			cancelDiscovery();
		}
		var Build = plus.android.importClass("android.os.Build");
		var Manifest = plus.android.importClass("android.Manifest");
		var MainActivity = plus.android.runtimeMainActivity();
		var ArrPermissions = [
			Manifest.permission.READ_EXTERNAL_STORAGE,
			Manifest.permission.WRITE_EXTERNAL_STORAGE,
			Manifest.permission.BLUETOOTH,
			Manifest.permission.BLUETOOTH_ADMIN,
			Manifest.permission.ACCESS_FINE_LOCATION,
			Manifest.permission.ACCESS_COARSE_LOCATION
		];

		function PermissionCheck(permission) {
			if (Build.VERSION.SDK_INT >= 23) {
				if (MainActivity.checkSelfPermission(permission) == -1) {
					return false;
				}
			}
			return true;
		}

		function PermissionChecks(Arr) {
			var HasPermission = true;
			for (var index in Arr) {
				var permission = Arr[index];
				//如果此处没有权限,则是用户拒绝了  
				if (!PermissionCheck(permission)) {
					HasPermission = false;
					break;
				}
			}
			return HasPermission;
		}

		function PermissionRequest(Arr) {
			var REQUEST_CODE_CONTACT = 101;
			if (Build.VERSION.SDK_INT >= 23) {
				MainActivity.requestPermissions(Arr, REQUEST_CODE_CONTACT);
			}
		}

		btFindReceiver = plus.android.implements("io.dcloud.android.content.BroadcastReceiver", {
			"onReceive": function(context, intent) {
				plus.android.importClass(context);
				plus.android.importClass(intent);
				var action = intent.getAction();
				if (BluetoothDevice.ACTION_FOUND == action) {
					var device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
					var newDevice = {
						"name": plus.android.invoke(device, "getName"),
						"address": plus.android.invoke(device, "getAddress")
					};
					options.discoveryDeviceCallback && options.discoveryDeviceCallback(newDevice);
				}
				if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED == action) {
					cancelDiscovery();
					options.discoveryFinishedCallback && options.discoveryFinishedCallback();
				}
			}
		});
		var filter = new IntentFilter();
		filter.addAction(BluetoothDevice.ACTION_FOUND);
		filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
		activity.registerReceiver(btFindReceiver, filter);
		btAdapter.startDiscovery();
		state.discoveryDeviceState = true;
	}

	function listenBluetoothStatus() {
		if (btStatusReceiver != null) {
			try {
				activity.unregisterReceiver(btStatusReceiver);
			} catch (e) {
				console.error(e);
			}
			btStatusReceiver = null;
		}
		btStatusReceiver = plus.android.implements("io.dcloud.android.content.BroadcastReceiver", {
			"onReceive": function(context, intent) {
				plus.android.importClass(context);
				plus.android.importClass(intent);
				var action = intent.getAction();
				switch (action) {
					case BluetoothAdapter.ACTION_STATE_CHANGED:
						var blueState = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, 0);
						var stateStr = "";
						switch (blueState) {
							case BluetoothAdapter.STATE_TURNING_ON:
								stateStr = "STATE_TURNING_ON";
								break;
							case BluetoothAdapter.STATE_ON:
								state.bluetoothEnable = true;
								stateStr = "STATE_ON";
								break;
							case BluetoothAdapter.STATE_TURNING_OFF:
								stateStr = "STATE_TURNING_OFF";
								break;
							case BluetoothAdapter.STATE_OFF:
								stateStr = "STATE_OFF";
								state.bluetoothEnable = false;
								break;
						}
						state.bluetoothState = stateStr;
						options.listenBTStatusCallback && options.listenBTStatusCallback(stateStr);
						break;
				}
			}
		});
		var filter = new IntentFilter();
		filter.addAction(BluetoothAdapter.ACTION_STATE_CHANGED);
		activity.registerReceiver(btStatusReceiver, filter);
	}

	function connDevice(address) {
		var InputStream = plus.android.importClass("java.io.InputStream");
		var OutputStream = plus.android.importClass("java.io.OutputStream");
		var BluetoothSocket = plus.android.importClass("android.bluetooth.BluetoothSocket");
		cancelDiscovery();
		plus.nativeUI.showWaiting('连接中...');
		if (btSocket != null) {
			closeBtSocket();
		}
		state.readThreadState = false;
		try {
			var device = invoke(btAdapter, "getRemoteDevice", address);
			btSocket = invoke(device, "createRfcommSocketToServiceRecord", MY_UUID);
		} catch (e) {
			console.error(e);
			shortToast("连接失败，获取Socket失败！");
			localStorage.setItem('sheetAlert', true);
			plus.nativeUI.closeWaiting();
			return false;
		}
		try {
			invoke(btSocket, "connect");
			readData();
			shortToast("连接成功");
			localStorage.setItem('sheetAlert', false);
		} catch (e) {
			console.error(e);
			shortToast("连接失败");
			localStorage.setItem('sheetAlert', true);
			plus.nativeUI.closeWaiting();
			try {
				btSocket.close();
				btSocket = null;
			} catch (e1) {
				console.error(e1);
			}
			return false;
		}
		plus.nativeUI.closeWaiting();
		return true;
	}

	function disConnDevice() {
		if (btSocket != null) {
			closeBtSocket();
		}
		state.readThreadState = false;
		shortToast("断开连接成功");
	}

	function closeBtSocket() {
		state.readThreadState = false;
		if (!btSocket) {
			return;
		}
		try {
			btSocket.close();
		} catch (e) {
			console.error(e);
			btSocket = null;
		}
	}

	function cancelDiscovery() {
		if (btAdapter.isDiscovering()) {
			btAdapter.cancelDiscovery();
		}
		if (btFindReceiver != null) {
			activity.unregisterReceiver(btFindReceiver);
			btFindReceiver = null;
		}
		state.discoveryDeviceState = false;
	}

	function readData() {
		if (!btSocket) {
			shortToast("请先连接蓝牙设备！");
			return false;
		}
		try {
			btInStream = invoke(btSocket, "getInputStream");
			btOutStream = invoke(btSocket, "getOutputStream");
		} catch (e) {
			console.error(e);
			closeBtSocket();
			return false;
		}
		var setTimeCount = 0;
		read();
		state.readThreadState = true;
		return true;

		function read() {
			clearInterval(setIntervalId);
			setIntervalId = setInterval(function() {
				setTimeCount++;
				if (state.readThreadState) {
					var t = new Date().getTime();
					if (setTimeCount % 20 == 0) {
						try {
							btOutStream.write([0]);
						} catch (e) {
							state.readThreadState = false;
							options.connExceptionCallback && options.connExceptionCallback(e);
						}
					}
					var dataArr = [];
					while (invoke(btInStream, "available") !== 0) {
						var data = invoke(btInStream, "read");
						dataArr.push(data);
						var ct = new Date().getTime();
						if (ct - t > 20) {
							break;
						}
					}
					if (dataArr.length > 0) {
						options.readDataCallback && options.readDataCallback(dataArr);
					}
				}
			}, 40);
		}
	}

	function format(unixtimestamp) {
		var unixtimestamp = new Date(unixtimestamp * 1000);
		var year = 1900 + unixtimestamp.getYear();
		var month = "0" + (unixtimestamp.getMonth() + 1);
		var date = "0" + unixtimestamp.getDate();
		var hour = "0" + unixtimestamp.getHours();
		var minute = "0" + unixtimestamp.getMinutes();
		var second = "0" + unixtimestamp.getSeconds();
		return year + "-" + month.substring(month.length - 2, month.length) + "-" + date.substring(date.length - 2, date.length) +
			" " + hour.substring(hour.length - 2, hour.length) + ":" + minute.substring(minute.length - 2, minute.length) + ":" +
			second.substring(second.length - 2, second.length);
	}

	function changeGender(num) {
		if (num == 1) {
			return '(先生)';
		} else {
			return '(女士)';
		}
	}

	function changeRemark(str) {
		if (str == '') {
			return '无'
		} else {
			return str
		}
	}

	function sendData(dataStr) {
		if (!btOutStream) {
			return;
		}
		var bytes = invoke(dataStr, 'getBytes', 'gbk');
		try {
			printAlignment(1);
			printLine();
			printLargeText(getGbk(dataStr.title + "\n"), 48);
			printLargeText(getGbk("在线支付(已支付)\n"), 48);
			printLine();
			printText(getGbk("【订单号】" + dataStr.id + "\n"));
			printText(getGbk("【订单时间】" + format(dataStr.time) + "\n"));
			printdrawLine();
			printAlignment(0);
			printBlod(getGbk("商品名称         数量  金额(元)"));
			for (var i = 0; i < dataStr.list.length; i++) {
				var detail = dataStr.list[i];
				printThreeColumn(detail.title, detail.qty, detail.price);
			}
			printdrawLine();
			printAlignment(1);
			printLargeText(getGbk("总计: ￥" + dataStr.amt + "\n"), 48);
			printdrawLine();
			printAlignment(0);
			printLineHeight();
			printLine();
			printLargeText(getGbk(dataStr.address + "\n"), 48);
			printLargeText(getGbk(dataStr.phone + "\n"), 48);
			printLargeText(getGbk(dataStr.name + changeGender(dataStr.gender) + "\n"), 48);
			printLine();
			printLargeText(getGbk('备注:' + changeRemark(dataStr.remark) + "\n"), 48);
			printLine();
			printLine();
			printLine();
			printLine();
			printEndLine();
			printLine();
			cutPapper();
			localStorage.setItem('type', true);
		} catch (e) {
			return false;
		}
		return true;
	}

	function isChn(str, i) {
		charCode = str.charCodeAt(i);
		if (charCode >= 0 && charCode <= 128)
			return false;
		else
			return true;
	}

	function computeLength(title) {
		var count = 0;
		for (var i = 0; i < title.length; i++) {
			charCode = title.charCodeAt(i);
			if (charCode >= 0 && charCode <= 128)
				count += 1;
			else
				count += 2;
		}
		return count;
	}

	function printLineHeight() {
		btOutStream.write([0x1b, 0x33, 40]);
		btOutStream.flush();
	}

	function printThreeColumn(title, content, money) {
		btOutStream.write([0x1b, 0x33, 40]);
		var s = "";
		if (computeLength(title) <= 16) {
			s += title;
			var space = 18 - computeLength(s);
			for (var j = 0; j < space; j++) {
				s += " ";
			}
		} else {
			printSpaceLine();
			var count = 0;
			var start = 0;
			var a = title.length;
			for (var i = 0; i < title.length; i++) {
				charCode = title.charCodeAt(i);
				if (charCode >= 0 && charCode <= 128)
					count += 1;
				else
					count += 2;
				var flag = ((count + 1) % 16 == 0 && i + 1 < title.length && isChn(title, i + 1));
				if (count % 16 == 0) {
					s += title.substring(start, i + 1) + "\n";
					start = i + 1;
				} else if (flag) {
					count += 1;
					s += title.substring(start, i + 1) + "\n";
					start = i + 1;
				}
			}
			if (start < title.length) {
				var tmp = title.substring(start, title.length);
				s += tmp;
				var space = 18 - computeLength(tmp);
				for (var j = 0; j < space; j++) {
					s += " ";
				}
			} else {
				s = s.substring(0, s.length - 1);
				for (var j = 0; j < 2; j++) {
					s += " ";
				}
			}
		}
		var content_length = computeLength(content);
		// console.log(content.length);
		if (content_length < 8) {
			var space = 6 - content_length;
			for (var j = 0; j < space; j++) {
				content += " ";
			}
		}
		printText(getGbk(s + content + money));
		printLine();
		if (computeLength(title) > 16)
			printSpaceLine();
	}

	function draw2PxPoint(imgData) {
		var imgarray = [];
		for (var i = 0; i < imgData.length; i++) {
			if (i % 4 == 0) {
				var rule = 0.29900 * imgData[i] + 0.58700 * imgData[i + 1] + 0.11400 * imgData[i + 2];
				if (rule > 128) {
					imgData[i] = 0;
				} else {
					imgData[i] = 1;
				}
				imgarray.push(imgData[i]);
			}
		}
		return imgarray;
	}

	function printAlignment(alignment) {
		btOutStream.write(0x1b);
		btOutStream.write(0x61);
		btOutStream.write(alignment);
	}

	function printLargeText(text, size) {
		btOutStream.write(0x1b);
		btOutStream.write(0x21);
		btOutStream.write(size);
		btOutStream.write(text);
		btOutStream.write(0x1b);
		btOutStream.write(0x21);
		btOutStream.write(0);
		btOutStream.flush();
	}

	function printText(text) {
		btOutStream.write(text);
		btOutStream.flush();
	}

	function initPrinter() {
		btOutStream.write(0x1B);
		btOutStream.write(0x40);
		btOutStream.flush();
	}

	function printLine(lineNum) {
		btOutStream.write(0x0a);
	}

	function printdrawLine() {
		printText(getGbk("--------------------------------"));
		btOutStream.write(0x0a);
	}

	function printEndLine() {
		printText(getGbk("---------------END--------------"));
		btOutStream.write(0x0a);
	}

	function printBlod(text) {
		btOutStream.write([0x1b, 0x45, 1]);
		btOutStream.write(text);
		btOutStream.write([0x1b, 0x45, 0]);
		btOutStream.flush();
	}

	function printTabSpace(length) {
		for (var i = 0; i < length; i++) {
			btOutStream.write("\t");
		}
		btOutStream.flush();
	}

	function printSpaceLine() {
		btOutStream.write([0x1b, 0x33, 20]);
		btOutStream.write(getGbk("\n"));
		btOutStream.write([0x1b, 0x33, 0]);
		btOutStream.flush();
	}

	function setLocation(offset) {
		var bs = [];
		bs[0] = 0x1B;
		bs[1] = 0x24;
		bs[2] = offset % 256;
		bs[3] = offset / 256;
		return bs;
	}

	function getGbk(stText) {
		var bytes = invoke(stText, 'getBytes', 'gbk');
		return bytes;
	}

	function printTwoColumn(title, content) {
		console.log("进入函数");
		var iNum = 0;
		var byteBuffer = [];
		var tmp;
		tmp = title;
		copyArray(tmp, 0, byteBuffer, iNum, tmp.length);
		iNum += tmp.length;
		tmp = setLocation(getOffset(content));
		copyArray(tmp, 0, byteBuffer, iNum, tmp.length);
		iNum += tmp.length;
		tmp = content;
		copyArray(tmp, 0, byteBuffer, iNum, tmp.length);
		console.log(byteBuffer.length);
		console.log(byteBuffer);
		printText(byteBuffer);
	}

	function copyArray(src, srcPos, dest, destPos, length) {
		console.log("进入copyArray函数");
		for (var i = srcPos; i < src.length && i < srcPos + length; i++) {
			dest.push(src[destPos++]);
		}
		console.log(dest);
	}

	function print(bs) {
		btOutStream.write(bs);
	}

	function getStringPixLength(str) {
		var pixLength = 0;
		for (var i = 0; i < str.length; i++) {
			if (isChinese(str[i])) {
				pixLength += 24;
			} else {
				pixLength += 12;
			}
		}
		return pixLength;
	}

	function getOffset(str) {
		return WIDTH_PIXEL - getStringPixLength(str);
	}

	function printBarCode(str) {
		btOutStream.write([0x1D, 0x6B, 0x49, 0x0E, 0x7B, 0x41]);
		btOutStream.write([0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A]);
		btOutStream.flush();
	}

	function print2DBarCode(text) {
		var content = text.toString();
		jQuery('#qrcode').qrcode({
			width: 240,
			height: 240,
			correctLevel: 0,
			text: content
		});
		var canvas = document.getElementsByTagName("canvas")[0];
		var ctx = canvas.getContext("2d");
		var imgData = ctx.getImageData(0, 0, 240, 240);
		var imgarray = [];
		var data = [];
		imgarray = draw2PxPoint(imgData.data);
		for (var i = 0; i < 10; i++) {
			for (var j = 0; j < 240; j++) {
				for (var k = 0; k < 3; k++) {
					var temp = 0;
					for (var n = 0; n < 8; n++) {
						temp += imgarray[(i * 24 * 240) + (240 * 8 * k) + j + (n * 240)] * Math.pow(2, 7 - n);
					}
					data.push(temp % 128);
				}
			}
		}
		var llg = 0;
		var a = [];
		for (var q = 0; q < 10; q++) {
			a.push(0x1B);
			a.push(0x61);
			a.push(1);
			a.push(0x1B);
			a.push(0x2A);
			a.push(33);
			a.push(-16);
			a.push(0);
			for (var b = 0; b < 240; b++) {
				a.push(data[llg++]);
				a.push(data[llg++]);
				a.push(data[llg++]);
			}
		}
		a.push(0x1B);
		a.push(0x61);
		a.push(1);
		a.push(0x1B);
		a.push(0x2A);
		a.push(33);
		a.push(-16);
		a.push(0);
		for (var b = 0; b < 240; b++) {
			a.push(0);
			a.push(0);
			a.push(0);
		}
		btOutStream.write(a);
		btOutStream.flush();
	}

	function cutPapper() {
		btOutStream.write([0x1d, 0x56, 1]);
		btOutStream.flush();
	}
}
