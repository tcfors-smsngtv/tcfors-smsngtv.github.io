/* ============================================================
 * EkranMerkezi — Baslatici + FilmCehennemi + Canli TV
 * Orsay (2014 H serisi) — tek gorev dongusu, sahne durum makinesi
 * ============================================================ */
(function (w) {
	"use strict";

	var KEYS = {
		UP: 29460, DOWN: 29461, LEFT: 29459, RIGHT: 29458,
		ENTER: 29443, RETURN: 10009, EXIT: 10182, PLAY: 415, STOP: 413
	};

	var $ = function (id) { return document.getElementById(id); };
	var ui = {
		launch: $("launcherScene"), tiles: $("tiles"),
		home: $("homeScene"), rows: $("homeRows"),
		detail: $("detailScene"), detailBody: $("detailBody"),
		iptv: $("iptvScene"), chans: $("channelList"),
		loading: $("loading"), sef: $("sefPlayer")
	};

	var S = {
		view: "launcher",          // launcher | films | detail | iptv
		tileIdx: 0,
		rows: [], rowIdx: 0, itemIdx: 0,
		channels: [], chanIdx: 0,
		playerOn: false, returnView: "launcher",
		detail: null
	};

	function show(el, on) { el.className = on ? "scene" : "scene hidden"; }
	function setLoading(on) { ui.loading.className = on ? "" : "hidden"; }
	function esc(s) { return (s || "").replace(/[&<>"]/g, function (c) {
		return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

	// ===================== BASLATICI =====================
	function paintTiles() {
		var t = ui.tiles.children;
		for (var i = 0; i < t.length; i++) t[i].className = "tile";
		if (t[S.tileIdx]) t[S.tileIdx].className = "tile focus";
	}
	function openTile(idx) {
		if (idx === 0) { gotoFilms(); } else { gotoIptv(); }
	}
	function gotoLauncher() {
		S.view = "launcher";
		[ui.home, ui.detail, ui.iptv].forEach(function (e) { show(e, false); });
		show(ui.launch, true);
		paintTiles();
	}
	function gotoFilms() {
		S.view = "films";
		show(ui.launch, false); show(ui.home, true);
		if (!S.rows.length) fetchRows(); else paintHomeFocus();
	}
	function gotoIptv() {
		S.view = "iptv";
		show(ui.launch, false); show(ui.iptv, true);
		if (!S.channels.length) loadChannels(); else paintChanFocus();
	}

	// ===================== FILM SATIRLARI =====================
	function paintHomeFocus() {
		var strips = ui.rows.querySelectorAll(".strip");
		S.rows.forEach(function (row, r) {
			var strip = strips[r]; if (!strip) return;
			for (var i = 0; i < strip.children.length; i++)
				strip.children[i].className = "card";
			if (r === S.rowIdx && strip.children[S.itemIdx])
				strip.children[S.itemIdx].className = "card focus";
			var vis = 7, wCard = 144;
			strip.scrollLeft = S.itemIdx >= vis - 1 ? (S.itemIdx - vis + 1) * wCard : 0;
		});
	}
	function fetchRows() {
		setLoading(true);
		var proms = [];
		for (var i = 0; i < HFC.config.CATEGORIES.length; i++) (function (idx) {
			proms.push(HFC.getRow(idx, 1).then(function (items) {
				return { name: HFC.config.CATEGORIES[idx].name, items: items };
			}).catch(function () {
				return { name: HFC.config.CATEGORIES[idx].name, items: [] };
			}));
		})(i);
		Promise.all(proms).then(function (rows) {
			S.rows = rows; renderHome(); setLoading(false);
		});
	}
	function renderHome() {
		ui.rows.innerHTML = "";
		S.rows.forEach(function (row) {
			var wrap = document.createElement("div"); wrap.className = "row";
			var h = document.createElement("h2"); h.textContent = row.name; wrap.appendChild(h);
			var strip = document.createElement("div"); strip.className = "strip";
			row.items.forEach(function (it) {
				var card = document.createElement("div"); card.className = "card";
				if (it.poster) card.style.backgroundImage = "url('" + it.poster + "')";
				var lab = document.createElement("div"); lab.className = "label";
				lab.textContent = it.title; card.appendChild(lab);
				strip.appendChild(card);
			});
			wrap.appendChild(strip); ui.rows.appendChild(wrap);
		});
		paintHomeFocus();
	}

	// ===================== DETAY =====================
	function openDetail(item) {
		setLoading(true);
		HFC.loadDetail(item.url).then(function (d) {
			S.detail = d;
			ui.detailBody.innerHTML =
				'<div class="poster" style="background-image:url(\'' +
					(d.poster || "").replace(/'/g, "%27") + '\')"></div>' +
				'<div class="info"><h3>' + esc(d.title) + '</h3>' +
				'<p class="desc">' + esc((d.desc || "").slice(0, 340)) + '</p>' +
				'<div class="btn">OYNAT</div></div>';
			show(ui.home, false); show(ui.detail, true);
			S.view = "detail"; setLoading(false);
		}).catch(function () { setLoading(false); });
	}
	function playFilm() {
		setLoading(true);
		HFC.resolveStreams(S.detail.url).then(function (res) {
			setLoading(false);
			if (!res.streams.length) { w.alert("Kaynak bulunamadi."); return; }
			startPlayer(res.streams[0].url, "detail");
		}).catch(function () { setLoading(false); w.alert("Kaynak hatasi."); });
	}

	// ===================== IPTV =====================
	function loadChannels() {
		setLoading(true);
		IPTV.getTop20().then(function (chs) {
			S.channels = chs; setLoading(false);
			ui.chans.innerHTML = "";
			chs.forEach(function (c, i) {
				var li = document.createElement("div"); li.className = "chan";
				var n = document.createElement("span"); n.className = "num"; n.textContent = (i + 1) + ".";
				var nm = document.createElement("span"); nm.className = "nm"; nm.textContent = c.name;
				li.appendChild(n); li.appendChild(nm);
				if (c.logo) { var lg = document.createElement("img"); lg.src = c.logo; lg.className = "logo"; li.appendChild(lg); }
				ui.chans.appendChild(li);
			});
			paintChanFocus();
		}).catch(function () { setLoading(false); w.alert("Kanal listesi alinamadi."); });
	}
	function paintChanFocus() {
		var kids = ui.chans.children;
		for (var i = 0; i < kids.length; i++) kids[i].className = "chan";
		var el = kids[S.chanIdx];
		if (el) {
			el.className = "chan focus";
			el.scrollIntoView ? el.scrollIntoView() : 0;
		}
	}
	function playChannel() {
		var c = S.channels[S.chanIdx];
		if (c) startPlayer(c.url, "iptv");
	}

	// ===================== OYNATICI =====================
	function startPlayer(url, returnView) {
		S.returnView = returnView || S.view;
		try {
			ui.sef.style.width = "1280px"; ui.sef.style.height = "720px";
			ui.sef.Open("Player", "1.0", "Player");
			ui.sef.Execute("InitPlayer", url);
			ui.sef.Execute("StartPlayback", -1);
			ui.sef.OnRenderingComplete = stopPlayer;
			ui.sef.OnConnectionFailed = function () { stopPlayer(); w.alert("Baglanti hatasi"); };
			S.playerOn = true;
		} catch (e) { w.alert("Oynatici: " + e.message); }
	}
	function stopPlayer() {
		if (!S.playerOn) return;
		try { ui.sef.Execute("Stop", 0); ui.sef.Close(); } catch (e) {}
		ui.sef.style.width = "0px"; ui.sef.style.height = "0px";
		S.playerOn = false;
		if (S.returnView === "iptv") { S.view = "iptv"; }
		else if (S.returnView === "detail") { S.view = "detail"; }
	}

	// ===================== KUMANDA =====================
	document.addEventListener("keydown", function (ev) {
		var k = ev.keyCode;
		if (S.playerOn) {
			if (k === KEYS.STOP || k === KEYS.RETURN) { stopPlayer(); ev.preventDefault(); }
			return;
		}
		switch (S.view) {
		case "launcher":
			if (k === KEYS.LEFT && S.tileIdx > 0) { S.tileIdx--; paintTiles(); }
			else if (k === KEYS.RIGHT && S.tileIdx < ui.tiles.children.length - 1) { S.tileIdx++; paintTiles(); }
			else if (k === KEYS.ENTER) openTile(S.tileIdx);
			break;
		case "films":
			if (k === KEYS.UP && S.rowIdx > 0) { S.rowIdx--; S.itemIdx = 0; paintHomeFocus(); }
			else if (k === KEYS.DOWN && S.rowIdx < S.rows.length - 1) { S.rowIdx++; S.itemIdx = 0; paintHomeFocus(); }
			else if (k === KEYS.LEFT && S.itemIdx > 0) { S.itemIdx--; paintHomeFocus(); }
			else if (k === KEYS.RIGHT) {
				var row = S.rows[S.rowIdx];
				if (row && S.itemIdx < row.items.length - 1) { S.itemIdx++; paintHomeFocus(); }
			}
			else if (k === KEYS.ENTER) {
				var it = S.rows[S.rowIdx] && S.rows[S.rowIdx].items[S.itemIdx];
				if (it) openDetail(it);
			}
			else if (k === KEYS.RETURN) gotoLauncher();
			break;
		case "detail":
			if (k === KEYS.RETURN) { gotoFilms(); S.view = "films"; }
			else if (k === KEYS.ENTER) playFilm();
			break;
		case "iptv":
			if (k === KEYS.UP && S.chanIdx > 0) { S.chanIdx--; paintChanFocus(); }
			else if (k === KEYS.DOWN && S.chanIdx < S.channels.length - 1) { S.chanIdx++; paintChanFocus(); }
			else if (k === KEYS.ENTER) playChannel();
			else if (k === KEYS.RETURN) gotoLauncher();
			break;
		}
		if (k === KEYS.EXIT) { /* tv handles */ }
		ev.preventDefault();
	});

	$("btnHome").onclick = gotoLauncher;
	$("btnBack").onclick = function () { gotoFilms(); S.view = "films"; };
	$("btnIptvBack").onclick = gotoLauncher;

	paintTiles();
})(window);
