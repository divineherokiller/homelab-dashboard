import { Widget } from "./base.js";
import { escapeHtml, groupBy, matchesSearch } from "../utils.js";

export class ServicesWidget extends Widget {
  constructor(mountId, { onStatusUpdate } = {}) {
    super(mountId, "Services");
    this.onStatusUpdate = onStatusUpdate;
    this.services = [];
    this.sections = [];
    this.statusMap = {};
    this.searchQuery = "";
  }

  setSearchQuery(query) {
    this.searchQuery = query;
    this.paint();
  }

  setStatus(statuses) {
    this.statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));
    this.paint();
  }

  async render() {
    const [dashboard, services] = await Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
    ]);

    this.sections = dashboard.sections.filter((s) => s.id !== "bookmarks");
    this.services = services;
    this.paint();

    try {
      const statusData = await fetch("/api/status").then((r) => r.json());
      this.setStatus(statusData.services);
      if (this.onStatusUpdate) {
        this.onStatusUpdate(statusData);
      }
    } catch (err) {
      console.warn("[Services] Status check unavailable:", err);
    }
  }

  paint() {
    const filtered = this.services.filter((s) =>
      matchesSearch(s, this.searchQuery, ["name", "section", "id"])
    );

    if (filtered.length === 0) {
      this.mount.innerHTML = this.searchQuery
        ? `<div class="widget-loading">No services match "${escapeHtml(this.searchQuery)}"</div>`
        : `<div class="widget-loading">No services configured</div>`;
      return;
    }

    const grouped = groupBy(filtered, "section");
    const sectionOrder = this.sections.map((s) => s.id);
    const sectionTitles = Object.fromEntries(
      this.sections.map((s) => [s.id, s.title])
    );

    const orderedKeys = [
      ...sectionOrder.filter((id) => grouped[id]),
      ...Object.keys(grouped).filter((id) => !sectionOrder.includes(id)),
    ];

    this.mount.innerHTML = orderedKeys
      .map((sectionId) => this.renderSection(sectionId, sectionTitles[sectionId] || sectionId, grouped[sectionId]))
      .join("");
  }

  renderSection(sectionId, title, services) {
    const cards = services.map((s) => this.renderCard(s)).join("");
    return `
      <section class="section" data-section="${escapeHtml(sectionId)}">
        <h2 class="section__title">${escapeHtml(title)}</h2>
        <div class="card-grid">${cards}</div>
      </section>
    `;
  }

  renderCard(service) {
    const status = this.statusMap[service.id];
    const statusClass = status ? status.status : "unknown";
    const statusLabel = status ? status.status : "unknown";
    const title = status?.message ? ` title="${escapeHtml(status.message)}"` : "";

    return `
      <a class="card" href="${escapeHtml(service.url)}" target="_blank" rel="noopener noreferrer">
        <span class="card__name">${escapeHtml(service.name)}</span>
        <span class="card__status"${title}>
          <span class="status-dot status-dot--${statusClass}"></span>
          ${escapeHtml(statusLabel)}
        </span>
      </a>
    `;
  }
}
