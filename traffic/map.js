(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const overlay = $("mapOverlay");
  if (!overlay || typeof L === "undefined") {
    console.error("[Tijori] Map overlay markup or Leaflet is missing.");
    return;
  }

  const GEO_KEY = "tijori_geo_cache_v1";
  const els = {
    openBtn: $("openMapBtn"),
    backBtn: $("mapBackBtn"),
    canvas: $("mapCanvas"),
    meta: $("mapMeta"),
    empty: $("mapEmpty"),
  };

  let map = null;
  let layer = null;
  let isOpen = false;
  let popupOpen = false;
  let dirty = false;
  let userMoved = false;
  let runId = 0;
  let lastFocus = null;
  let lastReq = 0;
  let cache = readCache();

  /* ---------- helpers ---------- */

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(GEO_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveCache() {
    try {
      localStorage.setItem(GEO_KEY, JSON.stringify(cache));
    } catch (e) {}
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function clean(s) {
    s = s == null ? "" : String(s).trim();
    return /^(unknown|n\/a|null|undefined|none|-|—)$/i.test(s) ? "" : s;
  }
  function num(x) {
    const n = typeof x === "string" ? parseFloat(x) : x;
    return Number.isFinite(n) ? n : null;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function coordsOf(v) {
    const lat = num(v.latitude != null ? v.latitude : v.lat);
    const lng = num(v.longitude != null ? v.longitude : v.lon != null ? v.lon : v.lng);
    if (lat == null || lng == null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
    return { lat, lng };
  }

  function parseDevice(ua) {
    if (!ua) return { browser: "Unknown", device: "Unknown" };
    let browser = "Other";
    if (/Edg\//.test(ua)) browser = "Edge";
    else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
    else if (/Firefox\//.test(ua)) browser = "Firefox";
    else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
    let device = "Desktop";
    if (/Mobile|Android/.test(ua)) device = "Mobile";
    else if (/iPad|Tablet/.test(ua)) device = "Tablet";
    return { browser, device };
  }

  function isBot(v) {
    if (v.isBot === true || v.bot === true) return true;
    return /bot|crawl|spider|slurp|headless|preview/i.test(v.userAgent || "");
  }

  function fmtFull(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return "—";
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function placeLabel(g) {
    return [g.city, g.region, g.country].filter(Boolean).join(", ") || "Unknown location";
  }

  /* ---------- grouping and geocoding ---------- */

  function groupVisits(visits) {
    const groups = new Map();
    let unlocated = 0;
    visits.forEach((v) => {
      const city = clean(v.city), region = clean(v.region), country = clean(v.country);
      const c = coordsOf(v);
      let key;
      if (c) key = "ll:" + c.lat.toFixed(1) + "," + c.lng.toFixed(1);
      else if (city || region || country) key = ["t", city, region, country].join("|").toLowerCase();
      else { unlocated++; return; }
      let g = groups.get(key);
      if (!g) {
        g = { key, city, region, country, lat: c ? c.lat : null, lng: c ? c.lng : null, visits: [] };
        groups.set(key, g);
      }
      g.visits.push(v);
    });
    return { groups: Array.from(groups.values()), unlocated };
  }

  async function lookup(q) {
    if (q in cache) return cache[q];
    const wait = Math.max(0, 1100 - (Date.now() - lastReq));
    if (wait) await sleep(wait);
    lastReq = Date.now();
    const res = await fetch(
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=en&q=" +
        encodeURIComponent(q)
    );
    if (!res.ok) throw new Error("Geocoder " + res.status);
    const arr = await res.json();
    cache[q] = arr && arr[0] ? { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) } : false;
    saveCache();
    return cache[q];
  }

  async function locate(g) {
    const tries = [
      [g.city, g.region, g.country],
      [g.region, g.country],
      [g.country],
    ]
      .map((a) => a.filter(Boolean).join(", "))
      .filter(Boolean);
    for (const q of Array.from(new Set(tries))) {
      const r = await lookup(q);
      if (r) return r;
    }
    return null;
  }

  /* ---------- markers and popups ---------- */

  function pinIcon(n) {
    const size = n > 1 ? 34 : 22;
    const label = n > 1 ? "<i>" + (n > 99 ? "99+" : n) + "</i>" : "";
    return L.divIcon({
      className: "vm-marker",
      html: '<span class="vm-pin" style="width:' + size + "px;height:" + size + 'px">' + label + "</span>",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }

  function popupHtml(g) {
    const MAX = 20;
    const sorted = g.visits.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const ips = new Set(sorted.map((v) => v.ip).filter(Boolean));
    const sub =
      sorted.length + (sorted.length === 1 ? " visit" : " visits") +
      (ips.size ? " · " + ips.size + (ips.size === 1 ? " IP" : " unique IPs") : "");

    const items = sorted.slice(0, MAX).map((v) => {
      const { browser, device } = parseDevice(v.userAgent);
      const rows = [
        ["Source", v.source || "direct"],
        v.page ? ["Page", v.page] : null,
        v.ip ? ["IP", v.ip] : null,
        ["Client", browser + " · " + device],
      ].filter(Boolean);
      return (
        '<div class="vm-visit">' +
        '<div class="vm-visit-top"><span class="vm-visit-domain">' + esc(v.domain || "unknown") + "</span>" +
        (isBot(v) ? '<span class="vm-bot">Bot</span>' : "") + "</div>" +
        '<div class="vm-visit-time">' + esc(fmtFull(v.timestamp)) + "</div>" +
        '<dl class="vm-visit-rows">' +
        rows.map((r) => "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>").join("") +
        "</dl></div>"
      );
    });

    return (
      '<div class="vm-pop"><div class="vm-pop-head"><div class="vm-pop-place">' + esc(placeLabel(g)) +
      '</div><div class="vm-pop-sub">' + esc(sub) + "</div></div>" +
      '<div class="vm-pop-list">' + items.join("") +
      (sorted.length > MAX
        ? '<div class="vm-more">+ ' + (sorted.length - MAX) + " older visits from here</div>"
        : "") +
      "</div></div>"
    );
  }

  function addMarker(g, pos) {
    L.marker([pos.lat, pos.lng], { icon: pinIcon(g.visits.length), title: placeLabel(g) })
      .bindPopup(() => popupHtml(g), {
        className: "vm-popup",
        minWidth: 280,
        maxWidth: 340,
        autoPanPaddingTopLeft: [24, 80],
        autoPanPaddingBottomRight: [24, 24],
      })
      .addTo(layer);
  }

  /* ---------- build ---------- */

  async function build() {
    const id = ++runId;
    dirty = false;
    layer.clearLayers();
    els.empty.hidden = true;

    const visits = Array.isArray(window.TIJORI_VISITS) ? window.TIJORI_VISITS : [];
    const { groups, unlocated } = groupVisits(visits);
    groups.sort((a, b) => b.visits.length - a.visits.length);

    const bounds = [];
    let placed = 0, failed = 0;

    function setMeta(busy) {
      let t = visits.length + (visits.length === 1 ? " visit" : " visits") + " · " + placed +
        (placed === 1 ? " place" : " places");
      if (unlocated) t += " · " + unlocated + " without location";
      if (failed) t += " · " + failed + " not found";
      if (busy) t += " · locating " + (placed + failed + 1) + " of " + groups.length + "…";
      els.meta.textContent = t;
    }

    setMeta(groups.length > 0);

    for (const g of groups) {
      if (id !== runId) return;
      let pos = g.lat != null ? { lat: g.lat, lng: g.lng } : null;
      if (!pos) {
        try {
          pos = await locate(g);
        } catch (e) {
          console.warn("[Tijori] Geocoding failed for", placeLabel(g), e);
          await sleep(1500);
        }
      }
      if (id !== runId) return;
      if (pos) {
        addMarker(g, pos);
        bounds.push([pos.lat, pos.lng]);
        placed++;
        if (!userMoved) map.fitBounds(bounds, { padding: [70, 70], maxZoom: 6 });
      } else {
        failed++;
      }
      setMeta(placed + failed < groups.length);
    }

    if (id !== runId) return;
    setMeta(false);
    if (!placed) els.empty.hidden = false;
  }

  /* ---------- open / close ---------- */

  function ensureMap() {
    if (map) return;
    map = L.map(els.canvas, {
      zoomControl: false,
      worldCopyJump: true,
      minZoom: 2,
      zoomSnap: 1,
    }).setView([22, 20], 2);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://data.lfmaps.fr/natural_earth/ne2sr/{z}/{x}/{y}.png", {
      maxZoom: 19,
      maxNativeZoom: 6,
      attribution:
        '&copy; <a href="https://www.naturalearthdata.com/">Natural Earth</a>',
    }).addTo(map);

    map.createPane("labels");
    map.getPane("labels").style.zIndex = 450;
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      {
        pane: "labels",
        maxZoom: 19,
        maxNativeZoom: 16,
        updateWhenZooming: false,
        keepBuffer: 1,
        attribution: "Labels &copy; Esri",
      }
    ).addTo(map);
    layer = L.layerGroup().addTo(map);

    ["mousedown", "touchstart", "wheel"].forEach((ev) =>
      els.canvas.addEventListener(ev, () => { userMoved = true; }, { passive: true })
    );
    map.on("popupopen", () => { popupOpen = true; });
    map.on("popupclose", () => {
      popupOpen = false;
      if (dirty && isOpen) build();
    });
  }

  function closeSidebar() {
    const s = $("sidebar");
    const o = $("sidebarOverlay");
    if (s && o && s.classList.contains("open")) o.click();
  }

  function open() {
    if (isOpen) return;
    closeSidebar();
    lastFocus = document.activeElement;
    ensureMap();
    isOpen = true;
    userMoved = false;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("vm-lock");
    map.invalidateSize();
    build();
    els.backBtn.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    runId++;
    if (map) map.closePopup();
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("vm-lock");
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  els.openBtn && els.openBtn.addEventListener("click", open);
  els.backBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) close();
  });
  document.addEventListener("tijori:visits", () => {
    if (!isOpen) return;
    if (popupOpen) dirty = true;
    else build();
  });
})();