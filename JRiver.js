var EventHandler = {
	emit: function () {
		var obj = arguments[0];
		var type = arguments[1];
		if (!obj.eventCallbacks[type]) {
			CF.log("Undefined event '" + type + "'.");
			return false;
		}

		var handlers = obj.eventCallbacks[type];
		if (!Array.isArray(handlers)) {
			CF.log("No event handlers found for '" + type + "' event.");
			return false;
		}

		// Get arguments used for the emit, remove the type, assign to new array
		var l = arguments.length;
		var args = new Array(l - 1);
		// First argument in the callback is the object that fired the event
		args[0] = obj;
		// Add any additional callback details
		for (var i = 2; i < l; i++) args[i - 1] = arguments[i];

		var listeners = handlers.slice();
		for (var i = 0, l = listeners.length; i < l; i++) {
			listeners[i].apply(this, args);
		}
	},

	on: function(obj, type, listener) {
		// Add listener to specific event
		if (!obj.eventCallbacks[type]) {
			CF.log("Undefined event - '" + type + "'.");
			return false;
		}

		if (!Array.isArray(obj.eventCallbacks[type])) {
			// Handlers is not an array, so lets make it one first
			obj.eventCallbacks[type] = [listener];
		} else {
			// Add to the array
			obj.eventCallbacks[type].push(listener);
		}
	}
};


var JRiverZone = function(params) {
	var self = {
		id: params.id,
		name: params.name,
		guid: params.guid,
		pollingRate: params.pollingRate || 1000,
		pollingID: null,
		info: {},
		eventCallbacks: {
			"InfoChanged" : [],
			"VolumeChanged" : [],
		},
	};

	self.init = function() {
		// Start polling the zone for its status info
		self.pollingID = setInterval(self.getInfo, self.pollingRate);
	};

	self.stopPolling = function() {
		if (self.pollingID) {
			clearInterval(self.pollingID);
		}
	};

	self.getInfo = function() {
		CF.request(JRiver.player.webServiceURL + "Playback/Info?Zone=" + self.id, function (status, headers, body) {
			if (status == 200) {
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(body, 'text/xml');
				// Get the data from XML
				var results = xmlDoc.evaluate("//Item", xmlDoc, null, XPathResult.ANY_TYPE, null);
				
				var infoItem = results.iterateNext();
				while (infoItem) {
					self.info[infoItem.getAttribute("Name")] = infoItem.childNodes[0].nodeValue;
					infoItem = results.iterateNext();
				}

				EventHandler.emit(self, 'InfoChanged');
			}
		});
	};

	return self;
};

