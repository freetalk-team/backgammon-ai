Object.clone = function(o) {
	var newObj = (o instanceof Array) ? [] : {};
	for (let i in o) {
		if (o[i] && typeof o[i] == "object") {

			newObj[i] = ArrayBuffer.isView(o[i]) 
				? new o[i].constructor(o[i]) 
				: Object.clone(o[i]);

			
		} else { 
			newObj[i] = o[i]
		}

	} 
	
	return newObj;
}

Array.repeat = function(n, v=0) {
	return new Array(n).fill(0);
}

String.prototype.capitalizeFirstLetter = function() {
	return this.charAt(0).toUpperCase() + this.slice(1);
}