var posSliderPressed = false;

CF.userMain = function() {
	// Get username, password, authkey from token storage
	CF.getJoin(CF.GlobalTokensJoin, function (j,v,t) {
		// "cYDGjk"
		JRiver.init(t["accessKey"], t["username"], t["password"]);
		JRiver.trackMode = t["trackmode"];
	});

	// Move the zone subpage slightly off screen
	// can't do it at design time because the shadow is too large.
	// Also hide the back buttons on startup
	CF.setProperties([{join: "d1", x: 746},{join: "d9", x: 490},{join: "d2", opacity: 0.0},{join: "d3", opacity: 0.0}]);

	// Listen to position slider press and release events, disable slider updating whilst its being dragged
	CF.watch(CF.ObjectPressedEvent, "a2", function() {
		posSliderPressed = true;
	});
	CF.watch(CF.ObjectReleasedEvent, "a2", function() {
		posSliderPressed = false;
	});

	EventHandler.on(JRiver, 'PlayerDiscovered', function() {
		CF.log("JRiver Player Discovered: " + JRiver.player.ipAddress);

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
				{ join: "d126", value: 0 },
				{ join: "d11", value: mode != 1 }
			]);
		});

		EventHandler.on(JRiver.player, 'BrowseChanged', function(player, browseItem) {
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
				CF.setJoin("s3", setBrowsePath(browseItem.path));
				// Update the main content list of data
				var listContent = [];
				var listRow = {};
				var lineItem;
				var i = 0;
				for (item in browseItem.items) {
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
			} else {
				// Show the list back button
				CF.setProperties({join: "d2", opacity: 1});
			}
		});

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
	});
};

function ZoneInfoChanged(theZone) {
	if (theZone.id == JRiver.player.currentZoneID) {
		// Check if track pos slider is being pressed - don't update its value whilst its pressed
		var posSlider = {};
		if (!posSliderPressed) {
			posSlider = { join: "a2", value: (65535/parseInt(theZone.info["DurationMS"], 10) * parseInt(theZone.info["PositionMS"], 10)) };
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
	if (theZone.id == JRiver.player.currentZoneID) {
		CF.setJoin("a1", parseFloat(theZone.info["Volume"], 10) * 65535);
	}
}

function ZonePlaylistChanged(theZone) {
	if (theZone.id == JRiver.player.currentZoneID) {
		// Clear the main content list
		CF.listRemove("l4");
		// Update the main content list of data
		var listContent = [];
		var nowPlayingIndex = 0;
		for (var i = 0; i < theZone.playlist.length; i++) {
			CF.logObject(theZone.playlist[i]);
			listContent.push({
				"subpage" : "playlist_items",
				"s100001" : theZone.playlist[i]["Name"],
				"s100002" : theZone.playlist[i]["Track #"],
				"s100003" : ("00"+Math.floor(parseInt(theZone.playlist[i]["Duration"], 10) / 60)).slice(-2) + ":" + ("00"+Math.ceil(parseInt(theZone.playlist[i]["Duration"], 10) % 60)).slice(-2),
				"s100004" : (theZone.playlist[i]["Rating"]) ? "star_right_" + theZone.playlist[i]["Rating"] + ".png" : "star_right_none.png",
				"d100001" : {
					tokens: {
						"key": theZone.playlist[i]["Key"]
					}
				},
				"d100002" : (theZone.playlist[i]["Key"] == theZone.info.FileKey) ? 1 : 0
			});
			if (theZone.playlist[i].Key == theZone.info.FileKey) {
				nowPlayingIndex = i;
			}
		}
		CF.log("Current Key: " + theZone.info["FileKey"]);
		CF.logObject(listContent);
		CF.listAdd("l4", listContent);
		// Scroll to the current track position
		setTimeout(function(){ CF.listScroll("l4", nowPlayingIndex, CF.MiddlePosition, false);}, 500);
	}
};

function cancelPopups() {
	CF.setJoins([
		{join: "d1", value: 0},
		{join: "d7", value: 0},
		{join: "d8", value: 0},
		{join: "d9", value: 0},
		{join: "d999999", value: 0}
	]);
}

// Concatenate the path string to limit length
function setBrowsePath(path, max) {
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