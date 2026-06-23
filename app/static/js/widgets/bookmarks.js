import { Widget } from "./base.js";
import { escapeHtml, groupBy, matchesSearch } from "../utils.js";

export class BookmarksWidget extends Widget {
  constructor(mountId) {
    super(mountId, "Bookmarks");
    this.bookmarks = [];
    this.sections = [];
    this.searchQuery = "";
  }

  setSearchQuery(query) {
    this.searchQuery = query;
    this.paint();
  }

  async render() {
    const [dashboard, bookmarks] = await Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/bookmarks").then((r) => r.json()),
    ]);

    this.sections = dashboard.sections;
    this.bookmarks = bookmarks.sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned - a.pinned;
      return a.title.localeCompare(b.title);
    });
    this.paint();
  }

  paint() {
    const filtered = this.bookmarks.filter((b) =>
      matchesSearch(b, this.searchQuery, ["title", "section", "url"])
    );

    if (filtered.length === 0) {
      this.mount.innerHTML = this.searchQuery
        ? `<div class="widget-loading">No bookmarks match "${escapeHtml(this.searchQuery)}"</div>`
        : "";
      return;
    }

    const grouped = groupBy(filtered, "section");
    const bookmarksSection = this.sections.find((s) => s.id === "bookmarks");
    const sectionTitles = Object.fromEntries(
      this.sections.map((s) => [s.id, s.title])
    );

    const orderedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === "bookmarks") return -1;
      if (b === "bookmarks") return 1;
      return (sectionTitles[a] || a).localeCompare(sectionTitles[b] || b);
    });

    this.mount.innerHTML = orderedKeys
      .map((sectionId) => {
        const title =
          sectionId === "bookmarks" && bookmarksSection
            ? bookmarksSection.title
            : sectionTitles[sectionId] || sectionId;
        return this.renderSection(title, grouped[sectionId]);
      })
      .join("");
  }

  renderSection(title, bookmarks) {
    const items = bookmarks
      .map(
        (b) => `
        <a
          class="bookmark${b.pinned ? " bookmark--pinned" : ""}"
          href="${escapeHtml(b.url)}"
          target="_blank"
          rel="noopener noreferrer"
        >${escapeHtml(b.title)}</a>
      `
      )
      .join("");

    return `
      <section class="section">
        <h2 class="section__title">${escapeHtml(title)}</h2>
        <div class="bookmark-list">${items}</div>
      </section>
    `;
  }
}
