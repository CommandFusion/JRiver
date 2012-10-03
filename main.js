var posSliderPressed = false,
	volSliderPressed = false,
	searchID;

CF.userMain = function() {
	// Get username, password, authkey from token storage
	CF.getJoin(CF.GlobalTokensJoin, function (j,v,t) {
		// "cYDGjk"
		JRiver.init(t["servers"]);
		if (t["settings"] != "") {
			JRiver.settings = JSON.parse(t["settings"]);
		}
		updateSettingsUI();
	});

	// Enable the status bar
	CF.setJoin("d17931", 1);

	// Move the zone subpage slightly off screen
	// can't do it at design time because the shadow is too large.
	// Also hide the back buttons on startup
	CF.setProperties([{join: "d1", x: 746},{join: "d9", x: 490},{join: "d2", opacity: 0.0},{join: "d3", opacity: 0.0}]);

	// Show the help subpage
	CF.setJoin("d998", 1);

	// Listen to volume and position slider press and release events, disable slider updating whilst its being dragged
	CF.watch(CF.ObjectPressedEvent, "a1", function() {
		volSliderPressed = true;
	});
	CF.watch(CF.ObjectReleasedEvent, "a1", function() {
		volSliderPressed = false;
	});
	CF.watch(CF.ObjectPressedEvent, "a2", function() {
		posSliderPressed = true;
	});
	CF.watch(CF.ObjectReleasedEvent, "a2", function() {
		posSliderPressed = false;
	});

	// Watch the speed scroll slider events (the dots next to the main list in the UI)
	CF.watch(CF.ObjectPressedEvent, "a3", function(j,v) {
		// Get the list size
		CF.listInfo("l3", function(list, count, first, numVisible, scrollPosition) {
			// Scroll to the relavent position based on slider pos
			CF.listScroll("l3", Math.ceil((count / 65535) * v), CF.MiddlePosition, false);
		});
	});
	CF.watch(CF.ObjectDraggedEvent, "a3", function(j,v) {
		// Get the list size
		CF.listInfo("l3", function(list, count, first, numVisible, scrollPosition) {
			// Scroll to the relavent position based on slider pos
			CF.listScroll("l3", Math.ceil((count / 65535) * v), CF.MiddlePosition, false);
		});
	});

	// Watch events for change of username and password in settings
	CF.watch(CF.InputFieldEditedEvent, "s910", function(j,v) {
		JRiver.configuringServer.username = v;
	});

	// Watch events for change of username and password in settings
	CF.watch(CF.InputFieldEditedEvent, "s911", function(j,v) {
		JRiver.configuringServer.password = v;
	});

	// Watch events for change of search query
	CF.watch(CF.InputFieldEditedEvent, "s4", function(j,v) {
		// Perform search only after finished editing by using a delay with setTimeout method

		// Cancel the previous search delay
		clearTimeout(searchID);
		// Perform the next search
		//searchID = setTimeout(function(){ JRiver.player.search(v); }, 500);
		// Just search the browsing content
		searchID = setTimeout(function(){ BrowseChanged(JRiver.player, null, v); }, 500);
	});

	EventHandler.on(JRiver, 'PlayerDiscovered', function(jr, server) {
		//CF.log("Player Discovered: " + server.IP);
		CF.listAdd("l999", [
			{
				"subpage": "sidebar_listitem_arrow",
				"s100001": server.NAME,
				"d100001": {
					tokens: {
						"NAME": server.NAME,
						"IP": server.IP
					}
				}
			}
		]);
	});

	// Watch the settings changed event and update the settings UI when notified
	EventHandler.on(JRiver, 'SettingsChanged', updateSettingsUI);

	EventHandler.on(JRiver, 'ConfigurePlayer', function() {
		CF.setJoins([
			{ join: "s910", value: JRiver.configuringServer.username },
			{ join: "s911", value: JRiver.configuringServer.password },
			{ join: "s901", value: JRiver.configuringServer.NAME },
			{ join: "s902", value: JRiver.configuringServer.IP },
			{ join: "d996", value: 0 }, // Hide the options subpage
			{ join: "d997", value: 0 }, // Hide the help screenshot subpage
			{ join: "d998", value: 0 }, // Hide the help subpage
			{ join: "d999", value: 1 }, // Show the settings subpage
			{ join: "s999", value: "" } // Clear auth error text
		]);
	});

	EventHandler.on(JRiver, 'PlayerSelected', function() {
		//CF.log("JRiver Player Selected: " + JRiver.player.ipAddress);

		// Listen to authorization event for the player
		EventHandler.on(JRiver.player, 'PlayerAuthorized', function(player, authed) {
			CF.log("Player Authorized: " + authed);
			if (authed) {
				CF.setJoin("s999", "");
				CF.flipToPage("Player");
			} else {
				CF.setJoin("s999", "Authorization Failed! Please check your username and password.\nLeave them blank if authorization is not enabled.\nFor more information, press the back button above.");
				CF.flipToPage("Settings");
			}
		});

		// Listen to zone discovery events for the new player
		EventHandler.on(JRiver.player, 'ZonesChanged', function() {
			CF.log(JRiver.player.zones.length);

			// Set the current zone text in GUI
			CF.setJoin("s1", JRiver.player.currentZoneName);

			// Clear and reconstruct the zone list
			var zoneList = [];
			CF.listRemove("l1");
			for (var i=0; i<JRiver.player.zones.length; i++) {
				// Listen to each zone's info status change events
				EventHandler.on(JRiver.player.zones[i], 'InfoChanged', ZoneInfoChanged);
				// Listen to each zone's volume change events
				EventHandler.on(JRiver.player.zones[i], 'VolumeChanged', ZoneVolumeChanged);
				// List to each zone's playlist change events
				EventHandler.on(JRiver.player.zones[i], 'PlaylistChanged', ZonePlaylistChanged);
				// List to each zone's playlist position change events
				EventHandler.on(JRiver.player.zones[i], 'PlaylistPositionChanged', ZonePlaylistPositionChanged);
				// Add each zone to the zone popup list
				zoneList.push({
					s100001: JRiver.player.zones[i].name,
					d100001: {
						tokens: {
							"zoneid": JRiver.player.zones[i].id
						}
					}
				});
			}
			CF.listAdd("l1", zoneList);
		});

		EventHandler.on(JRiver.player, 'CurrentZoneChanged', function() {
			// Set the current zone text in GUI
			CF.setJoin("s1", JRiver.player.currentZoneName);
		});

		EventHandler.on(JRiver.player, 'ShuffleChanged', function(player, mode) {
			// Set the current shuffle state
			CF.setJoins([
				{ join: "d120", value: mode == 3 },
				{ join: "d121", value: (mode == 1 || mode == 2 || mode == 4) },
				{ join: "d122", value: mode == 5 },
				{ join: "d12", value: mode != 3 }
			]);
		});

		EventHandler.on(JRiver.player, 'RepeatChanged', function(player, mode) {
			// Set the current shuffle state
			CF.setJoins([
				{ join: "d123", value: mode == 1 },
				{ join: "d124", value: mode == 2 },
				{ join: "d125", value: mode == 3 },
				{ join: "d126", value: mode == 4 },
				{ join: "d11", value: mode != 1 }
			]);
		});

		EventHandler.on(JRiver.player, 'BrowseChanged', BrowseChanged);

		EventHandler.on(JRiver.player, 'FilesChanged', function(player, browseItem) {
			// Clear the main content list
			CF.listRemove("l3");
			// Update the list title
			CF.setJoin("s3", setBrowsePath(browseItem.path));
			// Update the main content list of data
			var listContent = [];
			var listRow = {};
			for (var i = 0; i < JRiver.player.files.length; i++) {
				var text = JRiver.player.files[i].Name;
				if (JRiver.player.files[i].Track) {
					text = JRiver.player.files[i].Track + ". " + text;
				}
				listContent.push({
					"subpage" : "track_items",
					"s100001" : text,
					"d100001" : {
						tokens: {
							"key": JRiver.player.files[i].Key
						}
					}
				});
			}
			CF.listAdd("l3", listContent);
		});

		EventHandler.on(JRiver.player, 'SearchResultsChanged', function(player, query) {
			// Clear the main content list
			CF.listRemove("l3");
			// Update the list title
			CF.setJoin("s3", "Search Results: " + query);
			// Update the main content list of data
			var listContent = [];
			var listRow = {};
			for (var i = 0; i < JRiver.player.searchResults.length; i++) {
				var theResult = JRiver.player.searchResults[i];
				listContent.push({
					"subpage" : "search_result_item",
					"s100001" : theResult.value,
					"d100001" : {
						tokens: {
							"name": theResult.value
						}
					}
				});
			}
			CF.listAdd("l3", listContent);
		});
	});
};

