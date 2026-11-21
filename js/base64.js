/* Base64 helpers (atob yoksa) + jwplayer unpack exposure */
(function (w) {
	"use strict";
	var KEY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

	function b64decode(str) {
		str = (str || "").replace(/\s/g, "");
		if (typeof w.atob === "function") {
			try { return w.decodeURIComponent(escape(w.atob(str))); }
			catch (e) { return w.atob(str); } // utf-8 ozel karakter dusabilir
		}
		var out = "", bits, c1, c2, c3, e1, e2, e3, e4, i = 0;
		while (i < str.length) {
			e1 = KEY.indexOf(str.charAt(i++));
			e2 = KEY.indexOf(str.charAt(i++));
			e3 = KEY.indexOf(str.charAt(i++));
			e4 = KEY.indexOf(str.charAt(i++));
			bits = (e1 << 18) | (e2 << 12) | (e3 << 6) | e4;
			c1 = (bits >> 16) & 255; c2 = (bits >> 8) & 255; c3 = bits & 255;
			if (e3 === 64) out += String.fromCharCode(c1);
			else if (e4 === 64) out += String.fromCharCode(c1, c2);
			else out += String.fromCharCode(c1, c2, c3);
		}
		return out;
	}

	w.b64decode = b64decode;
	w.jwUnpack = function (p, a, c, k) {
		while (c--) if (k[c])
			p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
		return p;
	};
})(window);
