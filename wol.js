var WOL = {
	createMagicPacket: function(mac) {
		var num_mac_octets = 6;
		if (mac.length == 2 * num_mac_octets + 5) {
			var sep = mac[2];
			mac = mac.replace(new RegExp(sep, 'g'), '');
		} else if (mac.length != 2 * num_mac_octets) {
			CF.log("malformed MAC address '" + mac + "'");
		}

		var mac_buffer = new Array();
		for (var i = 0; i < num_mac_octets; ++i) {
			mac_buffer[i] = parseInt(mac.substr(2 * i, 2), 16);
		}

		var num_macs = 16;
		var buffer = new Array();
		for (var i = 0; i < num_mac_octets; ++i) {
			buffer[i] = 0xff;
		}
		for (var i = 0; i < num_macs; ++i) {
			buffer.push.apply(buffer, mac_buffer);
		}
		return buffer;
	},

	wake: function(mac, opts) {
		opts = opts || {};

		var num_packets = opts['num_packets']	|| 3;
		var interval	= opts['interval']		|| 100;
		var systemName	= opts['systemName']	|| "WOL";

		var magicPacketArray = WOL.createMagicPacket(mac);
		var magic_packet = "";
		for (var i = 0; i < magicPacketArray.length; i++) {
			magic_packet += String.fromCharCode(parseInt(magicPacketArray[i], 10));
		}
		var i = 0;
		var timer_id;
		var sendWoL = function() {
			i += 1;
			CF.send(systemName, magic_packet);
			if (i < num_packets) {
				timer_id = setTimeout(sendWoL, interval);
			} else {
				timer_id = undefined;
			}
		}
		sendWoL();
	}
}