var JRiverPlayer = function(params) {
	params = params || {};

	var self = {
		authToken: null,
		ipAddress: params.ipAddress || null,
		macAddress: params.macAddress || null,
		port: params.port || 52199,
		webServiceURL: "http://" + params.ipAddress + ":" + (params.port || 52199) + "/MCWS/v1/",
		programVersion: null,
		RuntimeGUID: null,
		zones: [],
		currentZoneName: "",
		currentZoneID: 0,
		browsing: [],
		browseHistory: [],
		files: [],
		eventCallbacks: {
			"ZonesChanged" : [],
			"CurrentZoneChanged" : [],
			"PlaybackStateChanged" : [],
			"ConfigurationChanged" : [],
			"BrowseChanged" : [],
			"FilesChanged" : [],
		},
	};

	self.authenticate = function() {
		CF.request(self.webServiceURL + "Authenticate", function (status, headers, body) {
			if (status == 200) {
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(body, 'text/xml');
				// Get the data from XML
				self.authToken = xmlDoc.evaluate("//Item[@Name='Token']", xmlDoc, null, XPathResult.STRING_TYPE, null).stringValue;
			} else {
				CF.log("JRiver HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.getConfiguration = function() {
		// send WOL command to wake up the PC if its not already awake
		try {
			WOL.wake(self.macAddress);
		} catch (err) {
			CF.log("WOL script was not loaded.\n" + err);
		}

		CF.request(self.webServiceURL + "Alive", function (status, headers, body) {
			if (status == 200) {
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(body, 'text/xml');
				// Get the data from XML
				self.programVersion = xmlDoc.evaluate("//Item[@Name='ProgramVersion']", xmlDoc, null, XPathResult.STRING_TYPE, null).stringValue;
				self.RuntimeGUID = xmlDoc.evaluate("//Item[@Name='RuntimeGUID']", xmlDoc, null, XPathResult.STRING_TYPE, null).stringValue;
				self.name = xmlDoc.evaluate("//Item[@Name='FriendlyName']", xmlDoc, null, XPathResult.STRING_TYPE, null).stringValue;
				// Now get list of zones
				self.getZones();
				// Start browsing list
				//self.browse(1367);
			} else {
				CF.log("JRiver HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.getZones = function() {
		CF.request(self.webServiceURL + "Playback/Zones", function (status, headers, body) {
			if (status == 200) {
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(body, 'text/xml');
				// Get the data from XML
				var numZones = xmlDoc.evaluate("//Item[@Name='NumberZones']", xmlDoc, null, XPathResult.STRING_TYPE, null).stringValue;

				self.currentZoneID = xmlDoc.evaluate("//Item[@Name='CurrentZoneID']", xmlDoc, null, XPathResult.STRING_TYPE, null).stringValue;
				
				for (var i=0; i<numZones; i++) {
					var newZone = new JRiverZone({
						name: xmlDoc.evaluate("//Item[@Name='ZoneName"+i+"']", xmlDoc, null, XPathResult.STRING_TYPE, null).stringValue,
						id: xmlDoc.evaluate("//Item[@Name='ZoneID"+i+"']", xmlDoc, null, XPathResult.STRING_TYPE, null).stringValue,
						guid: xmlDoc.evaluate("//Item[@Name='ZoneGUID"+i+"']", xmlDoc, null, XPathResult.STRING_TYPE, null).stringValue,
						player: self
					});

					// Start polling the zone for it's status info
					newZone.init();

					if (newZone.id == self.currentZoneID) {
						self.currentZoneName = newZone.name;
					}

					// Add the zone to the player object
					self.zones.push(newZone);
				}

				EventHandler.emit(self, 'ZonesChanged');

			} else {
				CF.log("JRiver HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.getZoneByID = function (id) {
		id = (id === undefined || id == -1) ? self.currentZoneID : id;
		for (var i = 0; i < self.zones.length; i++) {
			if (self.zones[i].id == id) {
				return self.zones[i];
			}
		}
		return;
	};

	self.selectZone = function(id) {
		if (!id) return;
		CF.request(self.webServiceURL + "Playback/SetZone?Zone=" + id, function (status, headers, body) {
			if (status == 200) {
				var theZone = self.getZoneByID(id);
				self.currentZoneID = id;
				self.currentZoneName = theZone.name;
				EventHandler.emit(self, 'CurrentZoneChanged');
				// Update UI with the selected zone info
				theZone.getInfo();
			}
		});		
	};

	self.browseBack = function() {
		if (self.browseHistory.length > 1) {
			// Remove the current ID from browse history
			self.browseHistory.pop();
			// Now browse to the last item in the history
			self.browse(self.browseHistory.pop().id);
		}
	};

	// Get the title text of the current browsing list
	self.getBrowseTitle = function() {
		if (self.browseHistory.length) {
			return self.browseHistory[self.browseHistory.length - 1].name;
		}
		return "";
	};

	self.getBrowseItemByID = function(id) {
		for (var i=0; i<self.browsing.length; i++) {
			if (self.browsing[i].id == id) {
				return self.browsing[i];
			}
		}
		return null;
	};

	self.browse = function(id, skip) {
		var urlID = (id !== undefined) ? "?id=" + id : "";
		CF.request(self.webServiceURL + "Browse/Children" + urlID, function (status, headers, body) {
			if (status == 200) {
				// Save the browse history
				var browseItem = self.getBrowseItemByID(id);
				if (browseItem) {
					self.browseHistory.push(browseItem);
				} else {
					// Don't know the name of the item we are browing, so just use "Menu"
					self.browseHistory.push({id: id, name: "Menu"});
				}

				// Clear the previous browsing list
				self.browsing = [];
				
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(body, 'text/xml');
				// Get the data from XML
				var results = xmlDoc.evaluate("/Response/Item", xmlDoc, null, XPathResult.ANY_TYPE, null);

				var infoItem = results.iterateNext();
				while (infoItem) {
					self.browsing.push({id: infoItem.childNodes[0].nodeValue, name: infoItem.getAttribute("Name")});
					infoItem = results.iterateNext();
				}

				EventHandler.emit(self, 'BrowseChanged');

				if (!self.browsing.length) {
					// No items to browse for this ID, so get a file list instead
					self.getFiles(id);
				}

			} else {
				CF.log("JRiver HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.getFiles = function(id, skip) {
		var urlID = (id !== undefined) ? "?id=" + id : "";
		CF.request(self.webServiceURL + "Browse/Files" + urlID, function (status, headers, body) {
			if (status == 200) {
				// Clear the previous file list
				self.files = [];
				
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(body, 'text/xml');
				// Get the data from XML
				var results = xmlDoc.evaluate("/MPL/Item", xmlDoc, null, XPathResult.ANY_TYPE, null);

				var infoItem = results.iterateNext();
				while (infoItem) {
					var fileItem = {};
					var fields = xmlDoc.evaluate(".//Field", infoItem, null, XPathResult.ANY_TYPE, null);

					var field = fields.iterateNext();
					while (field) {
						fileItem[field.getAttribute("Name")] = field.childNodes[0].nodeValue;
						field = fields.iterateNext();
					}
					self.files.push(fileItem);

					infoItem = results.iterateNext();
				}

				EventHandler.emit(self, 'FilesChanged');

			} else {
				CF.log("JRiver HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.getArtists = function() {
		CF.request(self.webServiceURL + "Library/Values?Field=Artist", function (status, headers, body) {
			if (status == 200) {
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(body, 'text/xml');
				// Get the data from XML
				var artists = xmlDoc.evaluate("/Response/Item", xmlDoc, null, XPathResult.ANY_TYPE, null);

				var theArtist = artists.iterateNext();
				while (theArtist) {
					self.artists.push(theArtist.textContent);
					theArtist = artists.iterateNext();
				}

				EventHandler.emit(self, 'ArtistsChanged');

			} else {
				CF.log("JRiver HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.setVolume = function(level, relative, zone) {
		zone = (zone === undefined) ? -1 : zone;
		relative = (relative === undefined) ? "" : "&Relative="+relative;

		if (level < -1) {
			level = -1;
		} else if (level > 1) {
			level = 1;
		}

		CF.request(self.webServiceURL + "Playback/Volume?Zone=" + zone + "&Level=" + level + relative, function(status, headers, body) {
			if (status == 200) {
				// Parse the volume level feedback
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(body, 'text/xml');
				// Get the data from XML
				var theZone = self.getZoneByID(zone);
				if (theZone) {
					theZone.info["Volume"] = xmlDoc.evaluate("/Response/Item[@Name='Level']", xmlDoc, null, XPathResult.NUMBER_TYPE, null).numberValue;
					EventHandler.emit(theZone, 'VolumeChanged');
				} else {
					CF.log("Zone could not be retrieved: " + zone);
				}
			} else {
				CF.log("An error occured performing the Playback command '" + theEventURL + "'.\nResponse code was '" + status + "'.");
			}
		});
	};

	self.doPlayback = function(theEventURL, zone) {
		zone = (zone == undefined) ? -1 : zone;

		CF.request(self.webServiceURL + "Playback/" + theEventURL + "?Zone=" + zone, function(status) {
			// Dont need to process response body for basic playback commands, just check if it was successful.	
			if (status != 200) {
				CF.log("An error occured performing the Playback command '" + theEventURL + "'.\nResponse code was '" + status + "'.");
			}
		});

	};

	return self;
};

var JRiver = {
	accessKey: "", // Get this from JRiver > Tools > Options > Media Network > Tick first box, click second item to generate (or right click to copy the key)
	lookupAddress: "http://webplay.jriver.com/libraryserver/lookup?id=", // Append accessKey to this URL to find any JRiver media servers publishing their access
	eventCallbacks: {
		"PlayerDiscovered" : [],
		"GroupsChanged" : [],
	},
	player: new JRiverPlayer(),

	init: function(accessKey) {
		CF.log("JRiver: init()");

		JRiver.accessKey = (accessKey !== undefined) ? accessKey : JRiver.accessKey;

		if (JRiver.accessKey == "") {
			CF.log("Please enter your Access Key");
			return;
		}

		CF.request(JRiver.lookupAddress + JRiver.accessKey, function (status, headers, body) {
			if (status == 200) {
				// Read the XML data
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(body, 'text/xml');
				// Get the data from XML
				var port = xmlDoc.getElementsByTagName("port")[0].childNodes[0].nodeValue;
				var ip = xmlDoc.getElementsByTagName("localiplist")[0].childNodes[0].nodeValue;
				var mac = xmlDoc.getElementsByTagName("macaddresslist")[0].childNodes[0].nodeValue;

				// Create the new player object
				JRiver.player = new JRiverPlayer({ipAddress: ip, port: port, macAddress: mac});
				// Let any event listeners know about the new player discovery
				EventHandler.emit(JRiver, 'PlayerDiscovered');
				// Get the configuration details of the discovered player
				JRiver.player.getConfiguration();
			}
		});
	}

};

CF.modules.push({
	name: "JRiver",	// the name of the module (mostly for display purposes)
	object: JRiver,	// the object to which the setup function belongs ("this")
	version: 1.0	// An optional module version number that is displayed in the Remote Debugger
});