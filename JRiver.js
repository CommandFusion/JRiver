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
		playlist: [],
		eventCallbacks: {
			"InfoChanged" : [],
			"VolumeChanged" : [],
			"PlaylistChanged" : [],
		},
	};

	self.init = function() {
		// Start polling the zone for its status info
		self.getInfo();
		self.pollingID = setInterval(self.getInfo, self.pollingRate);
	};

	self.stopPolling = function() {
		if (self.pollingID) {
			clearInterval(self.pollingID);
		}
	};

	self.getInfo = function() {
		CF.request(JRiver.player.webServiceURL + "Playback/Info?Token=" + JRiver.player.authToken + "&Zone=" + self.id, function (status, headers, body) {
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
			} else {
				CF.log("JRiver Playback/Info HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.getPlaylist = function() {
		CF.request(JRiver.player.webServiceURL + "Playback/Playlist?Token=" + JRiver.player.authToken + "&Zone=" + self.id, function (status, headers, body) {
			if (status == 200) {
				// Clear the previous playlist
				self.playlist = [];
				
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
					self.playlist.push(fileItem);

					infoItem = results.iterateNext();
				}

				EventHandler.emit(self, 'PlaylistChanged');

			} else {
				CF.log("JRiver Playback/Playlist HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.playByKey = function(key) {
		CF.request(JRiver.player.webServiceURL + "Playback/PlayByKey?Token=" + JRiver.player.authToken + "&Zone=" + self.id + "&Key=" + key, function (status, headers, body) {
			if (status != 200) {
				CF.log("JRiver Playback/PlayByKey HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.playByIndex = function(index) {
		CF.request(JRiver.player.webServiceURL + "Playback/PlayByIndex?Token=" + JRiver.player.authToken + "&Zone=" + self.id + "&Index=" + index, function (status, headers, body) {
			if (status != 200) {
				CF.log("JRiver Playback/PlayByIndex HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.setPosition = function(pos, relative) {
		pos = (pos === undefined) ? 0 : pos; // Default to start of track
		relative = (relative === undefined) ? 0 : relative; // Default to not-relative (position given in ms)

		CF.request(JRiver.player.webServiceURL + "Playback/Position?Token=" + JRiver.player.authToken + "&Zone=" + self.id + "&Position=" + pos + "&Relative=" + relative, function (status, headers, body) {
			if (status == 200) {
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(body, 'text/xml');
				// Get the data from XML
				CF.log("Position: " + xmlDoc.evaluate("//Item[@Name='Position']", xmlDoc, null, XPathResult.NUMBER_TYPE, null).numberValue);
			} else {
				CF.log("JRiver Playback/Position HTTP Request failed with status " + status + ".");
			}
		});
	};

	return self;
};

var JRiverPlayer = function(params) {
	params = params || {};

	var self = {
		authToken: null,
		username: params.username,
		password: params.password,
		ipAddress: params.ipAddress || null,
		macAddress: params.macAddress || null,
		port: params.port || 52199,
		webServiceURL: "http://" + params.ipAddress + ":" + (params.port || 52199) + "/MCWS/v1/",
		programVersion: null,
		RuntimeGUID: null,
		zones: [],
		currentZoneName: "",
		currentZoneID: 0,
		currentBrowseID: 0,
		browsing: {
			"id": 0,
			"title": "Menu",
			"path": "Menu",
			"items": []
		},
		files: [],
		eventCallbacks: {
			"ZonesChanged" : [],
			"CurrentZoneChanged" : [],
			"PlaybackStateChanged" : [],
			"ConfigurationChanged" : [],
			"BrowseChanged" : [],
			"FilesChanged" : [],
			"ShuffleChanged" : [],
			"RepeatChanged" : [],
		},
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
				// Now authenticate
				self.authenticate();
			} else {
				CF.log("JRiver Alive HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.authenticate = function() {
		var headers = {};
		if (self.username && self.password) {
			// login credentials provided, so send them as basic auth
			headers["Authorization"] = "Basic " + btoa(self.username + ":" + self.password);
		}
		CF.request(self.webServiceURL + "Authenticate", headers, function (status, headers, body) {
			if (status == 200) {
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(body, 'text/xml');
				// Get the data from XML
				self.authToken = xmlDoc.evaluate("//Item[@Name='Token']", xmlDoc, null, XPathResult.STRING_TYPE, null).stringValue;
				// Test streaming playback - TODO - THIS WORKS :)
				//CF.setJoin("s99", "http://192.168.0.10:52199/Gizmo/MCWS/v1/File/GetFile?File=4084&Conversion=WebPlay&Playback=1&Token=" + self.authToken);
				// Now get list of zones
				self.getZones();
				// Start browsing the player library
				self.browse();
			} else {
				CF.log("JRiver Authentication failed with status " + status + ".");
			}
		});
	};

	self.getZones = function() {
		CF.request(self.webServiceURL + "Playback/Zones?Token=" + self.authToken, function (status, headers, body) {
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
					// Get the playlist for the zone
					newZone.getPlaylist();

					if (newZone.id == self.currentZoneID) {
						self.currentZoneName = newZone.name;
					}

					// Add the zone to the player object
					self.zones.push(newZone);
				}

				EventHandler.emit(self, 'ZonesChanged');

			} else {
				CF.log("JRiver Playback/Zones HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.getCurrentZone = function() {
		return self.getZoneByID(self.currentZoneID);
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
		CF.request(self.webServiceURL + "Playback/SetZone?Token=" + self.authToken + "&Zone=" + id, function (status, headers, body) {
			if (status == 200) {
				var theZone = self.getZoneByID(id);
				self.currentZoneID = id;
				self.currentZoneName = theZone.name;
				EventHandler.emit(self, 'CurrentZoneChanged');
				// Update UI with the selected zone info
				theZone.getInfo();
			} else {
				CF.log("JRiver Playback/SetZone HTTP Request failed with status " + status + ".");
			}
		});		
	};

	self.browseBack = function() {
		var browseItem = self.getBrowseItemByID(self.currentBrowseID);
		if (browseItem.depth >= 2) {
			self.browse(self.getBrowseItemByID(self.currentBrowseID).parent);
		}
	};

	self.getBrowseItemByID = function(id, obj, depth) {
		obj = obj || self.browsing;
		if (typeof depth == 'number') {
			depth++;
		} else {
			depth = 0;
		}
		if (id == 0) {
			self.browsing["depth"] = depth;
			return self.browsing;
		}
		for (var key in obj) {
			var elem = obj[key];
			if (elem.id == id) {
				elem["depth"] = depth;
				return elem;
			} else if (typeof elem === "object") {
				if (elem.items) {
					elem = elem.items;
				}
				var found = self.getBrowseItemByID(id, elem, depth);
				if (found) {
					return found;
				}
			}
		}
		return;
	};

	self.browse = function(id, skip) {
		id = id || 0;
		// Get the browse history
		var browseItem = self.getBrowseItemByID(id);
		if (!browseItem) {
			CF.log("Unable to find browse parent!");
			return;
		}

		// Update the browse ID only if we are browsing the content, not the main menus
		if (browseItem.depth >= 2) {
			self.currentBrowseID = id;
		}

		// Check if the browsing items already exist, and just use existing items
		if (browseItem.items.length < 1) {

			CF.request(self.webServiceURL + "Browse/Children?Token=" + self.authToken + "&id=" + id, function (status, headers, body) {
				if (status == 200) {		
					var parser = new DOMParser();
					var xmlDoc = parser.parseFromString(body, 'text/xml');
					// Get the data from XML
					var results = xmlDoc.evaluate("/Response/Item", xmlDoc, null, XPathResult.ANY_TYPE, null);

					var infoItem = results.iterateNext();
					while (infoItem) {
						browseItem.items.push({id: infoItem.childNodes[0].nodeValue,
							"title": infoItem.getAttribute("Name"),
							"parent": id,
							"path": browseItem.path + JRiver.navSeparator + infoItem.getAttribute("Name").replace(JRiver.navSeparator, " "), // Make sure the item title doesnt contain any path separators
							"items": []
						});
						infoItem = results.iterateNext();
					}

					EventHandler.emit(self, 'BrowseChanged', browseItem);

					if (!browseItem.items.length) {
						// No items to browse for this ID, so get a file list instead
						self.getFiles(id, 0, browseItem);
					}

				} else {
					CF.log("JRiver HTTP Request failed with status " + status + ".");
				}
			});
		} else {
			// Use existing browse items
			EventHandler.emit(self, 'BrowseChanged', browseItem);
		}
	};

	self.getFiles = function(id, skip, browseItem) {
		var urlID = (id !== undefined) ? "&id=" + id : "";
		CF.request(self.webServiceURL + "Browse/Files?Token=" + self.authToken + urlID, function (status, headers, body) {
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

				EventHandler.emit(self, 'FilesChanged', browseItem || self.getBrowseItemByID(id));

			} else {
				CF.log("JRiver HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.getArtists = function() {
		CF.request(self.webServiceURL + "Library/Values?Token=" + self.authToken + "&Field=Artist", function (status, headers, body) {
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

		CF.request(self.webServiceURL + "Playback/Volume?Token=" + self.authToken + "&Zone=" + zone + "&Level=" + level + relative, function(status, headers, body) {
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
				CF.log("An error occured performing the Volume command '" + theEventURL + "'.\nResponse code was '" + status + "'.");
			}
		});
	};

	self.doPlayback = function(theEventURL, zone) {
		zone = (zone == undefined) ? -1 : zone;

		CF.request(self.webServiceURL + "Playback/" + theEventURL + "?Token=" + self.authToken + "&Zone=" + zone, function(status) {
			// Dont need to process response body for basic playback commands, just check if it was successful.	
			if (status != 200) {
				CF.log("An error occured performing the Playback command '" + theEventURL + "'.\nResponse code was '" + status + "'.");
			}
		});
	};

	self.doMCC = function(command, param, zone) {
		if (!command) {
			CF.log("No MCC command given.");
			return;
		}
		param = param || 0;
		zone = zone || -1;

		CF.request(self.webServiceURL + "Control/MCC?Token=" + self.authToken + "&Zone=" + zone + "&Command=" + command + "&Parameter=" + param, function(status) {
			// Dont need to process response body, just check if it was successful.	
			if (status != 200) {
				CF.log("An error occured performing the Control/MCC command '" + theEventURL + "'.\nResponse code was '" + status + "'.");
			}
		});
	};

	self.setPositionBySlider = function(pos, max, zoneID) {
		if (pos === undefined) return;
		max = max || 100; // Default to 0-100 range
		zoneID = zoneID || self.currentZoneID;
		var theZone = self.getZoneByID(zoneID);
		if (!theZone) {
			CF.log("The zone could not be located: " + zoneID);
			return;
		}

		if (theZone.info.DurationMS > 0) {
			pos = Math.round((theZone.info.DurationMS / max) * pos);
			CF.log("Set Pos: " + pos + ", max: " + theZone.info.DurationMS);
			theZone.setPosition(pos);
		}
	};

	self.setShuffle = function(mode) {
		mode = (mode === undefined) ? 0 : mode; // Default to toggle mode

		CF.request(self.webServiceURL + "Control/MCC?Token=" + self.authToken + "&Command=10005&Parameter=" + mode, function(status) {
			// Dont need to process response body, just check if it was successful.	
			if (status == 200) {
				EventHandler.emit(self, 'ShuffleChanged', mode);
			} else {
				CF.log("An error occured performing the Control/MCC Shuffle command '" + theEventURL + "'.\nResponse code was '" + status + "'.");
			}
		});
	};

	self.setRepeat = function(mode) {
		mode = (mode === undefined) ? 0 : mode; // Default to toggle mode

		CF.request(self.webServiceURL + "Control/MCC?Token=" + self.authToken + "&Command=10006&Parameter=" + mode, function(status) {
			// Dont need to process response body, just check if it was successful.	
			if (status == 200) {
				EventHandler.emit(self, 'RepeatChanged', mode);
			} else {
				CF.log("An error occured performing the Control/MCC Repeat command '" + theEventURL + "'.\nResponse code was '" + status + "'.");
			}
		});
	};

	return self;
};

var JRiver = {
	navSeparator: " > ",
	accessKey: "", // Get this from JRiver > Tools > Options > Media Network > Tick first box, click second item to generate (or right click to copy the key)
	username: undefined,
	password: undefined,
	lookupAddress: "http://webplay.jriver.com/libraryserver/lookup?id=", // Append accessKey to this URL to find any JRiver media servers publishing their access
	eventCallbacks: {
		"PlayerDiscovered" : [],
		"GroupsChanged" : [],
	},
	player: new JRiverPlayer(),

	init: function(accessKey, username, password) {
		CF.log("JRiver: init()");

		JRiver.accessKey = (accessKey !== undefined) ? accessKey : JRiver.accessKey;
		JRiver.username = (username !== undefined) ? username : JRiver.username;
		JRiver.password = (password !== undefined) ? password : JRiver.password;

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
				JRiver.player = new JRiverPlayer({ipAddress: ip, port: port, macAddress: mac, username: JRiver.username, password: JRiver.password});
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