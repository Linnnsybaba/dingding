function saveToLocal(id, key, value) {
	var ordersPrintCount = window.localStorage.__ordersPrintCount__
	if (!ordersPrintCount) {
		ordersPrintCount = {}
		ordersPrintCount[id] = {}
	} else {
		ordersPrintCount = JSON.parse(ordersPrintCount)
		if (!ordersPrintCount[id]) {
			ordersPrintCount[id] = {}
		}
	}
	ordersPrintCount[id][key] = value

	window.localStorage.__ordersPrintCount__ = JSON.stringify(ordersPrintCount)
}

function loadFromLocal(id, key, def) {
	var ordersPrintCount = window.localStorage.__ordersPrintCount__
	if (!ordersPrintCount) {
		return def
	}
	ordersPrintCount = JSON.parse(ordersPrintCount)[id]
	if (!ordersPrintCount) {
		return def
	}
	var ret = ordersPrintCount[key]
	return ret || def
}
