(function () {
  "use strict";

  const CFG = window.TIJORI_CONFIG;
  const els = {
    entriesList: document.getElementById("entriesList"),
    entryCount: document.getElementById("entryCount"),
    searchInput: document.getElementById("searchInput"),
    sortSelect: document.getElementById("sortSelect"),
    welcomeHeading: document.getElementById("welcomeHeading"),
    syncStatus: document.getElementById("syncStatus"),
    statusPill: document.querySelector(".status-pill"),
    userEmailLabel: document.getElementById("userEmailLabel"),
    statTotal: document.getElementById("statTotal"),
    statRegions: document.getElementById("statRegions"),
    statDomains: document.getElementById("statDomains"),
    statLast: document.getElementById("statLast"),
  };

  let allVisits = []; // flattened, each with domain attached
  let charts = {};
  let pollTimer = null;

  function getUserEmail() {
    try {
      return localStorage.getItem(CFG.LOCAL_STORAGE_USER_KEY);
    } catch (e) {
      return null;
    }
  }

  function supabaseHeaders() {
    return {
      apikey: CFG.SUPABASE_ANON_KEY,
      Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY,
    };
  }

  function fetchRows(email) {
    const url =
      CFG.SUPABASE_URL.replace(/\/+$/, "") +
      "/rest/v1/" +
      CFG.TABLE +
      "?user_email=eq." +
      encodeURIComponent(email) +
      "&select=id,domain,user_email,traffic_data";

    return fetch(url, { method: "GET", headers: supabaseHeaders() }).then(
      (res) => {
        if (!res.ok) throw new Error("Supabase request failed: " + res.status);
        return res.json();
      }
    );
  }

  function flatten(rows) {
    const out = [];
    rows.forEach((row) => {
      let visits = [];
      try {
        visits = JSON.parse(row.traffic_data);
        if (!Array.isArray(visits)) visits = [visits];
      } catch (e) {
        visits = [];
      }
      visits.forEach((v) => out.push(Object.assign({ domain: row.domain }, v)));
    });
    return out;
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

  function timeAgo(dateStr) {
    if (!dateStr) return "—";
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    const days = Math.floor(hrs / 24);
    return days + "d ago";
  }

  function fmtTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function setStatus(ok, msg) {
    els.syncStatus.textContent = msg;
    els.statusPill.classList.toggle("error", !ok);
  }

  function renderList() {
    const query = (els.searchInput.value || "").toLowerCase().trim();
    const sortMode = els.sortSelect.value;

    let visits = allVisits.slice();

    if (query) {
      visits = visits.filter((v) => {
        return (
          (v.source || "").toLowerCase().includes(query) ||
          (v.region || "").toLowerCase().includes(query) ||
          (v.city || "").toLowerCase().includes(query) ||
          (v.country || "").toLowerCase().includes(query) ||
          (v.domain || "").toLowerCase().includes(query) ||
          (v.page || "").toLowerCase().includes(query)
        );
      });
    }

    visits.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return sortMode === "oldest" ? ta - tb : tb - ta;
    });

    els.entryCount.textContent = visits.length;

    if (!visits.length) {
      els.entriesList.innerHTML =
        '<div class="empty-state">No visits match — try a different search.</div>';
      return;
    }

    els.entriesList.innerHTML = visits
      .map((v) => {
        const { browser, device } = parseDevice(v.userAgent);
        return `
        <div class="entry-card">
          <div class="entry-top">
            <div class="entry-title">${escapeHtml(v.domain || "unknown")}</div>
            <span class="entry-source-tag">${escapeHtml(v.source || "direct")}</span>
          </div>
          <div class="entry-time">${fmtTime(v.timestamp)}</div>
          <div class="entry-meta">
            <b>${escapeHtml(v.city || "Unknown")}</b>, ${escapeHtml(v.region || "Unknown")}, ${escapeHtml(v.country || "Unknown")}<br/>
            ${escapeHtml(browser)} · ${escapeHtml(device)}
          </div>
        </div>`;
      })
      .join("");
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function topCounts(arr, key, limit) {
    const counts = {};
    arr.forEach((v) => {
      const k = v[key] || "Unknown";
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit || 8);
  }

  function palette(n) {
    const colors = [
      "#D97757", "#B85C3F", "#E3A47E", "#8C6A56", "#3E8E5A",
      "#6B9080", "#A4C3B2", "#EAE0D5", "#C89F94", "#7C6A5E",
    ];
    const out = [];
    for (let i = 0; i < n; i++) out.push(colors[i % colors.length]);
    return out;
  }

  function baseOptions(extra) {
    return Object.assign(
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "Inter" } } },
          y: { grid: { color: "#EFE9DC" }, ticks: { font: { family: "Inter" } } },
        },
      },
      extra || {}
    );
  }

  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      delete charts[key];
    }
  }

  function renderTimeline() {
    const ctx = document.getElementById("chartTimeline");
    const buckets = {};
    allVisits.forEach((v) => {
      const d = new Date(v.timestamp);
      const key =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0") +
        " " +
        String(d.getHours()).padStart(2, "0") +
        ":00";
      buckets[key] = (buckets[key] || 0) + 1;
    });
    const labels = Object.keys(buckets).sort();
    const data = labels.map((l) => buckets[l]);

    destroyChart("timeline");
    charts.timeline = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels.map((l) => l.slice(5).replace(" ", " · ")),
        datasets: [
          {
            data,
            borderColor: "#D97757",
            backgroundColor: "rgba(217,119,87,0.12)",
            fill: true,
            tension: 0.35,
            pointRadius: 2,
            pointBackgroundColor: "#D97757",
          },
        ],
      },
      options: baseOptions(),
    });
  }

  function renderSources() {
    const ctx = document.getElementById("chartSources");
    const top = topCounts(allVisits, "source", 6);
    destroyChart("sources");
    charts.sources = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: top.map((t) => t[0]),
        datasets: [{ data: top.map((t) => t[1]), backgroundColor: palette(top.length), borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
      },
    });
  }

  function renderRegions() {
    const ctx = document.getElementById("chartRegions");
    const top = topCounts(allVisits, "region", 6);
    destroyChart("regions");
    charts.regions = new Chart(ctx, {
      type: "bar",
      data: {
        labels: top.map((t) => t[0]),
        datasets: [{ data: top.map((t) => t[1]), backgroundColor: "#D97757", borderRadius: 6 }],
      },
      options: baseOptions({
        indexAxis: "y",
        scales: { x: { grid: { color: "#EFE9DC" } }, y: { grid: { display: false } } },
      }),
    });
  }

  function renderCities() {
    const ctx = document.getElementById("chartCities");
    const top = topCounts(allVisits, "city", 6);
    destroyChart("cities");
    charts.cities = new Chart(ctx, {
      type: "bar",
      data: {
        labels: top.map((t) => t[0]),
        datasets: [{ data: top.map((t) => t[1]), backgroundColor: "#8C6A56", borderRadius: 6 }],
      },
      options: baseOptions({
        indexAxis: "y",
        scales: { x: { grid: { color: "#EFE9DC" } }, y: { grid: { display: false } } },
      }),
    });
  }

  function renderDevices() {
    const ctx = document.getElementById("chartDevices");
    const browsers = allVisits.map((v) => parseDevice(v.userAgent).browser);
    const counts = {};
    browsers.forEach((b) => (counts[b] = (counts[b] || 0) + 1));
    const labels = Object.keys(counts);
    const data = labels.map((l) => counts[l]);
    destroyChart("devices");
    charts.devices = new Chart(ctx, {
      type: "pie",
      data: { labels, datasets: [{ data, backgroundColor: palette(labels.length), borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } },
      },
    });
  }

  function renderStats() {
    els.statTotal.textContent = allVisits.length;
    const regions = new Set(allVisits.map((v) => v.region).filter(Boolean));
    els.statRegions.textContent = regions.size;
    const domains = new Set(allVisits.map((v) => v.domain).filter(Boolean));
    els.statDomains.textContent = domains.size;
    if (allVisits.length) {
      const latest = allVisits.reduce((a, b) =>
        new Date(a.timestamp) > new Date(b.timestamp) ? a : b
      );
      els.statLast.textContent = timeAgo(latest.timestamp);
    } else {
      els.statLast.textContent = "—";
    }
  }

  function renderAllCharts() {
    if (typeof Chart === "undefined") {
      console.error("[Tijori] Chart.js failed to load — check network/ad-block and CDN access.");
      return;
    }
    renderTimeline();
    renderSources();
    renderRegions();
    renderCities();
    renderDevices();
  }

  function refresh(email) {
    fetchRows(email)
      .then((rows) => {
        allVisits = flatten(rows);
        setStatus(true, "Synced from cloud");
        renderList();
        renderStats();
        renderAllCharts();
      })
      .catch((err) => {
        console.error("[Tijori] refresh failed:", err);
        setStatus(false, "Sync failed — retrying");
      });
  }

  function initSidebarToggle() {
    const btn = document.getElementById("hamburgerBtn");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (!btn || !sidebar || !overlay) return;

    function open() {
      sidebar.classList.add("open");
      overlay.classList.add("visible");
      btn.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }
    function close() {
      sidebar.classList.remove("open");
      overlay.classList.remove("visible");
      btn.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
    function toggle() {
      sidebar.classList.contains("open") ? close() : open();
    }

    btn.addEventListener("click", toggle);
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    const mq = window.matchMedia("(max-width: 1080px)");
    mq.addEventListener("change", (e) => {
      if (!e.matches) close();
    });
  }

  function init() {
    initSidebarToggle();
    const email = getUserEmail();

    if (!email) {
      els.welcomeHeading.textContent = "No user signed in";
      els.userEmailLabel.textContent = "vcloud_user not set";
      setStatus(false, "Waiting for user");
      els.entriesList.innerHTML =
        '<div class="empty-state">Sign in to see your traffic — vcloud_user is missing from localStorage.</div>';
      return;
    }

    const name = email.split("@")[0].split(/[.\-_]/)[0];
    els.welcomeHeading.textContent =
      "Welcome, " + localStorage.getItem("vcloud_username").split(" ")[0] || name.charAt(0).toUpperCase() + name.slice(1);
    els.userEmailLabel.textContent = email;

    refresh(email);

    els.searchInput.addEventListener("input", renderList);
    els.sortSelect.addEventListener("change", renderList);

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => refresh(email), CFG.POLL_INTERVAL_MS);
  }

  document.addEventListener("DOMContentLoaded", init);
})();