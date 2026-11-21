/* =========================================================================
 * HDFilmCehennemi erisim katmani — Cloudstream "Hdfilmcehennemi.kt"
 * eklentisinin (com.hexated, Apache-2.0, Codeberg: mustafaozkan86 &
 * cloudstream-extensions-hexated) mantigidan Orsay-TV icin JavaScript'e
 * yeniden yazilistir.
 *
 * Bulunan kolayliklar:
 *  - Liste/arama Cloudflare-bypass gerektirmiyor:
 *      kategori sayfalari  : GET  {BASE}/category/.../page/N  (HTML)
 *      arama               : POST {BASE}/search/  form: query=...  (JSON!)
 *  - Kaynak cozumleme: oynatici iframe'i sitede ic ise, sayfanin JS'inde
 *      jwplayer "packer" unpack edilir -> file_link="BASE64" -> atob ->
 *      dogrudan mp4/m3u8 URL (native oynaticiya birebir uyar).
 *  - Altyazilar ayni scriptte "tracks: [ ... ]" JSON'u (kind:"captions").
 * ========================================================================= */

(function (global) {
	"use strict";

	// --- Site ayarlari -----------------------------------------------------
	var CFG = {
		BASE: "http://www.hdfilmcehennemi.nl", // alan adi degisirse sadece bunu degistirin
		UA: "Mozilla/5.0 (SMART-TV; Linux; Tizen 2.3) AppleWebkit/538.1" +
			" (KHTML, like Gecko) Version/2.3 TV Safari/538.1",
		CATEGORIES: [
			{ name: "Tavsiye Filmler", path: "/category/tavsiye-filmler-izle2/page/" },
			{ name: "IMDB 7+",         path: "/imdb-7-puan-uzeri-filmler/page/" },
			{ name: "Yeni Yabanci Dizi", path: "/yabancidiziizle-1/page/" },
			{ name: "En Cok Begelenler", path: "/en-cok-begenilen-filmleri-izle/page/" }
		]
	};

	// --- Yardimcilar --------------------------------------------------------
	function xhr(method, url, opt) {
		opt = opt || {};
		return new Promise(function (resolve, reject) {
			var x = new XMLHttpRequest();
			x.open(method, url, opt.async === undefined ? true : opt.async);
			if (opt.form) x.setRequestHeader("Content-Type",
				"application/x-www-form-urlencoded");
			x.setRequestHeader("User-Agent", CFG.UA);
			if (opt.ajax) {
				x.setRequestHeader("Accept", "application/json, text/javascript, */*; q=0.01");
				x.setRequestHeader("X-Requested-With", "XMLHttpRequest");
			}
			x.timeout = 20000;
			x.onload = function () { resolve(x.responseText); };
			x.onerror = function () { reject(new Error("Ag hatasi: " + url)); };
			x.ontimeout = function () { reject(new Error("Zaman asimi: " + url)); };
			x.send(opt.form || null);
		});
	}

	// DOMParser yerine (tv surumunde guvenli) div-innerHTML tekligi
	function toDom(html) {
		var d = document.createElement("div");
		d.innerHTML = html;
		return d;
	}

	function abs(u) {
		if (!u) return null;
		u = u.trim();
		if (u.indexOf("//") === 0) return "http:" + u;
		if (u.indexOf("http") === 0) return u;
		return CFG.BASE + (u.charAt(0) === "/" ? "" : "/") + u;
	}

	function esc(s) { return (s || "").replace(/[&<>"]/g, function (c) {
		return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

	// jwplayer packer unpack (p,a,c,k,e,d) — global.window.jwUnpack
	function unpackPack(p, a, c, k) {
		while (c--) if (k[c]) {
			p = p.replace(new RegExp("\\b" + c.toString(a) + "\\b", "g"), k[c]);
		}
		return p;
	}

	// --- API ----------------------------------------------------------------
	var HFC = {

		/** Ana sayfa satiri: kategoriadi + poster kart listesi */
		getRow: function (catIndex, page) {
			var cat = CFG.CATEGORIES[catIndex];
			return xhr("GET", CFG.BASE + cat.path + (page || 1))
				.then(function (html) {
					var dom = toDom(html);
					var boxes = dom.querySelectorAll(".poster-container");
					var items = [];
					for (var i = 0; i < boxes.length && items.length < 30; i++) {
						var b = boxes[i];
						var a = b.querySelector("a");
						var h2 = b.querySelector("h2.title, h2");
						var img = b.querySelector("img");
						if (!a || !h2) continue;
						items.push({
							title: h2.textContent.trim(),
							url: abs(a.getAttribute("href")),
							poster: abs(img ? (img.getAttribute("data-src") ||
								img.getAttribute("src")) : null)
						});
					}
					return items;
				});
		},

		/** Arama — sitenin JSON AJAX ucu */
		search: function (query) {
			return xhr("POST", CFG.BASE + "/search/", {
				form: "query=" + encodeURIComponent(query),
				ajax: true
			}).then(function (txt) {
				try {
					var j = JSON.parse(txt);
					return (j.result || []).map(function (m) {
						return {
							title: m.title,
							url: abs("/" + (m.slug_prefix || "") + (m.slug || "")),
							poster: abs("/uploads/poster/" + (m.poster || ""))
						};
					});
				} catch (e) { return []; }
			});
		},

		/** Film/dizi detay sayfasi */
		loadDetail: function (itemUrl) {
			return xhr("GET", itemUrl).then(function (html) {
				var dom = toDom(html);

				var header = dom.querySelector(".card-header h1, .card-header h2");
				var title = header ? header.textContent.replace("Filminin Bilgileri", "").trim() : "?";

				var imgs = dom.querySelectorAll("img.img-fluid");
				var poster = imgs.length ? abs(imgs[imgs.length - 1].getAttribute("src")) : null;

				var descEl = dom.querySelector("article p");
				var desc = descEl ? descEl.textContent.trim() : "";

				var isSeries = !!dom.querySelector("#seasonsTabs");

				// bolumler (dizi ise)
				var episodes = [];
				if (isSeries) {
					var eps = dom.querySelectorAll("#seasonsTabs-tabContent .card-list-item");
					for (var i = 0; i < eps.length; i++) {
						var e = eps[i], ea = e.querySelector("a"), eh = e.querySelector("h3");
						if (!ea) continue;
						var m = /Sezon\s?(\d+)\./.exec(eh ? eh.textContent : "");
						episodes.push({
							name: eh ? eh.textContent.trim() : ("Bölüm " + (i + 1)),
							season: m ? parseInt(m[1], 10) : 1,
							url: abs(ea.getAttribute("href"))
						});
					}
				}

				return { title: title, url: itemUrl, poster: poster, desc: desc,
					isSeries: isSeries, episodes: episodes };
			});
		},

		/**
		 * Oynatma linklerini cozer.
		 * Donus: { streams: [{title,url}], subs: [{label,file}] }
		 */
		resolveStreams: function (pageUrl) {
			return xhr("GET", pageUrl).then(function (html) {
				var dom = toDom(html);
				var links = dom.querySelectorAll("nav.nav-card a.nav-link, nav a.nav-link");

				// Degisik hali icin garanti degil — tum a linklerinden
				// "kaynak" niteligi tasiyanlari sec.
				if (!links.length) {
					links = dom.querySelectorAll("a[href*='/vid']," +
						" a[href*='kaynak']");
				}

				var result = { streams: [], subs: [] };

				function finish() { return result; }

				// Sirali isleme (tv cpu icin paralel jQuery.apmap agir)
				function chain(i) {
					if (i >= links.length) return finish();
					var href = abs(links[i].getAttribute("href"));
					var srcName = links[i].textContent.trim() || ("Kaynak " + (i + 1));
					return xhr("GET", href).then(function (srcHtml) {
						var sdom = toDom(srcHtml);
						var ifr = sdom.querySelector("iframe");
						var isrc = ifr ? (ifr.getAttribute("data-src") ||
							ifr.getAttribute("src")) : "";
						if (isrc.indexOf(CFG.BASE) !== -1) {
							// ic sayfa — script icinde sources: / file_link
							return xhr("GET", abs(isrc)).then(function (plHtml) {
								parseLocalPlayer(plHtml, srcName, result);
								return chain(i + 1);
							});
						}
						// dis extractor (vcdn, odnoklassniki vs) — v1'de atla
						return chain(i + 1);
					}).catch(function () { return chain(i + 1); });
				}
				return chain(0);
			});
		}
	};

	/** ic oynatici sayfasini paketten cozer (Kod yapisi bulgusu #3) */
	function parseLocalPlayer(plHtml, srcName, out) {
		var dom = toDom(plHtml);
		var scripts = dom.querySelectorAll("script");
		var inline = null;
		for (var i = 0; i < scripts.length; i++) {
			if ((scripts[i].textContent || "").indexOf("sources:") !== -1 &&
				scripts[i].getAttribute("src") === null) {
				inline = scripts[i].textContent;
				break;
			}
		}
		if (!inline) return;

		// 1) jwplayer packer: eval('...',p,a,c,k,e,d) desenini bul
		var packed = /eval\(function\((?:[^)]*)\)\{[\s\S]*?\}\((.*?)\)\)/.exec(inline);
		if (packed && typeof window.jwUnpack === "function") {
			try {
				var args = smartArgs(packed[1]);
				if (args) inline = window.jwUnpack.apply(null, args);
			} catch (e) { /* deveransiz */ }
		}

		// 2) file_link="BASE64..."
		var fl = /file_link\s*=\s*"([^"]+)"/.exec(inline);
		if (fl) {
			var decoded = window.b64decode(fl[1].trim());
			if (decoded) {
				out.streams.push({
					title: srcName,
					url: decoded,
					isStream: /\.m3u8/.test(decoded)
				});
			}
		}

		// 3) altyazilar: tracks: [ {...}, ... ]
		var tr = /tracks\s*:\s*\[([\s\S]*?)\]/.exec(inline);
		if (tr) {
			try {
				var arr = JSON.parse("[" + tr[1] + "]");
				arr.forEach(function (t) {
					if (t && t.kind === "captions" && t.file) {
						out.subs.push({ label: t.label || t.lang || "?", file: abs(t.file) });
					}
				});
			} catch (e) { /* bos */ }
		}
	}

	/** eval(...) parantez ici argumanlarini string olarak ayirir */
	function smartArgs(raw) {
		var parts = [], cur = "", depth = 0, inStr = null;
		for (var i = 0; i < raw.length; i++) {
			var ch = raw[i];
			if (inStr) { cur += ch; if (ch === inStr && raw[i - 1] !== "\\") inStr = null; continue; }
			if (ch === "\"" || ch === "'") { inStr = ch; cur += ch; continue; }
			if (ch === "[" || ch === "(") depth++;
			if (ch === "]" || ch === ")") depth--;
			if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue; }
			cur += ch;
		}
		if (cur.trim()) parts.push(cur.trim());
		if (parts.length !== 4 && parts.length !== 5) return null;
		// packed "eval function(p,a,c,k,e){...}(PAYLOAD,RADIX,COUNT,ARRAY)"
		function lit(v) {
			v = v.trim();
			if (/^(['"]).*\1$/.test(v)) return v.slice(1, -1);
			if (v.indexOf("[") === 0) { try { return JSON.parse(v); } catch (e) { return null; } }
			if (/^\d+$/.test(v)) return parseInt(v, 10);
			return null;
		}
		var payload = lit(parts[0]), radix = lit(parts[1]),
			count = lit(parts[2]), dict = lit(parts[3]);
		if (payload === null || radix === null || count === null) return null;
		return [payload, radix, count, dict || []];
	}

	HFC.config = CFG;
	HFC.escape = esc;
	global.HFC = HFC;

})(window);
