import { ServicesWidget } from "./widgets/services.js";
import { BookmarksWidget } from "./widgets/bookmarks.js";

const servicesWidget = new ServicesWidget("widget-services", {
  onStatusUpdate: updateHeaderSummary,
});

const bookmarksWidget = new BookmarksWidget("widget-bookmarks");

let refreshTimer = null;
let refreshSeconds = 90;

async function loadDashboardMeta() {
  const dashboard = await fetch("/api/dashboard").then((r) => r.json());
  document.getElementById("dashboard-title").textContent = dashboard.title;
  document.title = dashboard.title;
  refreshSeconds = dashboard.refresh_seconds;
}

function updateHeaderSummary(statusData) {
  const el = document.getElementById("status-summary");
  const { summary } = statusData;
  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  const up = summary.up || 0;
  el.textContent = total > 0 ? `${up}/${total} up` : "";

  const refreshEl = document.getElementById("last-refresh");
  const now = new Date().toLocaleTimeString();
  refreshEl.textContent = `Last checked: ${now}`;
}

async function refreshStatus() {
  try {
    const statusData = await fetch("/api/status").then((r) => r.json());
    servicesWidget.setStatus(statusData.services);
    updateHeaderSummary(statusData);
  } catch (err) {
    console.warn("[Status refresh]", err);
  }
}

function startRefreshLoop() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshStatus, refreshSeconds * 1000);
}

function setupSearch() {
  const input = document.getElementById("search-input");
  input.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    servicesWidget.setSearchQuery(query);
    bookmarksWidget.setSearchQuery(query);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
  });
}

function setupReload() {
  document.getElementById("reload-btn").addEventListener("click", async () => {
    const btn = document.getElementById("reload-btn");
    btn.disabled = true;
    btn.textContent = "Reloading…";
    try {
      await fetch("/api/reload", { method: "POST" });
      await loadDashboardMeta();
      await Promise.all([servicesWidget.init(), bookmarksWidget.init()]);
      startRefreshLoop();
    } catch (err) {
      alert(`Reload failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "Reload config";
    }
  });
}

async function init() {
  try {
    await loadDashboardMeta();
  } catch (err) {
    console.error("[Dashboard meta]", err);
  }

  setupSearch();
  setupReload();

  await Promise.all([
    servicesWidget.init(),
    bookmarksWidget.init(),
  ]);

  startRefreshLoop();
}

init();
