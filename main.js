CF.userMain = function() {
	JRiver.init("cYDGjk");

	// Move the zone subpage slightly off screen
	// can't do it at design time because the shadow is too large.
	CF.setProperties([{join: "d1", x: 746},{join: "d2", opacity: 0.0}]);

	EventHandler.on(JRiver, 'PlayerDiscovered', function() {
		CF.log("JRiver Player Discovered: " + JRiver.player.ipAddress);

		// Start browsing the player library
		JRiver.player.browse();

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

		EventHandler.on(JRiver.player, 'BrowseChanged', function() {
			CF.log("BrowseChanged: " + JRiver.player.browsing.length);

			// if the returned data is one of the first two browsing levels
			if (JRiver.player.browseHistory.length <= 2) {
				// Clear the sidebar list
				CF.listRemove("l2");
				// Update the list title
				CF.setJoin("s2", JRiver.player.getBrowseTitle());
				// Update the sidebar list
				var listContent = [];
				for (var i = 0; i < JRiver.player.browsing.length; i++) {
					listContent.push({
						s100001: JRiver.player.browsing[i].name,
						d100001: {
							tokens: {
								"browseid": JRiver.player.browsing[i].id
							}
						}
					});
				}
				CF.listAdd("l2", listContent);
			} else {
				// Clear the main content list
				CF.listRemove("l3");
				// Update the main content list of data
				var listContent = [];
				var listRow = {};
				var lineItem;
				for (var i = 0; i < JRiver.player.browsing.length; i++) {
					lineItem = (i % 4) + 1;
					listRow["s10000" + lineItem] = JRiver.player.browsing[i].name;
					listRow["s10001" + lineItem] = JRiver.player.webServiceURL + "Browse/Image?id=" + JRiver.player.browsing[i].id + "&format=png&width=135&height=135&";
					listRow["d10000" + lineItem] = {
						tokens: {
							"browseid": JRiver.player.browsing[i].id
						}
					};
					if (lineItem == 4) {
						listContent.push(listRow);
						listRow = {};
					}
				}
				if (listRow.hasOwnProperty("s100001")) {
					listContent.push(listRow);
				}
				CF.listAdd("l3", listContent);
			}

			if (JRiver.player.browseHistory.length > 1) {
				// Show the back button
				CF.setProperties({join: "d2", opacity: 1});
			} else {
				// Hide the back button
				CF.setProperties({join: "d2", opacity: 0});
			}
		});

		EventHandler.on(JRiver.player, 'FilesChanged', function() {
			CF.log(JRiver.player.files.length);

			// Clear the main content list
			CF.listRemove("l3");
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
	CF.log("ZoneInfoChanged: " + theZone.info.Artist);

	if (theZone.id == JRiver.player.currentZoneID) {
		CF.log(theZone.info.ImageURL);
		CF.setJoin("s100", "http://" + JRiver.player.ipAddress + ":" + JRiver.player.port + "/" + theZone.info.ImageURL + "&format=png&width=259&height=259&pad=1");
	}

	// Force volume update as well
	ZoneVolumeChanged(theZone);
}

function ZoneVolumeChanged(theZone) {
	if (theZone.id == JRiver.player.currentZoneID) {
		CF.log(theZone.info["Volume"]);
		CF.setJoin("a1", parseFloat(theZone.info["Volume"], 10) * 65535);
	}
}

function cancelPopups() {
	CF.setJoins([
		{join: "d1", value: 0},
		{join: "d999999", value: 0}
	]);
}