function BrowseChanged(player, browseItem, query) {
	CF.log(player.currentBrowseID);
	browseItem = browseItem || JRiver.player.getBrowseItemByID(player.currentBrowseID);
	CF.log("BrowseChanged: " + browseItem.title);

	// if the returned data is one of the first two browsing levels
	if (browseItem.depth < 2) {
		// Clear the sidebar list
		CF.listRemove("l2");
		// Update the list title
		CF.setJoin("s2", browseItem.title);
		// Update the sidebar list
		var listContent = [];
		for (item in browseItem.items) {
			listContent.push({
				s100001: browseItem.items[item].title,
				d100001: {
					tokens: {
						"browseid": browseItem.items[item].id
					}
				}
			});
		}
		CF.listAdd("l2", listContent);
	} else {
		// Clear the main content list
		CF.listRemove("l3");
		// Update the list title
		CF.setJoin("s3", setBrowsePath(browseItem.path, 3, query));
		// Update the main content list of data
		var listContent = [];
		var listRow = {};
		var lineItem;
		var i = 0;
		for (item in browseItem.items) {
			if (!query || (browseItem.items[item].title.toLowerCase().indexOf(query.toLowerCase()) >= 0)) {
				if (JRiver.settings.viewMode == 0) { // View cover art tiles
					lineItem = (i % 4) + 1;
					listRow["s10000" + lineItem] = browseItem.items[item].title;
					listRow["s10001" + lineItem] = player.webServiceURL + "Browse/Image?Token=" + player.authToken + "&id=" + browseItem.items[item].id + "&format=png&width=135&height=135&";
					listRow["s10002" + lineItem] = "coverart_blank.png";
					listRow["d10000" + lineItem] = {
						tokens: {
							"browseid": browseItem.items[item].id
						}
					};
					if (lineItem == 4) {
						listContent.push(listRow);
						listRow = {};
					}
					i++;
				} else if (JRiver.settings.viewMode == 1) { // View in grouped list
					listContent.push({
						"subpage" : "list_item_coverart1",
						"s100001" : browseItem.items[item].title,
						"s100002" : player.webServiceURL + "Browse/Image?Token=" + player.authToken + "&id=" + browseItem.items[item].id + "&format=png&width=80&height=80&",
						"s100003" : browseItem.title,
						"d100001" : {
							tokens: {
								"browseid": browseItem.items[item].id
							}
						}
					});
				} else if (JRiver.settings.viewMode == 2) { // View in detailed list
					listContent.push({
						"subpage" : "list_item_detail",
						"s100001" : browseItem.items[item].title,
						"d100001" : {
							tokens: {
								"browseid": browseItem.items[item].id
							}
						}
					});
				}
			}
		}
		if (listRow.hasOwnProperty("s100001")) {
			listContent.push(listRow);
		}
		CF.listAdd("l3", listContent);

		if (browseItem.scrollPos) {
			CF.log("Scroll to: " + browseItem.scrollPos);
			setTimeout(function() {CF.listScroll("l3", browseItem.scrollPos, CF.PixelPosition, false)}, 500);
		}
	}

	if (browseItem.depth > 2) {
		// Show browse back button
		CF.setProperties({join: "d3", opacity: 1});
	} else if (browseItem.depth == 2) {
		// Hide the back button
		CF.setProperties({join: "d3", opacity: 0});
	}

	if (browseItem.depth == 0) {
		// Hide the list back button
		CF.setProperties({join: "d2", opacity: 0});
	} else if (browseItem.depth == 1) {
		// Show the list back button
		CF.setProperties({join: "d2", opacity: 1});
	}
};

