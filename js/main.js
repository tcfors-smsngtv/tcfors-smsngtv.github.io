/* ============================================================
 * FilmCehennemi — Orsay (2014 H serisi) ana uygulama
 * Sahne yonetimi + kumanda gezinmesi + SEF Player
 * ============================================================ */
(function (w) {
	"use strict";

	var KEYS = {
		UP: 29460, DOWN: 29461, LEFT: 29459, RIGHT: 29458,
		ENTER: 29443, RETURN: 10009, EXIT: 10182, PLAY: 415,
		STOP: 413, BLUE: 402
	};

	var ui = {
		homeScene: document.getElementById("homeScene"),
		rows: document.getElementById("homeRows"),
		detailScene: document.getElementById("detailScene"),
		detailBody: document.getElementById("detailBody"),
		loading: document.getElementById("loading"),
		sef: document.getElementById("sefPlayer")
	};

	var state = {
		view: "home",           // home | detail
		rows: [],               // [{name, items, focusItem, scroll}]
		rowIdx: 0,
		itemIdx: 0,
		playerOn: false,
		streams: [], subs: [],
		streamIdx: 0,
		focusZone: "grid"       // grid | buttons | streams (detay ekrani)
	};

	// ------------------------------------------------------------------
	function show(el, on) { el.className = on ? "scene" : "scene hidden"; }
	function setLoading(on) { ui.loading.className = on ? "" : "hidden"; }

	// ==================================================================
	// ANA SAHNE
	// ==================================================================
	function renderHome() {
		ui.rows.innerHTML = "";
		state.rows.forEach(function (row, r) {
			var wrap = document.createElement("div");
			wrap.className = "row";
			var h = document.createElement("h2");
			h.textContent = row.name;
			wrap.appendChild(h);
			var strip = document.createElement("div");
			strip.className = "strip";
			row.items.forEach(function (it, i) {
				var card = document.createElement("div");
				card.className = "card";
				card.style.backgroundImage = it.poster ? "url('" + it.poster + "')" : "none";
				var lab = document.createElement("div");
				lab.className = "label";
				lab.textContent = it.title;
				card.appendChild(lab);
				strip.appendChild(card);
			});
			wrap.appendChild(strip);
			ui.rows.appendChild(wrap);
		});
		paintHomeFocus();
	}

	function paintHomeFocus() {
		var strips = ui.rows.querySelectorAll(".strip");
		state.rows.forEach(function (row, r) {
			var strip = strips[r];
			if (!strip) return;
			var cards = strip.children;
			for (var i = 0; i < cards.length; i++)
				cards[i].className = "card";
			if (r === state.rowIdx && cards[state.itemIdx])
				cards[state.itemIdx].className = "card focus";
			// yatay kaydirma
			var visible = 8, w = 132 + 12;
			if (state.itemIdx >= visible - 1) {
				strip.scrollLeft = (state.itemIdx - visible + 1) * w;
			} else { strip.scrollLeft = 0; }
		});
	}

	function fetchRows() {
		setLoading(true);
		var proms = [];
		for (var i = 0; i < HFC.config.CATEGORIES.length; i++) (function (idx) {
			proms.push(HFC.getRow(idx, 1).then(function (items) {
				return { name: HFC.config.CATEGORIES[idx].name, items: items };
			}).catch(function () {
				return { name: HFC.config.CATEGORIES[idx].name + " (hata)", items: [] };
			}));
		})(i);
		Promise.all(proms).then(function (rows) {
			state.rows = rows;
			renderHome();
			setLoading(false);
		});
	}

	// ==================================================================
	// DETAY SAHNE
	// ==================================================================
	function openDetail(item) {
		setLoading(true);
		HFC.loadDetail(item.url).then(function (d) {
			state.detail = d;
			ui.detailBody.innerHTML =
				'<div class="poster" style="background-image:url(\'' +
					(d.poster || "").replace(/'/g, "%27") + '\')"></div>' +
				'<div class="info">' +
					'<h3>' + HFC.escape(d.title) + '</h3>' +
					'<p class="desc">' + HFC.escape((d.desc || "").slice(0, 350)) + '</p>' +
					'<div id="playBtn" class="btn">▶  OYNAT</div>' +
				'</div>';
			state.focusZone = "buttons";
			show(ui.homeScene, false);
			show(ui.detailScene, true);
			setLoading(false);
			w.addEventListener("keydown", detailKeysHandler);
		}).catch(function (e) {
			setLoading(false);
			alert("Detay alinamadi: " + e.message);
		});
	}

	function detailKeysHandler(ev) {
		if (state.playerOn) { playerKeys(ev); return; }
		switch (ev.keyCode) {
			case KEYS.RETURN:
				backToHome(); ev.preventDefault(); break;
			case KEYS.ENTER:
				if (state.playerOn) return;
				startResolve(state.detail.url); ev.preventDefault(); break;
		}
	}

	function backToHome() {
		w.removeEventListener("keydown", detailKeysHandler);
		stopPlayer();
		show(ui.detailScene, false);
		show(ui.homeScene, true);
		state.view = "home";
		paintHomeFocus();
	}

	// ==================================================================
	// KAYNAK COZUMLEME + OYNATICI
	// ==================================================================
	function startResolve(url) {
		setLoading(true);
		HFC.resolveStreams(url).then(function (res) {
			setLoading(false);
			state.streams = res.streams; state.subs = res.subs;
			if (!res.streams.length) {
				alert("Cozulebilen kaynak bulunamadi."); return;
			}
			playStream(res.streams[0].url, res.streams[0].isStream);
		}).catch(function (e) {
			setLoading(false);
			alert("Kaynak hatasi: " + e.message);
		});
	}

	function playStream(url, isStream) {
		try {
			ui.sef.style.width = "1280px";
			ui.sef.style.height = "720px";
			ui.sef.setAttribute("classid", "clsid:SAMSUNG-INFOLINK-SEF");
			ui.sef.Open("Player", "1.0", "Player");
			ui.sef.Execute("InitPlayer", url);
			ui.sef.Execute("StartPlayback", -1); // -1 = otomatik
			ui.sef.OnEvent = onPlayerEvent;
			ui.sef.OnStreamInfoReady = onStreamReady;
			ui.sef.OnRenderingComplete = stopPlayer;
			ui.sef.OnConnectionFailed = function (msg) {
				alert("Baglanti hatasi: " + msg); stopPlayer();
			};
			state.playerOn = true;
		} catch (e) {
			alert("Oynatici acilamadi: " + e.message);
		}
	}

	function onStreamReady() {
		// altyazi yukle (destekleyen modellerde)
		if (state.subs && state.subs.length) {
			try { ui.sef.Execute("SetDisplaySubtitle", 1);
				ui.sef.Execute("AddSubtitle", state.subs[0].file);
			} catch (e) {}
		}
	}
	function onPlayerEvent(ev) { /* 4:PLAY, 3:PAUSED, 10:DONE — log amacli */ }

	function stopPlayer() {
		if (!state.playerOn) return;
		try {
			ui.sef.Execute("Stop", 0);
			ui.sef.Close();
		} catch (e) {}
		ui.sef.style.width = "0px";
		ui.sef.style.height = "0px";
		state.playerOn = false;
	}

	function playerKeys(ev) {
		switch (ev.keyCode) {
			case KEYS.STOP: case KEYS.RETURN:
				stopPlayer(); ev.preventDefault(); break;
			case KEYS.PLAY:
				ui.sef.Execute("Resume"); break;
		}
	}

	// ==================================================================
	// KUMANDA ANA DONGU
	// ==================================================================
	document.addEventListener("keydown", function (ev) {
		if (state.view === "detail" || state.playerOn) return; // detay ayri dinler
		switch (ev.keyCode) {
			case KEYS.UP:
				if (state.rowIdx > 0) { state.rowIdx--; state.itemIdx = 0; paintHomeFocus(); }
				ev.preventDefault(); break;
			case KEYS.DOWN:
				if (state.rowIdx < state.rows.length - 1) {
					state.rowIdx++; state.itemIdx = 0; paintHomeFocus(); }
				ev.preventDefault(); break;
			case KEYS.LEFT:
				if (state.itemIdx > 0) { state.itemIdx--; paintHomeFocus(); }
				ev.preventDefault(); break;
			case KEYS.RIGHT:
				var row = state.rows[state.rowIdx];
				if (row && state.itemIdx < row.items.length - 1) {
					state.itemIdx++; paintHomeFocus(); }
				ev.preventDefault(); break;
			case KEYS.ENTER:
				var it = state.rows[state.rowIdx] &&
					state.rows[state.rowIdx].items[state.itemIdx];
				if (it) { state.view = "detail"; openDetail(it); }
				ev.preventDefault(); break;
			case KEYS.BLUE: // kumanda mavi tusu: arama
				doSearch(); ev.preventDefault(); break;
		}
	});

	function doSearch() {
		var q = prompt("Aranacak kelime:", "");
		if (!q) return;
		setLoading(true);
		HFC.search(q).then(function (items) {
			setLoading(false);
			if (!items.length) { alert("Sonuc yok."); return; }
			state.rows.unshift({ name: '"' + q + '" icin sonuç', items: items });
			state.rowIdx = 0; state.itemIdx = 0;
			renderHome();
		});
	}

	// --- Baslangic ------------------------------------------------------
	fetchRows();

})(window);
