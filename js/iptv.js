/* ============================================================
 * Canlı TV — iptv-org Türkiye listesinden Türkçe Top 20
 * Kaynak: https://github.com/iptv-org/iptv (MIT/public collection)
 * ============================================================ */
(function (w) {
	"use strict";

	var PLAYLIST_HTTPS = "https://iptv-org.github.io/iptv/countries/tr.m3u";
	var PLAYLIST_HTTP  = "http://iptv-org.github.io/iptv/countries/tr.m3u";

	// Istenen siralamada ilk 20 kanal (buyuk harf anahtar kelimelerle eslesir)
	var DESIRED = [
		"TRT 1", "SHOW TV", "ATV", "STAR", "KANAL D", "NOW", "TV8",
		"A HABER", "HABERTÜRK", "NTV", "CNN TÜRK", "TRT HABER", "24 TV",
		"TRT SPOR", "A SPOR", "SPORTS TV", "TV100", "KANAL 7", "BEYAZ TV", "TEKRAR"
	];

	function norm(s) {
		return (s || "")
			.toUpperCase()
			.replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G")
			.replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C")
			.replace(/\s+/g, " ").trim();
	}

	function parseM3U(text) {
		var lines = text.split(/\r?\n/), out = [], cur = null;
		for (var i = 0; i < lines.length; i++) {
			var L = lines[i].trim();
			if (L.indexOf("#EXTINF") === 0) {
				var namePart = L.substring(L.lastIndexOf(",") + 1).trim();
				var tvg = /tvg-name="([^"]*)"/.exec(L);
				var logo = /tvg-logo="([^"]*)"/.exec(L);
				cur = { name: namePart || (tvg ? tvg[1] : "?"),
					match: norm(namePart + " " + (tvg ? tvg[1] : "")),
					logo: logo ? logo[1] : null, url: null };
			} else if (L && L.charAt(0) !== "#") {
				if (cur) { cur.url = L; out.push(cur); cur = null; }
			}
		}
		return out;
	}

	var IPTV = {
		/** Top 20 listeyi dondurur: Promise<[ {name, logo, url} ]> */
		getTop20: function () {
			function load(url, fb) {
				var x = new XMLHttpRequest();
				x.open("GET", url, fb ? false : true);
				x.timeout = 20000;
				return new Promise(function (res, rej) {
					x.onload = function () { x.status < 400 ? res(x.responseText) : rej(); };
					x.onerror = rej; x.ontimeout = rej;
					x.send();
				});
			}
			return load(PLAYLIST_HTTPS).catch(function(){ return load(PLAYLIST_HTTP, true); })
				.then(parseM3U)
				.then(function (all) {
					var picked = [], used = {};
					DESIRED.forEach(function (want) {
						var w = norm(want);
						for (var i = 0; i < all.length; i++) {
							var c = all[i];
							if (used[c.url]) continue;
							if (c.match.indexOf(w) !== -1) {
								picked.push({ name: c.name, logo: c.logo, url: c.url });
								used[c.url] = 1; return;
							}
						}
					});
					// eksikse genel populer kanallarla tamamla
					if (picked.length < 20) {
						var bonusWords = ["TRT", "HABER", "SPOR", "MÜZİK","MUZIK","BELGESEL"];
						for (var j = 0; j < all.length && picked.length < 20; j++) {
							var cc = all[j];
							if (used[cc.url]) continue;
							for (var b = 0; b < bonusWords.length; b++) {
								if (cc.match.indexOf(norm(bonusWords[b])) !== -1) {
									picked.push({ name: cc.name, logo: cc.logo, url: cc.url });
									used[cc.url] = 1; break;
								}
							}
						}
					}
					return picked.slice(0, 20);
				});
		}
	};

	w.IPTV = IPTV;
})(window);
