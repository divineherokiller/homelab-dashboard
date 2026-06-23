export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const groupKey = item[key] || "other";
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {});
}

export function matchesSearch(item, query, fields) {
  if (!query) return true;
  const lower = query.toLowerCase();
  return fields.some((field) => {
    const value = item[field];
    return value && String(value).toLowerCase().includes(lower);
  });
}
