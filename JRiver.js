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
	},

	clear: function(obj, type) {
		if (!type) {
			// Clear all events for this object
			for (var type in obj.eventCallbacks) {
				EventHandler.clear(obj, type);
			}

		} else {
			// Clear all listeners for specific object and event type
			if (!obj.eventCallbacks[type]) {
				CF.log("Attempted clear of undefined event - '" + type + "'.");
				return false;
			}

			obj.eventCallbacks[type] = [];
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
		nowPlayingIndex: 0,
		eventCallbacks: {
			"InfoChanged" : [],
			"VolumeChanged" : [],
			"PlaylistChanged" : [],
			"PlaylistPositionChanged" : [],
		},
	};

	self.init = function() {
		// Start polling the zone for its status info
		self.getInfo();
		self.pollingID = setInterval(self.getInfo, self.pollingRate);
		self.getPlaylistQuick();
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

				// Get the serialized playlist info to check now playing list data
				self.getPlaylistQuick();
			} else {
				CF.log("JRiver Playback/Info HTTP Request failed with status " + status + ".");
			}
		});
	};

	self.getPlaylist = function() {
		CF.request(JRiver.player.webServiceURL + "Playback/Playlist?Token=" + JRiver.player.authToken + "&Zone=" + self.id + "&NoLocalFilenames=1", function (status, headers, body) {
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

	self.getPlaylistQuick = function() {
		CF.request(JRiver.player.webServiceURL + "Playback/Playlist?Token=" + JRiver.player.authToken + "&Zone=" + self.id + "&Action=Serialize", function (status, headers, body) {
			if (status == 200) {
				// Reply format: http://yabb.jriver.com/interact/index.php?topic=61902.0;wap2
				var data = body.split(";");
				// Check if there is anything at all in the playlist
				if (data.length < 4) {
					// Nothing in the list, clear the now playing list
					self.playlist = [];
					self.nowPlayingIndex = 0;
					EventHandler.emit(self, 'PlaylistChanged');
					return;
				}
				self.nowPlayingIndex = data[2];
				// Check if the current playlist array is a different length than the returned playlist length
				if (self.playlist.length != data[1]) {
					// Get the full playlist data again because the playlist has changed length
					self.getPlaylist();
				} else {
					// Just update the currently playing indicator in the now playing list
					EventHandler.emit(self, 'PlaylistPositionChanged', self.nowPlayingIndex);
				}
			} else {
				CF.log("JRiver Playback/Playlist Serialize HTTP Request failed with status " + status + ".");
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
				//CF.log("Position: " + xmlDoc.evaluate("//Item[@Name='Position']", xmlDoc, null, XPathResult.NUMBER_TYPE, null).numberValue);
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
		authToken: "",
		auth: false,
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
		selectedID: 0,
		selectedKey: 0,
		browsing: {
			"id": 0,
			"title": "Menu",
			"path": "Menu",
			"items": []
		},
		searchResults: [],
		mediaType: "",
		mediaSubType: "",
		browseField: "",
		files: [],
		eventCallbacks: {
			"PlayerAuthorized" : [],
			"ZonesChanged" : [],
			"CurrentZoneChanged" : [],
			"PlaybackStateChanged" : [],
			"ConfigurationChanged" : [],
			"BrowseChanged" : [],
			"FilesChanged" : [],
			"ShuffleChanged" : [],
			"RepeatChanged" : [],
			"SearchResultsChanged" : [],
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
				self.auth = true;
		
				// Test streaming playback - TODO - THIS WORKS :)
				//CF.setJoin("s99", "http://192.168.0.10:52199/Gizmo/MCWS/v1/File/GetFile?File=4084&Conversion=WebPlay&Playback=1&Token=" + self.authToken);

				// Now get list of zones from JRiver API
				self.getZones();
				// Start browsing the player library
				self.browse();
				EventHandler.emit(self, "PlayerAuthorized", true);
			} else {
				CF.log("JRiver Authentication failed with status " + status + ".");
				self.auth = false;
				JRiver.configurePlayer(JRiver.selectedServer);
				EventHandler.emit(self, "PlayerAuthorized", false);
			}
		});
	};

	self.getZones = function() {
		// Get list of zones for the player
		CF.request(self.webServiceURL + "Playback/Zones?Token=" + self.authToken, function (status, headers, body) {
			// Clear zones array
			self.zones = [];
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

		if (browseItem.depth >= 2) { 			// Update the browse ID only if we are browsing the content, not the main menus
			self.currentBrowseID = id;
		} else if (browseItem.depth == 1) { 	// Update media type being browsed
			self.mediaType = browseItem.title;
			self.mediaSubType = "";
		} else if (browseItem.depth == 2) { 	// Update browse filter
			switch(self.mediaType) {
				case "Audio" :
					if (browseItem.title == "Artist" || browseItem.title == "Album" || browseItem.title == "Genre" || browseItem.title == "Composer") {
						self.browseField = browseItem.title;
					} else {
						self.browseField = "Artist,Album,Name";
					}
					break;
				case "Video" :
					if (browseItem.title == "Movies") {
						self.mediaSubType = "Movie";
						self.browseField = "Name";
					} else if (browseItem.title == "Shows") {
						self.mediaSubType = "TV Show";
						self.browseField = "Series,Name";
					} else if (browseItem.title == "Home Videos") {
						self.mediaSubType = "Home Video";
						self.browseField = "Name";
					} else {
						self.mediaSubType = "";
						self.browseField = "Name";
					}
					break;
			}
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

	self.search = function(query) {
		var files;
		if (self.mediaSubType) {
			files = "[Media Sub Type]=[" + self.mediaSubType + "]";
		} else if (self.mediaType) {
			files = "[Media Type]=[" + self.mediaType + "]";
		}
		var url = self.webServiceURL + "Library/Values?Token=" + self.authToken + "&Filter=" + encodeURIComponent(query) + "&Field=" + encodeURIComponent(self.browseField) +  "&Files=" + encodeURIComponent(files);
		//CF.log("SEARCH REQUEST: " + url);

		CF.request(url, function (status, headers, body) {
			if (status == 200) {
				var parser = new DOMParser();
				var xmlDoc = parser.parseFromString(body, 'text/xml');
				// Get the data from XML
				var items = xmlDoc.evaluate("/Response/Item", xmlDoc, null, XPathResult.ANY_TYPE, null);

				var item = items.iterateNext();
				self.searchResults = [];
				var fields = self.browseField.split(",");
				while (item) {
					var type = item.getAttribute("Name");
					if (fields.indexOf(type) >= 0) {
						self.searchResults.push({type: type, value: item.textContent});
					}
					item = items.iterateNext();
				}

				EventHandler.emit(self, 'SearchResultsChanged', query);

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
			//CF.log("Set Pos: " + pos + ", max: " + theZone.info.DurationMS);
			theZone.setPosition(pos);
		}
	};

	self.setShuffle = function(mode) {
		mode = (mode === undefined) ? 0 : mode; // Default to toggle mode

		CF.request(self.webServiceURL + "Control/MCC?Token=" + self.authToken + "&Command=10005&Parameter=" + mode, function(status) {
			// Dont need to process response body, just check if it was successful.	
			if (status == 200) {
				EventHandler.emit(self, 'ShuffleChanged', mode);
				self.getCurrentZone().playlist = [];
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

	self.doPlayByKey = function(key, location, album, zoneID) {
		location = location || "";
		zoneID = zoneID || self.currentZoneID;
		CF.request(self.webServiceURL + "Playback/PlayByKey?Token=" + self.authToken + "&Key=" + key + "&Location=" + location, function(status) {
			// Dont need to process response body, just check if it was successful.	
			if (status == 200) {
				// Get the playlist again, because it would have changed
				self.getCurrentZone().getPlaylist();
			} else {
				CF.log("An error occured performing the 'Playback/PlayByKey?Token=" + self.authToken + "&Key=" + key + "&Location=" + location + "' command.\nResponse code was '" + status + "'.");
			}
		});
	};

	self.doPlayByBrowseID = function(id, mode, zoneID) {
		mode = mode || "";
		zoneID = zoneID || self.currentZoneID;
		CF.request(self.webServiceURL + "Browse/Files?Token=" + self.authToken + "&ID=" + id + "&Action=Play&PlayMode=" + mode, function(status) {
			// Dont need to process response body, just check if it was successful.	
			if (status == 200) {
				// Get the playlist again, because it would have changed
				self.getCurrentZone().getPlaylist();
			} else {
				CF.log("An error occured performing the 'Browse/Files?Token=" + self.authToken + "&ID=" + id + "&Action=Play&PlayMode=" + mode + "' command.\nResponse code was '" + status + "'.");
			}
		});
	};

	self.doPlayOption = function(mode) {
		if (self.selectedKey) {
			self.selectItem(self.selectedKey, mode);
			return;
		}
		switch (mode) {
			case 1: // Play Now and Clear
				self.doPlayByBrowseID(JRiver.player.selectedID);
				break;
			case 2: // Play Next
				self.doPlayByBrowseID(JRiver.player.selectedID, 'NextToPlay');
				break;
			case 3: // Append to Playlist
				self.doPlayByBrowseID(JRiver.player.selectedID, 'Add');
				break;
			default: // Play Now without clearing
				self.doPlayByBrowseID(JRiver.player.selectedID, 'NextToPlay');
				self.doPlayback("Next");
				break;
		}
		//self.doMCC(10001); // PLAY
	};

	self.selectItem = function(key, mode) {
		mode = mode || JRiver.settings.selectionMode;
		switch(mode) {
			case 1:
				self.doPlayByKey(key);
				break;
			case 2:
				self.doPlayByKey(key, "Next");
				break;
			case 3:
				self.doPlayByKey(key, "End");
				break;
			default:
				self.doPlayByKey(key, "Next");
				self.doPlayback("Next");
				break;
		}
	};

	return self;
};

var JRiver = {
	ST_Server: "urn:schemas-upnp-org:device:X-JRiver-Library-Server:1",
	navSeparator: " > ",
	settings: {
		trackMode: 0, // Default to show track numbers as their playlist number
		selectionMode: 0,
		disableSleep: 0,
		volumeButtons: 0,
		viewMode: 0,
	},
	//lookupAddress: "http://webplay.jriver.com/libraryserver/lookup?id=", // Append accessKey to this URL to find any JRiver media servers publishing their access
	eventCallbacks: {
		"PlayerDiscovered" : [],
		"ZoneDiscovered" : [],
		"PlayerSelected" : [],
		"ConfigurePlayer" : [],
		"SettingsChanged" : [],
		"GroupsChanged" : [],
	},
	servers: [],
	selectedServer : null,
	configuringServer: null,
	player: new JRiverPlayer(),

	init: function(servers) {
		//CF.log("JRiver: init()");

		/*
		OLD METHOD FOR DISCOVERING JRIVER USING JRIVER WEB API WHICH REQUIRED INTERNET CONNECTIVITY
		REPLACED THIS METHOD WITH DLNA DISCOVERY
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
		*/

		// Listens for DLNA responses from and processes them
		CF.watch(CF.FeedbackMatchedEvent, "DLNA Discovery", "Discovery Feedback", function(regex, data) {

			//CF.log("DLNA Discovery Feedback:\n" + data);
			
			var deviceResponse = {};
			// Split each line of data
			var headers = data.split("\r\n");
			for (var i=0; i<headers.length - 1; i++) {
				// Split the header name from the data - some responses won't have space after the colon, so we can't rely on that to split the data.
				// Instead, split it all up using colons then join the data back if there were colons in the actual data.
				var headerData = headers[i].split(":");
				// Make sure the line was header data, skip HTTP Response, etc, that only have data (no header name).
				if (headerData.length>1) {
					// trim any spaces from the data, and join it all up if it contained colons (which we previously split)
					deviceResponse[headerData[0].toUpperCase()] = trim(headerData.slice(1).join(":"));
				}
			}

			if (deviceResponse["ST"] == JRiver.ST_Server) {
				//CF.log("FOUND JRIVER SERVER - " + deviceResponse["LOCATION"]);
				// Now retrieve the device description from it's XML if one was given
				if (deviceResponse["LOCATION"]) {
					CF.request(deviceResponse["LOCATION"], function(status, headers, body) {
						if (status == 200) {
							// Read the XML data
							var parser = new DOMParser();
							var xmlDoc = parser.parseFromString(body, 'text/xml');
							deviceResponse.NAME = xmlDoc.getElementsByTagName("friendlyName")[0].childNodes[0].nodeValue;
							deviceResponse.KEY = xmlDoc.getElementsByTagName("accessKey")[0].childNodes[0].nodeValue;
							deviceResponse.IP = /([0-9]+(?:\.[0-9]+){3})/.exec(deviceResponse["LOCATION"])[1];
							deviceResponse.PORT = /:([0-9]+)/.exec(deviceResponse["LOCATION"])[1];
							deviceResponse.username = "";
							deviceResponse.password = "";
							if (!JRiver.getPlayerByNameIP(deviceResponse.NAME, deviceResponse.IP)) {
								JRiver.servers.push(deviceResponse);
								EventHandler.emit(JRiver, "PlayerDiscovered", deviceResponse);
							} else {
								CF.log("Server already discovered or loaded from memory: " + deviceResponse.NAME + " - " + deviceResponse.IP);
							}
						} else {
							CF.log("An error occured requesting the DeviceInfo XML.\nResponse code was '" + status + "'.");
						}
					});
				}
			}
		});

		// Manage subscriptions when the app is not in use
		CF.watch(CF.GUISuspendedEvent, JRiver.onGUISuspended);
		CF.watch(CF.GUIResumedEvent, JRiver.onGUIResumed);

		if (servers != "") {
			JRiver.servers = JSON.parse(servers);
			for (var i in JRiver.servers) {
				JRiver.servers[i].auth = false;
				EventHandler.emit(JRiver, "PlayerDiscovered", JRiver.servers[i]);
				if (JRiver.servers[i].selected) {
					JRiver.selectPlayer(JRover.servers[i]);
				}
			}
		}

		// Send the discovery request
		JRiver.discoverPlayers();
	},

	discoverPlayers: function(clearDiscovered) {
		if (clearDiscovered) {
			JRiver.servers = [];
		}
		setTimeout(function() {
			// Only want to discover JRiver servers, which are ST: urn:schemas-upnp-org:device:X-JRiver-Library-Server:1
			CF.send("DLNA Discovery", "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 3\r\nST:"+JRiver.ST_Server+"\r\n\r\n");
		}, 500);
	},

	// Select one of the discovered servers, by its index in the servers array
	selectPlayerByIndex: function(index) {
		JRiver.selectPlayer(JRiver.servers[index]);
	},

	selectPlayer: function(server) {
		// Only create a new player object if the previous player object was different
		if (JRiver.player.ipAddress != server.IP || JRiver.player.port != server.PORT || !JRiver.player.auth) {
			if (JRiver.selectedServer !== null) {
				// Mark the player as not selected
				JRiver.selectedServer.selected = false;
			}
			JRiver.selectedServer = server;
			JRiver.selectedServer.selected = true;
			// Clear event listeners for previously selected player
			EventHandler.clear(JRiver.player);
			// Create the new player object
			JRiver.player = new JRiverPlayer({ipAddress: server.IP, port: server.PORT, username: server.username, password: server.password});
			// Let any event listeners know about the new player discovery
			EventHandler.emit(JRiver, 'PlayerSelected');
		}
		// Get the configuration details of the discovered player
		JRiver.player.getConfiguration();
	},

	// Configure one of the discovered servers, by its index in the servers array
	configurePlayerByIndex: function(index) {
		JRiver.configuringServer = JRiver.servers[index];
		if (JRiver.configuringServer) {
			// Emit event to setup the UI for configuration of the selected server
			EventHandler.emit(JRiver, 'ConfigurePlayer');
		} else {
			CF.log("Player could not be selected by index: " + index);
		}
	},

	configurePlayer: function(player) {
		JRiver.configuringServer = player;
		// Emit event to setup the UI for configuration of the selected server
		EventHandler.emit(JRiver, 'ConfigurePlayer');	
	},

	selectConfiguredPlayer: function() {
		JRiver.selectPlayer(JRiver.configuringServer);
	},

	getPlayerByNameIP: function(name, ip) {
		for (var i in JRiver.servers) {
			if (JRiver.servers[i].NAME == name && JRiver.servers[i].IP == ip) {
				return JRiver.servers[i];
			}
		}
		return null;
	},


	onGUISuspended: function() {
		// Even though the call is not executed immediately, it is enqueued for later processing:
		// the displayed date will be the one generated by the time the app was suspended
		CF.log("GUI suspended at " + (new Date()));

		// Save connection details
		CF.setToken(CF.GlobalTokensJoin, "servers", JSON.stringify(JRiver.servers));
	},

	onGUIResumed: function() {
		// Show the time at which the GUI was put back to front
		CF.log("GUI resumed at " + (new Date()));
	},

	setTrackMode: function(mode) {
		JRiver.settings.trackMode = mode;
		EventHandler.emit(JRiver, "SettingsChanged");
	},

	setSelectionMode: function(mode) {
		JRiver.settings.selectionMode = mode;
		EventHandler.emit(JRiver, "SettingsChanged");
	},

	setViewMode: function(mode) {
		JRiver.settings.viewMode = mode;
		EventHandler.emit(JRiver, "SettingsChanged");
		if (JRiver.player.selectedKey) {
			EventHandler.emit(JRiver.player, "FilesChanged", JRiver.player.getBrowseItemByID(JRiver.player.currentBrowseID));
		} else{
			EventHandler.emit(JRiver.player, "BrowseChanged", JRiver.player.getBrowseItemByID(JRiver.player.currentBrowseID));
		}
	}
};

CF.modules.push({
	name: "JRiver",	// the name of the module (mostly for display purposes)
	object: JRiver,	// the object to which the setup function belongs ("this")
	version: 1.0	// An optional module version number that is displayed in the Remote Debugger
});

function trim (str) {
	var	str = str.replace(/^\s\s*/, ''),
		ws = /\s/,
		i = str.length;
	while (ws.test(str.charAt(--i)));
	return str.slice(0, i + 1);
}