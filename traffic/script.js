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

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
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

  function renderStats() {
    els.statTotal.textContent = allVisits.length;
    const regions = new Set(allVisits.map((v) => v.region).filter(Boolean));
    els.statRegions.textContent = regions.size;
    if (els.statDomains) {
      const domains = new Set(allVisits.map((v) => v.domain).filter(Boolean));
      els.statDomains.textContent = domains.size;
    }
    if (allVisits.length) {
      const latest = allVisits.reduce((a, b) =>
        new Date(a.timestamp) > new Date(b.timestamp) ? a : b
      );
      els.statLast.textContent = timeAgo(latest.timestamp);
    } else {
      els.statLast.textContent = "—";
    }
  }

  function refresh(email) {
    fetchRows(email)
      .then((rows) => {
        allVisits = flatten(rows);

        // Share visits with the map overlay (map.js) and tell it data changed.
        window.TIJORI_VISITS = allVisits;
        document.dispatchEvent(new CustomEvent("tijori:visits"));

        setStatus(true, "Synced from cloud");
        renderList();
        renderStats();
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
    let storedName = "";
    try {
      storedName = localStorage.getItem("vcloud_username") || "";
    } catch (e) {}
    const firstName =
      storedName.split(" ")[0] || name.charAt(0).toUpperCase() + name.slice(1);
    els.welcomeHeading.textContent = "Welcome, " + firstName + ".";
    els.userEmailLabel.textContent = email;

    refresh(email);

    els.searchInput.addEventListener("input", renderList);
    els.sortSelect.addEventListener("change", renderList);

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => refresh(email), CFG.POLL_INTERVAL_MS);
  }

  document.addEventListener("DOMContentLoaded", init);
})();