function ZoneInfoChanged(theZone) {
	if (theZone.id == JRiver.player.currentZoneID) {
		// Check if track pos slider is being pressed - don't update its value whilst its pressed
		var posSlider;
		if (!posSliderPressed) {
			posSlider = { join: "a2", value: (65535/parseInt(theZone.info["DurationMS"], 10) * parseInt(theZone.info["PositionMS"], 10)) };
		} else {
			posSlider = { join: "a2", value: "[@a2]" };
		}
		// Update current track info
		CF.setJoins([
			{ join: "s100", value: "http://" + JRiver.player.ipAddress + ":" + JRiver.player.port + "/" + theZone.info.ImageURL + "&Token=" + JRiver.player.authToken + "&format=png&width=259&height=259&pad=1" },
			{ join: "s101", value: "http://" + JRiver.player.ipAddress + ":" + JRiver.player.port + "/" + theZone.info.ImageURL + "&Token=" + JRiver.player.authToken + "&format=png&width=768&height=768&Type=Full" },
			{ join: "d10", value: (theZone.info.State == 2 ? 1 : 0) }, // Play Pause button state, 2 = playing
			{ join: "s110", value: (parseInt(theZone.info["PlayingNowPosition"], 10) + 1) + ". " + theZone.info["Name"] },
			{ join: "s111", value: theZone.info["Artist"] + " - " + theZone.info["Album"] },
			{ join: "s112", value: (theZone.info["Rating"]) ? "star_right_" + theZone.info["Rating"] + ".png" : "star_right_none.png"},
			{ join: "s108", value: theZone.info["ElapsedTimeDisplay"] },
			{ join: "s109", value: theZone.info["TotalTimeDisplay"] },
			posSlider
		]);

		// Update the current track in the now playing queue
		// TODO
	}

	// Force volume update as well
	ZoneVolumeChanged(theZone);
}

