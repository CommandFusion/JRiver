/* JRiver Media Center Script for CommandFusion
=========================================================================

AUTHOR: Jarrod Bell, CommandFusion
CONTACT: support@commandfusion.com
URL: www.commandfusion.com/scripting/examples/jriver
VERSION: v0.1.5
LAST MODIFIED: 14 April 2011

=========================================================================
HELP:

To use this script, please complete the following steps:
1. Download the CommandFusion plugin for JRiver Media Center and install it:
   - http://www.commandfusion.com/downloads
2. Add this script to your project properties.
3. Create a system in system manager named 'JRiver'.
   - Set the IP address to match the IP of your PC running JRiver
   - Set the port to whatever port you choose in the plugin settings within JRiver (Default 8022)
   - Set the EOM to \xF5\xF5
4. Add a single feedback item named 'Incoming Data' with regex as follows: (?ms)\xF3(.*?)\xF4(.*?)\xF5\xF5
   - You do not need to add anything else to the feedback item, just the name and regex.

NOTE: Without the system and feedback item defined exactly as above, this script will not work!!
=========================================================================
*/


// ======================================================================
// Main Entry Function - Setup Everything Here
// ======================================================================
// This should only be included in a single script file, so we don't
// really want to set it in a shared script I think...
CF.userMain = function() {
	//CF.log("JRiver: userMain started.");

	// Check that the "JRiver" system is defined in the GUI. Otherwise no commands from JS will work!
	if (CF.systems["JRiver"] === undefined) {
	    // Show alert
		CF.log("Your GUI file is missing the 'JRiver' system.\nPlease add it to your project before continuing.\n\nSee readme in comments at top of the script.");
	    //CF.alert("Your GUI file is missing the 'JRiver' system.\nPlease add it to your project before continuing.\n\nSee readme in comments at top of the script.");
		// Cancel further JS setup
		delete CF.userMain;
		return;
	}

	// Watch all incoming data through a single feedback item
	CF.watch(CF.FeedbackMatchedEvent, "JRiver", "Incoming Data", JRiver.incomingData);

	// Ensure loading image is hidden
	CF.setProperties({join: "s"+JRiver.joinArtistList, opacity:0.0, scale:0.5});

	// Get the JRiver system IP address and port for use in all cover art calls
	JRiver.coverArtURL = "http://"+CF.systems["JRiver"].address+":"+(CF.systems["JRiver"].port+1)+"/"; // ?getalbumart

	// Setup the default actions for list selection
	JRiver.defaultTrackAction = JRiver.ActionPlay;
	JRiver.defaultAlbumAction = JRiver.ActionBrowse;
	JRiver.defaultArtistAction = JRiver.ActionBrowse;
	JRiver.defaultZoneAction = JRiver.ActionPlay;

	// Set default state of album selection mode
	CF.setJoin("d"+(JRiver.joinArtistList+1)+"1", "1");

	CF.watch(CF.ConnectionStatusChange, "JRiver", JRiver.onConnectionChange, true);

	// Delete this function now that it has done it's thing.
	// This is to reduce memory usage (as the userMain function is only ever called once).
	delete CF.userMain;
};

// ======================================================================
// JRiver Object
// ======================================================================

