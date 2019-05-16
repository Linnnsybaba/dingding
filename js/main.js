document.addEventListener('plusready', function() {
	new Vue({
		data: function() {
			return {
				orders: {
					type: Array,
					default: []
				},
				show: false,
				bluetoothState: {},
				pairedDevices: [],
				newDevices: [],
				receiveDataArr: [],
				sendData: "",
				msg: "",
				def: 0,
				goTop: false,
				pulldownMsg: "<span class=\"mui-icon mui-icon-pulldown\"></span>下拉刷新",
				alertMsg: "刷新成功",
				alertHook: false,
				alertOnce: true
			};
		},
		computed: {
			receiveDataStr: function() {
				return String.fromCharCode.apply(String, this.receiveDataArr);
			},
			bluetoothStatusDesc: function() {
				return this.bluetoothStatus ? "已开启" : "已关闭";
			}
		},
		created: function() {
			this.timer();
			this.getData();
			var self = this;
			localStorage.setItem('sheetAlert', true)
			var Build = plus.android.importClass("android.os.Build");
			bluetoothTool = BluetoothTool();
			this.bluetoothState = bluetoothTool.state;
			bluetoothTool.init({
				listenBTStatusCallback: function(state) {
					self.msg = "蓝牙状态: " + state;
				},
				discoveryDeviceCallback: function(newDevice) {
					self.newDevices.push(newDevice);
				},
				discoveryFinishedCallback: function() {
					self.msg = "搜索完成";
				},
				readDataCallback: function(dataByteArr) {
					if (self.receiveDataArr.length >= 200) {
						self.receiveDataArr = [];
					}
					self.receiveDataArr.push.apply(self.receiveDataArr, dataByteArr);
				},
				connExceptionCallback: function(e) {
					self.msg = "设备连接失败";
				}
			});
			this.discoveryNewDevice();
			if (!bluetoothTool.state.readThreadState && Build.VERSION.SDK_INT >= 23) {
				alert('请前往设置-> 应用管理-> 丁丁商户通 打开蓝牙以及位置权限')
			}
		},
		methods: {
			_initScroll: function() {
				var self = this;
				var goTop = this.$refs.goTop;
				if (!this.scroll) {
					this.scroll = new BScroll(self.$refs.wrapper, {
						probeType: 1,
						click: true,
						scrollY: true
					});
				} else {
					this.scroll.refresh();
				}
				this.scroll.on('scroll', function(pos) {
					if (pos.y > 66) {
						self.pulldownMsg = '释放立即刷新';
					} else {
						self.pulldownMsg = "<span class=\"mui-icon mui-icon-pulldown\"></span>下拉刷新";
					}
					if (pos.y < -600) {
						self.goTop = true;
					} else {
						self.goTop = false;
					}
				});
				this.scroll.on('touchEnd', function(pos) {
					if (pos.y > 66) {
						setTimeout(function() {
							self.getData();
							self.pulldownMsg = "<span class=\"mui-icon mui-icon-pulldown\"></span>下拉刷新";
						}, 1000);
					}
				});
				goTop.addEventListener('tap', function() {
					self.goTop = false;
					self.scroll.scrollTo(0, 0, 500);
				});
			},
			showActionSheet: function() {
				var Build = plus.android.importClass("android.os.Build");
				var arr = [{
					title: '重新扫描蓝牙设备',
					style: 'destructive'
				}];
				var device = {};
				var self = this;
				if(!bluetoothTool.state.readThreadState && Build.VERSION.SDK_INT >= 23 && self.alertOnce){
					mui.toast('请确保你的蓝牙以及定位权限已经开启')
					self.alertOnce = false
				}
				mui.toast()
				localStorage.setItem('sheetAlert', false);
				var newDevices = this.newDevices;
				for (var i = 0; i < newDevices.length; i++) {
					device.index = (i + 1);
					device.title = newDevices[i].name;
					device.address = newDevices[i].address;
					arr.push(device)
					device = {}
				}
				
				plus.nativeUI.actionSheet({
						title: "请连接蓝牙设备",
						cancel: "取消",
						buttons: arr
					},
					function(e) {
						if (e.index == 1) {
							self.discoveryNewDevice()
							setTimeout(function() {
								self.showActionSheet()
							}, 3000)
						} else if (e.index == 0 || e.index == -1) {
							localStorage.setItem('sheetAlert', true);
						}
						if (e.index != -1 && e.index != 0 && e.index != 1) {
							self.connDevice(arr[e.index - 1].address)
						}
					}
				);
			},
			getData: function() {
				var self = this;
				var storage = window.localStorage;
				var base_url = 'https://m.ddxysc.com/bizapi/';
				var sess_id = localStorage.getItem('sess_id');
				var date = self.timest();
				var hash = hex_md5('page=1&sess_id=' + sess_id + '&timestamp=' + date + '&pPfuuq0ZeEteK2yd').toUpperCase();
				mui.ajax({
					url: base_url + 'order/glist',
					// url: 'demo.json',
					// url: 'http://update.ddxysc.com/demo.php',
					type: 'POST',
					dataType: 'json',
					timeout: 2000,
					data: {
						page: 1,
						sess_id: sess_id,
						timestamp: date,
						sign: hash
					},
					header: {
						"Content-Type": "application/x-www-form-urlencoded"
					},
					success: function(response) {
						console.log('请求状态码:' + response.net);
						if (response.net != 2000) {
							self.getData();
						}
						var data = response.list.reverse();
						var updateData = data.length - self.orders.length;
						if(!updateData){
							updateData = 0
						}
						self.refreshAlert();
						self.orders = data;
						for (var i = 0; i < data.length; i++) {
							if (i == data.length)
								break;
							Vue.set(data[i], 'printCount');
							data[i].printCount = loadFromLocal(data[i].id, 'printCount', self.def)
							if (data[i].printCount == null) {

								saveToLocal(data[i].id, 'printCount', 0)
								data[i].printCount = loadFromLocal(data[i].id, 'printCount', self.def)
							}
							Vue.set(data[i], 'showDetail', self.show);
						}
						self.unprintedOrder();
						
					},
					error: function(error) {
						if (error.status == 200) {
							self.getData()
						} else if (error.status == 400 || error.status == 404) {
							alert('订单数据获取失败!\n请检查网络连接状态');
						}
					}
				});
			},
			unprintedOrder: function() {
				var self = this;
				var localSheetAlert = JSON.parse(localStorage.getItem('sheetAlert'))
				setTimeout(function() {
					self._initScroll();
					var arr = [];
					if (!bluetoothTool.state.bluetoothEnable) {
						self.turnOnBluetooth();
					}
// 					if (!bluetoothTool.state.readThreadState) {
// 						self.discoveryNewDevice();
// 					}
// 					setTimeout(function() {
// 						if (!bluetoothTool.state.readThreadState) {
// 							if (localSheetAlert) {
// 								self.showActionSheet()
// 							}
// 						}
// 					}, 3000)
					if(localSheetAlert){
						if (!bluetoothTool.state.readThreadState) {
							self.discoveryNewDevice();
						}
						setTimeout(function(){
							self.showActionSheet()
						}, 3000)
					}
					if (bluetoothTool.state.readThreadState) {
						for (var i = 0; i < self.orders.length; i++) {
							if (self.orders[i].printCount == 0) {
								self.onSendData(self.orders[i]);
								var type = localStorage.getItem('type');
								if (type == "true") {
									++self.orders[i].printCount;
								}
								saveToLocal(self.orders[i].id, 'printCount', self.orders[i].printCount)
								self.orders[i].printCount = loadFromLocal(self.orders[i].id, 'printCount', self.def)
								arr.push(self.orders[i]);
							}
						}
					}
					if (arr.length > 0) {
						self.$refs.autoplay.play();
					}
				}, 1000);
			},
			timer: function() {
				var self = this;
				setInterval(function() {
					self.getData();
				}, 30000);
			},
			timest: function() {
				var tmp = Date.parse(new Date()).toString();
				tmp = tmp.substr(0, 10);
				return tmp;
			},
			format: function(unixtimestamp) {
				var unixtimestamp = new Date(unixtimestamp * 1000);
				var year = 1900 + unixtimestamp.getYear();
				var month = "0" + (unixtimestamp.getMonth() + 1);
				var date = "0" + unixtimestamp.getDate();
				var hour = "0" + unixtimestamp.getHours();
				var minute = "0" + unixtimestamp.getMinutes();
				var second = "0" + unixtimestamp.getSeconds();
				return year + "-" + month.substring(month.length - 2, month.length) + "-" + date.substring(date.length - 2,
					date.length) + " " + hour.substring(hour.length - 2, hour.length) + ":" + minute.substring(minute.length - 2,
					minute.length) + ":" + second.substring(second.length - 2, second.length);
			},
			moreDetailClick: function(order, index) {
				this._initScroll();
				order.showDetail = !order.showDetail;
				return order.showDetail;
			},
			orderClick: function(order, index) {
				var self = this;
				var storage = window.localStorage;
				var btnArray = ['是', '否'];
				mui.confirm('是否打印订单', 'Hello', btnArray, function(e) {
					if (e.index == 0) {
						if (!bluetoothTool.state.bluetoothEnable) {
							self.turnOnBluetooth();
						}
						if (!bluetoothTool.state.readThreadState) {
							self.getPairedDevices();
							self.showActionSheet();
						} else {
							if (!order.printCount && order.printCount != 0) {
								Vue.set(order, 'printCount', 1);
								saveToLocal(order.id, 'printCount', 1)
							} else {
								order.printCount++;
								saveToLocal(order.id, 'printCount', order.printCount)
							}
						}
						self.onSendData(order);
					} else {
						mui.toast('打印失败');
					}
				});
			},
			refreshAlert: function() {
				var self = this;
				self.alertHook = true
				setTimeout(function() {
					self.alertHook = false
				}, 1000);
			},
			close: function() {
				this.toothDevShow = false;
				this.fadeShow = false;
			},
			turnOnBluetooth: function() {
				bluetoothTool.turnOnBluetooth();
			},
			turnOffBluetooth: function() {
				bluetoothTool.turnOffBluetooth();
			},
			getPairedDevices: function() {
				this.pairedDevices = bluetoothTool.getPairedDevices();
			},
			discoveryNewDevice: function() {
				this.newDevices = [];
				bluetoothTool.discoveryNewDevice();
			},
			cancelDiscovery: function() {
				bluetoothTool.cancelDiscovery();
			},
			connDevice: function(address) {
				bluetoothTool.connDevice(address);
				this.toothDevShow = false;
				this.fadeShow = false;
				this.getData();
			},
			disConnDevice: function() {
				bluetoothTool.disConnDevice();
			},
			onSendData: function(order) {
				bluetoothTool.sendData(order);
			}
		},
		destroyed: function() {
			clearInterval(this.timer);
		}
	}).$mount('#app');
});