function ZoneVolumeChanged(theZone) {
	if (theZone.id == JRiver.player.currentZoneID && !volSliderPressed) {
		CF.setJoin("a1", parseFloat(theZone.info["Volume"], 10) * 65535);
	}
}

function ZonePlaylistChanged(theZone) {
	if (theZone.id == JRiver.player.currentZoneID) {
		// Clear the main content list
		CF.listRemove("l4");
		// Update the main content list of data
		var listContent = [];
		for (var i = 0; i < theZone.playlist.length; i++) {
			listContent.push({
				"subpage" : "playlist_items",
				"s100001" : theZone.playlist[i]["Name"],
				"s100002" : theZone.playlist[i]["Artist"],
				"s100003" : ("00"+Math.floor(parseInt(theZone.playlist[i]["Duration"], 10) / 60)).slice(-2) + ":" + ("00"+Math.ceil(parseInt(theZone.playlist[i]["Duration"], 10) % 60)).slice(-2),
				"s100004" : (JRiver.settings.trackMode == 0) ? (i + 1) : theZone.playlist[i]["Track #"],
				"s100005" : (theZone.playlist[i]["Rating"]) ? "star_right_" + theZone.playlist[i]["Rating"] + ".png" : "star_right_none.png",
				"s100006" : JRiver.player.webServiceURL + "File/GetImage?File=" + theZone.playlist[i]["Key"] + "&Token=" + JRiver.player.authToken + "&format=png&width=44&height=44",
				"d100001" : {
					tokens: {
						"key": theZone.playlist[i]["Key"]
					}
				},
				"d100002" : (theZone.playlist[i]["Key"] == theZone.info.FileKey) ? 1 : 0
			});
		}
		CF.listAdd("l4", listContent);
		// Scroll to the current track position
		setTimeout(function(){ CF.listScroll("l4", parseInt(theZone.nowPlayingIndex, 10), CF.MiddlePosition, false);}, 500);
	}
};

function ZonePlaylistPositionChanged(theZone, thePos) {
	if (theZone.id == JRiver.player.currentZoneID) {
		CF.listUpdate("l4", [
			{ index: CF.AllItems, d100002: 0},
			{ index: thePos, d100002: 1},
		]);
	}
};

function showPlayMode(id) {
	JRiver.player.selectedID = id;
	CF.setJoins([
		{join: "d5", value: 1},
		{join: "d999999", value: 1}
	]);
};

function showPopup(join) {
	CF.setJoins([
		{join: join, value: 1},
		{join: "d999999", value: 1}
	]);
}

function cancelPopups() {
	CF.setJoins([
		{join: "d1", value: 0},
		{join: "d5", value: 0},
		{join: "d6", value: 0},
		{join: "d7", value: 0},
		{join: "d8", value: 0},
		{join: "d9", value: 0},
		{join: "d999999", value: 0}
	]);
}

// Concatenate the path string to limit length
function setBrowsePath(path, max, query) {
	if (query) {
		return "Search Results: " + query;
	}
	// The number of items in the path to limit to
	max = max || 3;
	// Split the nav path up into an array of its elements
	var nav = path.split(JRiver.navSeparator);
	if (nav.length <= max) {
		// Path is already short enough, so just use it without change
		return path;
	} else {
		// Path has too many items, use the last items
		var newPath = nav[nav.length-1];
		for (var i = nav.length-2; i >= nav.length-max; i--) {
			newPath = nav[i] + JRiver.navSeparator + newPath;
		}
		return newPath;
	}
}

function setLastScrollPos(list, listIndex) {
	var browseID = JRiver.player.currentBrowseID;
	CF.listInfo(list, function(list, count, first, numVisible, scrollPosition) {
		var browseItem = JRiver.player.getBrowseItemByID(browseID);
		if (browseItem.depth >= 2) {
			browseItem.scrollPos = scrollPosition;
		}
	});
}

function updateSettingsUI() {
	var selectionMode;
	switch(JRiver.settings.selectionMode) {
		case 1 :
			selectionMode = "Play Immediately and Clear Playlist";
			break;
		case 2 :
			selectionMode = "Play Next";
			break;
		case 3 :
			selectionMode = "Append to Playlist";
			break;
		default :
			selectionMode = "Play Immediately";
			break;
	}
	CF.setJoins([
		{ join: "d1001", value: (JRiver.settings.trackMode == 0) },
		{ join: "d1002", value: (JRiver.settings.trackMode == 1) },
		{ join: "s1003", value:  selectionMode},
		{ join: "d1600", value: (JRiver.settings.viewMode == 0) },
		{ join: "d1601", value: (JRiver.settings.viewMode == 1) },
		{ join: "d1602", value: (JRiver.settings.viewMode == 2) }
	]);

	CF.setToken(CF.GlobalTokensJoin, "settings", JSON.stringify(JRiver.settings));

	cancelPopups();
}