var JRiver = {
	
	// ======================================================================
	// Constants
	// ======================================================================
	
	ActionPlay:				"play",					// Insert the track(s) at the current playlist position and start playback immediately
	ActionPlayNext:			"paynext",				// Insert the track(s) at the next playlist position and start playback after current song finishes
	ActionEnqueue:			"enqueue",				// Append the track(s) at the end of the playlist
	ActionClearPlay:		"clearplay",			// Clear the current playlist then enqueue the track(s)
	ActionBrowse:			"browse",				// Browse the selected item (not valid for track select. Artist and Album only)
	ActionDelete:			"delete",				// Delete the selected item (only valid for track selection in zone playlists)

	// ======================================================================
	// Global vars
	// ======================================================================

	// Default item selection actions
	// defaultTrackAction:		this.ActionPlay, WHY DOESNT THIS WORK?
	defaultTrackAction:		null,
	defaultAlbumAction:		null,
	defaultArtistAction:	null,
	defaultZoneAction:		null,

	/* - SETTING PER ROW DIRECTLY VIA JS CALL ON BUTTONS INSTEAD FOR NOW
	getPerRowArtists:		1,				// Number of artists to send back per row of data
	getPerRowAlbums:		1,				// Number of albums to send back per row of data
	getPerRowTracks:		1,				// Number of tracks to send back per row of data
	*/
	
	// Default Join Numbers
	joinArtistList:			300,			// The loading image is on this serial join too.
	//joinArtistAlbumList:	301,
	//joinAlbumTrackList:	302,
	//joinZoneList:			303,
	//joinNowPlayingList:	304,
	joinVol:				1,

	// Data states
	countArtists:			0,
	countArtistAlbums:		0,
	countAlbumTracks:		0,
	countZones:				0,
	perRow:					3,
	//loadingInterval:		null,
	gotArtistsAlready:		false,
	newListContent:			[],
	zones:					[],
	// Javascript doesnt support "dot matches all" flag for regular expressions,
	// so we use a character class [\s\S] (match white spaces and non-whitespaces, therefor any character)
	// to ensure that we even capture carriage returns and line breaks.
	feedbackRegex:			/\xF3([\s\S]*?)\xF4([\s\S]*?)\xF5\xF5/g,
	coverArtURL:			null,

	// ======================================================================
	//  Handle Connections/Disconnections
	// ======================================================================
	onConnectionChange: function (system, connected, remote) {
		if (connected) {
			// Connection established
			// Hide error subpage
			CF.setProperties({join:"d"+(JRiver.joinArtistList-1), opacity:1.0, scale:1.25}, 0.0, 0.15, CF.AnimationCurveEaseOut, function() {
				CF.setProperties({join:"d"+(JRiver.joinArtistList-1), scale:0.5, opacity:0.0}, 0.0, 0.15, CF.AnimationCurveEaseIn);
			});
		} else {
			// Connection lost
			// Hide the album, track and zone playlist subpages, leave artist and zone subpages alone
			CF.setJoins([
				{ "join": "d"+(joinArtistList+1), "value": 0 },
				{ "join": "d"+(joinArtistList+2), "value": 0 },
				{ "join": "d"+(joinArtistList+4), "value": 0 }
			]);
			// Allow requesting the artist list again
			JRiver.gotArtistsAlready = false;
			// Show error subpage
			CF.setProperties({join:"d"+(JRiver.joinArtistList-1), opacity:1.0, scale:1.25}, 0.0, 0.15, CF.AnimationCurveEaseOut, function() {
				CF.setProperties({join:"d"+(JRiver.joinArtistList-1), scale:1.0, opacity:1.0}, 0.0, 0.15, CF.AnimationCurveEaseIn);
			});
		}
	},

	// ======================================================================
	// Incoming Data Point
	// ======================================================================
	incomingData: function (itemName, matchedString) {
		// Match the incoming message against regex to grab the command name and data
		// All incoming data should match the following format: \xF3<COMMAND>\xF4<DATA>\xF5\xF5
		var artistList = "l" + JRiver.joinArtistList;
		var albumsList = "l" + (JRiver.joinArtistList+1);
		var trackList = "l" + (JRiver.joinArtistList+2);
		var zoneList = "l" + (JRiver.joinArtistList+3);
		var nowPlayingList = "l" + (JRiver.joinArtistList+4);
		// Reset the regex to work correctly after each consecutive match
		JRiver.feedbackRegex.lastIndex = 0;
		var matches = JRiver.feedbackRegex.exec(matchedString);
		if (matches != null) {
			//CF.log("JRiver: Incoming Data - "+matchedString);
			// Split the data into its chunks
			var dataArray = matches[2].split("|");
			// Check what command was received first
			switch (matches[1]) {

				// ARTIST LIST BUILDING =====================================
				case "RLISTARTISTS": // Returning a list of Artists
					var end = false;
					// Now check if the message is the list start message
					if (dataArray[0] == "start") {
						//CF.log("JRIVER: Artist List Start");
						// Example data format: start|<totalArtists>|<perRow>
						// Get the total count and store it for later
						JRiver.countArtists = dataArray[1];
						JRiver.perRow = dataArray[2];
						JRiver.gotArtistsAlready = true;
						// Clear the list
						CF.listRemove(artistList);
						JRiver.newListContent = [];
					} else if (dataArray[0] == "title") { // Row of title data
						//CF.log("JRIVER: Artist List Title");
						// Example data format: title|<artistLetter>
						JRiver.newListContent.push({title: true, s1: dataArray[1]});
					} else if (dataArray[0] == "item") { // Row or rows of list data (depending on perRow grabbed from list start message)
						//CF.log("JRIVER: Artist List Item");
						// Example data format: item|<itemNum>|<artist>|<totalAlbums>
						for (var i = 0; i < JRiver.perRow; i++) {
							// Push the item into the list array, along with a token for [artist]
							var artist = dataArray[(i*2)+2];
							//JRiver.newListContent.push({s1: {value: artist, tokens: {"[artist]": artist}}});
							JRiver.newListContent.push({s1: artist});
						}
					} else if (dataArray[0] == "end") { // List end message
						//CF.log("JRIVER: Artist List End - " + JRiver.newListContent.length);
						end = true;
						// Hide "list loading" indicator image
						CF.setProperties({join:"s"+JRiver.joinArtistList, opacity:1.0, scale:1.25}, 0.0, 0.15, CF.AnimationCurveEaseOut, function() {
							CF.setProperties({join:"s"+JRiver.joinArtistList, scale:0.5, opacity:0.0}, 0.0, 0.15, CF.AnimationCurveEaseIn);
						});
					}

					// Add to the list in chunks of 50 items
					var numQueued = JRiver.newListContent.length;
					if ((end && numQueued > 0) || numQueued >= 50) {
						CF.listAdd(artistList, JRiver.newListContent);
						JRiver.newListContent = [];
					}
					break;

				// ARTIST ALBUM LIST BUILDING ===============================
				case "RLISTALBUMS": // Returning a list of Artist Albums
					var end = false;
					// Now check if the message is the list start message
					if (dataArray[0] == "start") {
						//CF.log("JRIVER: Artist Album List Start");
						// Show a loading indicator
						//loadingInterval = setInterval();
						// Example data format: start|<totalAlbums>|<artistName>|<perRow>
						JRiver.countArtistAlbums = dataArray[1];
						JRiver.perRow = dataArray[3];
						// Set a global token with the artist name for getting track lists later
						CF.setToken("e0", "[albumartist]", dataArray[2]);
						// Clear the list
						CF.listRemove(albumsList);
						// Set the artist title in the list header
						JRiver.newListContent.push({title: true, s1: "Albums by "+dataArray[2]});
					} else if (dataArray[0] == "item") { // Row or rows of list data (depending on perRow grabbed from list start message)
						//CF.log("JRIVER: Artist Album List Item");
						// Example data format: item|<itemNum>|<albumName>|<totalTracks>|<year>
						for (var i = 0; i < JRiver.perRow; i++) {
							// Push the item into the list array, along with a token for [artist]
							var album = dataArray[(i*2)+2];
							JRiver.newListContent.push({s1: album, s2: JRiver.coverArtURL+"?getalbumart="+album, s3: dataArray[(i*4)+4]});
						}
					} else if (dataArray[0] == "end") { // List end message
						//CF.log("JRIVER: Artist Album List End");
						end = true;
					}
					// Add to the list in chunks of 50 items
					var numQueued = JRiver.newListContent.length;
					if ((end && numQueued > 0) || numQueued >= 50) {
						CF.listAdd(albumsList, JRiver.newListContent);
						JRiver.newListContent = [];
					}
					break;
				// ALBUM TRACK LIST BUILDING ===============================
				case "RLISTTRACKS": // Returning a list of Album Tracks
					var end = false;
					// Now check if the message is the list start message
					if (dataArray[0] == "start") {
						//CF.log("JRIVER: Album Track List Start");
						// Example data format: start|<totalTracks>|<artistName>|<albumName>|<perRow>
						JRiver.countAlbumTracks = dataArray[1];
						JRiver.perRow = dataArray[4];
						// Set a global token with the artist name for getting track lists later
						CF.setToken("e0", "[trackalbum]", dataArray[3]);
						// Clear the list
						CF.listRemove(trackList);
						// Set the album title in the list header
						//JRiver.newListContent.push({title: true, s1: "Album: "+dataArray[3]});
					} else if (dataArray[0] == "item") { // Row or rows of list data (depending on perRow grabbed from list start message)
						//CF.log("JRIVER: Artist Album List Item");
						// Example data format: item|<trackNum>|<trackName>|<duration>
						for (var i = 0; i < JRiver.perRow; i++) {
							// Push the item into the list array, along with a token for [artist]
							var trackNum = dataArray[(i*1)+1];
							var track = dataArray[(i*2)+2];
							var duration = dataArray[(i*3)+3];
							// Nice trick for number padding: http://www.codigomanso.com/en/2010/07/simple-javascript-formatting-zero-padding/
							JRiver.newListContent.push({s1: trackNum, s2: track, s3: ("0"+Math.floor(duration/60)).slice(-2)+":"+("0"+(duration%60)).slice(-2)});
						}
					} else if (dataArray[0] == "end") { // List end message
						//CF.log("JRIVER: Artist Album List End");
						end = true;
					}
					// Add to the list in chunks of 50 items
					var numQueued = JRiver.newListContent.length;
					if ((end && numQueued > 0) || numQueued >= 50) {
						CF.listAdd(trackList, JRiver.newListContent);
						JRiver.newListContent = [];
					}
					break;
				// ZONE LIST BUILDING ===============================
				case "RLISTZONES": // Returning a list of Album Tracks
					var end = false;
					// Now check if the message is the list start message
					if (dataArray[0] == "start") {
						//CF.log("JRIVER: Zone List Start");
						// Example data format: start|<totalZones>|<perRow>
						JRiver.countZones = dataArray[1];
						JRiver.perRow = dataArray[2];
						// Clear the list
						CF.listRemove(zoneList);
						JRiver.zones = [];
					} else if (dataArray[0] == "zone") { // Row or rows of list data (depending on perRow grabbed from list start message)
						//CF.log("JRIVER: Zone List Item");
						// Example data format: zone|<zoneNumber>|<zoneName>|<playbackState>|<position>|<duration>|<artist>|<album>|<trackName>|<trackNumber>
						// If playback is stopped (no track info) then all items after <playbackState> are null:
						// Example data format: zone|<zoneNumber>|<zoneName>|<playbackState>||||||
						for (var i = 0; i < JRiver.perRow; i++) {
							// Push the item into the list array
							var zoneNum = dataArray[(i*1)+1];
							var zone = dataArray[(i*2)+2];
							var state = dataArray[(i*3)+3];
							var position = dataArray[(i*4)+4];
							var duration = dataArray[(i*5)+5];
							var artist = dataArray[(i*6)+6];
							var album = dataArray[(i*7)+7];
							var trackName = dataArray[(i*8)+8];
							var trackNumber = dataArray[(i*9)+9];
							// Nice trick for number padding: http://www.codigomanso.com/en/2010/07/simple-javascript-formatting-zero-padding/
							// Backslashes are how you split JavaScript code across multiple lines.
							JRiver.newListContent.push({s1: zone, s2: artist, s3: album, s4: trackName,
								s5: ("0"+Math.floor(position/60)).slice(-2)+":"+("0"+(position%60)).slice(-2),
								s6: ("0"+Math.floor(duration/60)).slice(-2)+":"+("0"+(duration%60)).slice(-2),
								a1: Math.round((65535/duration)*position), d1: {tokens: {"[zonenum]": zoneNum}}});
							JRiver.zones.push({name: zone, num: zoneNum});
						}
					} else if (dataArray[0] == "end") { // List end message
						//CF.log("JRIVER: Zone List End");
						end = true;
					}
					// Add to the list in chunks of 50 items
					var numQueued = JRiver.newListContent.length;
					if ((end && numQueued > 0) || numQueued >= 50) {
						CF.listAdd(zoneList, JRiver.newListContent);
						JRiver.newListContent = [];
					}
					break;
				case "RVOL": // Returning volume level of current zone
					CF.setJoin("a"+joinVol, dataArray[0]);
				case "RACTIVEZONE": // Returning current zone name
					CF.setJoin("s1", dataArray[0]);
			}
		}
	},

    // ======================================================================
    // Library Browsing Functions
    // ======================================================================
	getArtists: function (numRows) {
		if (!JRiver.gotArtistsAlready) {
			CF.setProperties({join:"s"+JRiver.joinArtistList, opacity:1.0, scale:1.25}, 0.0, 0.15, CF.AnimationCurveEaseOut, function() {
				CF.setProperties({join:"s"+JRiver.joinArtistList, scale:1.0}, 0.0, 0.15, CF.AnimationCurveEaseIn);
			});
			JRiver.sendMsg("TGETLIST", ["allartists",numRows]);
		}
		// Manage the Zones/Library toggle
		CF.setJoins([
			{ join: "d1", value: 0 },
			{ join: "d2", value: 1 }
		]);
	},
	// A button in the artist list is pressed, now we get the value of the text on that button
	// and send it through to the getArtistAlbums function
	selectArtistList: function (list, listIndex, join, numRows) {
		CF.getJoin(list+":"+listIndex+":s1", function (j, v) {
			JRiver.getArtistAlbums(v, numRows);
		});
	},
	getArtistAlbums: function (artist, numRows) {
		// Check what action to perform
		switch (JRiver.defaultArtistAction) {
			case JRiver.ActionPlay:
				JRiver.sendMsg("TPLAY", ["artist",artist]);
				break;
			case JRiver.ActionPlayNext:
				JRiver.sendMsg("TPLAYNEXT", ["artist",artist]);
				break;
			case JRiver.ActionEnqueue:
				JRiver.sendMsg("TADD", ["artist",artist]);
				break;
			case JRiver.ActionClearPlay:
				JRiver.sendMsg("TCLEAR");
				JRiver.sendMsg("TPLAY", ["artist",artist]);
				break;
		}
		// Request the album list
		JRiver.sendMsg("TGETLIST", ["albums",artist,numRows]);

		CF.setJoins([
			{ join: "d"+(JRiver.joinArtistList+1), value: 1 },	// Show the album list subpage
			{ join: "d"+(JRiver.joinArtistList+2), value: 0 }	// Hide the track list subpage
		]);
	},
	// A button in the album track list is pressed, now we get the value of the text on that button
	// and send it through to the getAlbumTracks function
	selectAlbumList: function (list, listIndex, join, numRows) {
		CF.getJoins([list+":"+listIndex+":s1","e0"], function (joins) {
			JRiver.getAlbumTracks(joins["e0"].tokens["[albumartist]"], joins[list+":"+listIndex+":s1"].value, numRows);
		});
	},
	getAlbumTracks: function (artist, album, numRows) {
		// Check what action to perform
		switch (JRiver.defaultAlbumAction) {
			case JRiver.ActionPlay:
				JRiver.sendMsg("TPLAY", ["album",artist,album]);
				break;
			case JRiver.ActionPlayNext:
				JRiver.sendMsg("TPLAYNEXT", ["album",artist,album]);
				break;
			case JRiver.ActionEnqueue:
				JRiver.sendMsg("TADD", ["album",artist,album]);
				break;
			case JRiver.ActionClearPlay:
				JRiver.sendMsg("TCLEAR");
				JRiver.sendMsg("TPLAY", ["album",artist,album]);
				break;
		}

		// Request the track list
		JRiver.sendMsg("TGETLIST", ["tracks",artist,album,numRows]);
		// Show the track list subpage
		CF.setJoin("d"+(JRiver.joinArtistList+2), "1");
	},
	selectAlbumTrack: function (list, listIndex, join) {
		CF.getJoins([list+":"+listIndex+":s1","e0"], function (joins) {
			JRiver.selectTrack(joins["e0"].tokens["[albumartist]"], joins["e0"].tokens["[trackalbum]"], joins[list+":"+listIndex+":s1"].value);
		});
	},
	// Select a track from the library
	selectTrack: function (artist, album, trackNum) {
		switch (JRiver.defaultTrackAction) {
			case JRiver.ActionPlay:
				JRiver.sendMsg("TPLAY", ["track",artist,album,trackNum]);
				break;
			case JRiver.ActionPlayNext:
				JRiver.sendMsg("TPLAYNEXT", ["track",artist,album,trackNum]);
				break;
			case JRiver.ActionEnqueue:
				JRiver.sendMsg("TADD", ["track",artist,album,trackNum]);
				break;
			case JRiver.ActionClearPlay:
				JRiver.sendMsg("TCLEAR");
				JRiver.sendMsg("TPLAY", ["track",artist,album,trackNum]);
				break;
		}
	},
	changeAlbumAction: function(action) {
		// Save the state
		JRiver.defaultAlbumAction = action;
		// Update the state indicator buttons
		var baseJoin = "d"+(JRiver.joinArtistList+1);
		CF.setJoins([
			{ "join": baseJoin+"1", value: (action==JRiver.ActionBrowse?"1":"0") },
			{ "join": baseJoin+"2", value: (action==JRiver.ActionPlay?"1":"0") },
			{ "join": baseJoin+"3", value: (action==JRiver.ActionEnqueue?"1":"0") },
			{ "join": baseJoin+"4", value: (action==JRiver.ActionClearPlay?"1":"0") },
		]);
		if (action==JRiver.ActionBrowse) {
			CF.setJoin("s"+(JRiver.joinArtistList+1)+"0", "Browse");
		} else if (action==JRiver.ActionPlay) {
			CF.setJoin("s"+(JRiver.joinArtistList+1)+"0", "Play");
		} else if (action==JRiver.ActionEnqueue) {
			CF.setJoin("s"+(JRiver.joinArtistList+1)+"0", "Enqueue");
		} else if (action==JRiver.ActionClearPlay) {
			CF.setJoin("s"+(JRiver.joinArtistList+1)+"0", "Clear & Play");
		}
	},

	// ======================================================================
    // Zone Functions
    // ======================================================================

	// A button in the zone list is pressed, now we get the value of the tokens on that button
	// and send it through to the setActiveZone function
	selectZoneList: function (list, listIndex, join) {
		CF.getJoin(list+":"+listIndex+":d1", function (j,v,t) {
			JRiver.setActiveZone(t["[zonenum]"]);
		});
	},
	setActiveZone: function (zoneNum) {
		// Activate the chosen zone. Zone playlist will automatically be sent
		JRiver.sendMsg("TSETZONE", zoneNum);
	},
	// Zone list button was held down, show the grouping subpage
	selectZoneListGroups: function (list, listIndex, join) {
		CF.getJoin(list+":"+listIndex+":d1", function (j,v,t) {
			JRiver.setActiveZone(t["[zonenum]"]);
		});
	},
	getZones: function (numRows) {
		JRiver.sendMsg("TGETLIST", ["zones",numRows]);
		// Manage the Zones/Library toggle
		CF.setJoins([
			{ join: "d1", value: 1 },
			{ join: "d2", value: 0 }
		]);
	},
	clearCurrentZonePlaylist: function () {
		JRiver.sendMsg("TCLEAR");
	},
	clearZonePlaylist: function (zoneNum) {
		JRiver.sendMsg("TCLEARZONE", zoneNum);
	},
	// A button in the zone playing is pressed, now we get the value of the text on that button
	// and perform the appropriate action
	selectZonePlaylist: function (list, listIndex, join, numRows) {
		switch (JRiver.defaultZoneAction) {
			case JRiver.ActionDelete:
				// Delete the row from the list locally
				CF.listRemove(JRiver.nowPlayingList, listIndex);
				// Now tell JRiver to remove it
				JRiver.sendMsg("TITEMDELETE",listIndex);
				break;
			case JRiver.ActionPlay:
				JRiver.jumpToTrack(listIndex);
				break;
			case JRiver.ActionPlayNext:
				JRiver.sendMsg("TITEMPLAYNEXT",listIndex);
				break;
		}
	},
	// Jump to a specific position within the currently selected zone's playlist
	jumpToTrack: function (trackNum) {
		JRiver.sendMsg("TITEMPLAY",trackNum);
	},
	changeZoneAction: function(action) {
		// Save the state
		JRiver.defaultZoneAction = action;
		// Update the state indicator buttons
		var baseJoin = "d"+(JRiver.joinArtistList+4);
		CF.setJoins([
			{ "join": baseJoin+"1", value: (action==JRiver.ActionDelete?"1":"0") },
			{ "join": baseJoin+"2", value: (action==JRiver.ActionPlayNext?"1":"0") },
			{ "join": baseJoin+"3", value: (action==JRiver.ActionPlay?"1":"0") },
		]);
	},
	// Show a list of zones that a zone can link to.
	showZoneGroupOptions: function (zoneNum) {

	},
	sendMsg: function(command, data) {
		CF.send("JRiver", "\xF3"+command+"\xF4"+(Array.isArray(data)?data.join("|"):data)+"\xF5\xF5");
	}
};