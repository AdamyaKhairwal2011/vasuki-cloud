(function () {
  "use strict";
  const CFG = window.TIJORI_CONFIG;
  const $ = (id) => document.getElementById(id);
  let allVisits = [];
  let charts = {};
  const INK = "#6B655D", LINE = "#E7E1D6", ACCENT = "#D97757";
  const COLORS = ["#D97757","#B85C3F","#E3A47E","#8C6A56","#3E8E5A","#6B9080","#A4C3B2","#C89F94","#7C6A5E"];

  function getUserEmail() {
    try { return localStorage.getItem(CFG.LOCAL_STORAGE_USER_KEY); } catch (e) { return null; }
  }
  function fetchRows(email) {
    const url = CFG.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/" + CFG.TABLE +
      "?user_email=eq." + encodeURIComponent(email) + "&select=id,domain,user_email,traffic_data";
    return fetch(url, { headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY } })
      .then((r) => { if (!r.ok) throw new Error("Supabase request failed: " + r.status); return r.json(); });
  }
  function flatten(rows) {
    const out = [];
    rows.forEach((row) => {
      let visits = [];
      try { visits = JSON.parse(row.traffic_data); if (!Array.isArray(visits)) visits = [visits]; } catch (e) {}
      visits.forEach((v) => out.push(Object.assign({ domain: row.domain }, v)));
    });
    return out;
  }
  function parseDevice(ua) {
    if (!ua) return "Unknown";
    if (/Edg\//.test(ua)) return "Edge";
    if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
    return "Other";
  }
  function topCounts(arr, key, limit) {
    const c = {};
    arr.forEach((v) => { const k = v[key] || "Unknown"; c[k] = (c[k] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, limit || 6);
  }
  function setStatus(ok, msg) {
    $("syncStatus").textContent = msg;
    document.querySelector(".status-pill").classList.toggle("error", !ok);
  }
  function make(key, id, cfg) {
    if (charts[key]) charts[key].destroy();
    charts[key] = new Chart($(id), cfg);
  }
  const font = { family: "Helvetica Neue, Helvetica, Arial, sans-serif", size: 11 };
  const axisX = { grid: { display: false }, border: { display: false }, ticks: { color: INK, font } };
  const axisY = { grid: { color: LINE }, border: { display: false }, ticks: { color: INK, font, precision: 0 } };
  const base = (extra) => Object.assign({ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: axisX, y: axisY } }, extra || {});
  const legendOpts = { responsive: true, maintainAspectRatio: false, cutout: "72%", plugins: { legend: { position: "right", labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, color: INK, font } } } };

  function visible() {
    const d = $("domainSelect").value;
    return d ? allVisits.filter((v) => v.domain === d) : allVisits;
  }

  function render() {
    if (typeof Chart === "undefined") { console.error("[Tijori] Chart.js failed to load"); return; }
    const data = visible();

    // timeline
    const b = {};
    data.forEach((v) => {
      const d = new Date(v.timestamp);
      const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":00";
      b[k] = (b[k] || 0) + 1;
    });
    const tl = Object.keys(b).sort();
    make("timeline", "chartTimeline", { type: "line", data: { labels: tl.map((l) => l.slice(5).replace(" ", " · ")), datasets: [{ data: tl.map((l) => b[l]), borderColor: ACCENT, backgroundColor: "rgba(217,119,87,0.08)", fill: true, tension: 0.35, borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 4 }] }, options: base() });

    // sources
    const src = topCounts(data, "source", 6);
    make("sources", "chartSources", { type: "doughnut", data: { labels: src.map((t) => t[0]), datasets: [{ data: src.map((t) => t[1]), backgroundColor: COLORS, borderWidth: 0 }] }, options: legendOpts });

    // regions + cities
    [["regions", "chartRegions", "region", ACCENT], ["cities", "chartCities", "city", "#8C6A56"]].forEach(([k, id, f, col]) => {
      const top = topCounts(data, f, 6);
      make(k, id, { type: "bar", data: { labels: top.map((t) => t[0]), datasets: [{ data: top.map((t) => t[1]), backgroundColor: col, borderRadius: 3, barThickness: 10 }] }, options: base({ indexAxis: "y", scales: { x: axisY, y: axisX } }) });
    });

    // devices
    const dev = {};
    data.forEach((v) => { const k = parseDevice(v.userAgent); dev[k] = (dev[k] || 0) + 1; });
    const dl = Object.keys(dev);
    make("devices", "chartDevices", { type: "doughnut", data: { labels: dl, datasets: [{ data: dl.map((l) => dev[l]), backgroundColor: COLORS, borderWidth: 0 }] }, options: legendOpts });

    // hourly
    const hrs = new Array(24).fill(0);
    data.forEach((v) => { const h = new Date(v.timestamp).getHours(); if (!isNaN(h)) hrs[h]++; });
    make("hourly", "chartHourly", { type: "bar", data: { labels: hrs.map((_, i) => String(i).padStart(2, "0")), datasets: [{ data: hrs, backgroundColor: ACCENT, borderRadius: 3 }] }, options: base() });

    // new vs repeat
    const ips = {};
    data.forEach((v) => { if (v.ip) ips[v.ip] = (ips[v.ip] || 0) + 1; });
    const vals = Object.values(ips);
    const nu = vals.filter((n) => n === 1).length, rp = vals.length - nu;
    make("repeat", "chartRepeat", { type: "doughnut", data: { labels: ["New (1 visit)", "Repeat"], datasets: [{ data: [nu, rp], backgroundColor: ["#3E8E5A", ACCENT], borderWidth: 0 }] }, options: legendOpts });
  }

  function fillDomains() {
    const sel = $("domainSelect"), cur = sel.value;
    const domains = Array.from(new Set(allVisits.map((v) => v.domain).filter(Boolean))).sort();
    sel.innerHTML = '<option value="">All domains</option>' + domains.map((d) => '<option value="' + d.replace(/"/g, "&quot;") + '">' + d.replace(/</g, "&lt;") + "</option>").join("");
    sel.value = domains.includes(cur) ? cur : "";
  }

  function refresh(email) {
    fetchRows(email).then((rows) => {
      allVisits = flatten(rows);
      fillDomains();
      setStatus(true, "Synced from cloud");
      render();
    }).catch((err) => { console.error("[Tijori] refresh failed:", err); setStatus(false, "Sync failed — retrying"); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    const email = getUserEmail();
    if (!email) { setStatus(false, "Waiting for user"); return; }
    $("domainSelect").addEventListener("change", render);
    refresh(email);
    setInterval(() => refresh(email), CFG.POLL_INTERVAL_MS);
  });
})();