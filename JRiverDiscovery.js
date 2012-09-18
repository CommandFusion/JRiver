var JRiverDiscovery = function(params) {

	var self = {
		accessKey: "", // Get this from JRiver > Tools > Options > Media Network > Tick first box, click second item to generate (or right click to copy the key)
		Players: [],
		lookupAddress: "http://webplay.jriver.com/libraryserver/lookup?id=", // Append accessKey to this URL to find any JRiver media servers publishing their access
		eventCallbacks: {
			"DeviceDiscovered" : [],
			"GroupsChanged" : [],
		},
	};

	self.init = function() {
		CF.log("JRiverDiscovery: init()");
	};

	self.emit = function() {
		var type = arguments[0];
		if (!self.eventCallbacks[type]) {
			CF.log("Undefined event!");
			return false;
		}

		var handlers = self.eventCallbacks[type];
		if (!Array.isArray(handlers)) {
			CF.log("No event handlers found for '" + type + "' event.");
			return false;
		}

		// Get arguments used for the emit, remove the type, assign to new array
		var l = arguments.length;
		var args = new Array(l - 1);
		for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

		var listeners = handlers.slice();
		for (var i = 0, l = listeners.length; i < l; i++) {
			listeners[i].apply(this, args);
		}
	};

	self.on = function(type, listener) {
		// Add listener to specific event
		if (!self.eventCallbacks[type]) {
			CF.log("Undefined event!");
			return false;
		}

		if (!Array.isArray(handlers)) {
			// Handlers is not an array, so lets make it one first
			self.eventCallbacks[type] = [listener];
		} else {
			// Add to the array
			self.eventCallbacks[type].push(listener);
		}
	};

	self.transportEventPlay = function(cmd) {
		var url, xml, soapBody, soapAction;
		var host = "http://" + self.devices[0].IP + ":" + self.port;
		url = '/MediaRenderer/AVTransport/Control';
		soapAction = "urn:schemas-upnp-org:service:AVTransport:1#" + cmd;
		soapBody = '<u:' + cmd + ' xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:' + cmd + '>';
		xml = self.soapRequestTemplate.replace('{0}', soapBody);
		self.sendSoapRequest(url, host, xml, soapAction, false);
		//self.AVTransportPlay(self.currentHost, 0, 1)
	}

	return self;
};

CF.modules.push({
	name: "JRiver Discovery",	// the name of the module (mostly for display purposes)
	object: JRiverDiscovery,	// the object to which the setup function belongs ("this")
	version: 1.0				// An optional module version number that is displayed in the Remote Debugger
});