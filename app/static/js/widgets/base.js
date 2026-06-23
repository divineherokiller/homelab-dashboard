export class Widget {
  constructor(mountId, name) {
    this.mount = document.getElementById(mountId);
    this.name = name;
  }

  showLoading() {
    this.mount.innerHTML = `<div class="widget-loading">Loading ${this.name}…</div>`;
  }

  showError(message) {
    this.mount.innerHTML = `
      <div class="widget-error" role="alert">
        <strong>${this.name} failed to load</strong>
        ${message}
      </div>
    `;
  }

  async init() {
    this.showLoading();
    try {
      await this.render();
    } catch (err) {
      console.error(`[${this.name}]`, err);
      this.showError(err.message || "Unknown error");
    }
  }

  async render() {
    throw new Error("render() must be implemented");
  }
}
