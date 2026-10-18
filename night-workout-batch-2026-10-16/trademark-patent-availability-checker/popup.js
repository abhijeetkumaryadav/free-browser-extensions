/* Trademark Search Helper — popup logic.
 * Honest scope: this builds links to official trademark-office search pages
 * and keeps a local logbook. It does NOT check availability and is NOT
 * legal clearance. All data stays in chrome.storage.local. */
"use strict";

const KEY = "tm_candidates_v1";

/* Official search endpoints (stable public URLs). */
const OFFICES = {
  uspto: {
    el: "link-uspto",
    build: (q) =>
      "https://tsdr.uspto.gov/#caseSearch=" +
      encodeURIComponent(q) + "&caseSearchType=US_APPLICATION",
  },
  euipo: {
    el: "link-euipo",
    build: (q) =>
      "https://euipo.europa.eu/eSearch/#search/all-terms?searchTerm=" +
      encodeURIComponent(q),
  },
  wipo: {
    el: "link-wipo",
    build: (q) =>
      "https://www3.wipo.int/branddb/en/#q=" +
      encodeURIComponent(q),
  },
};

const candidateEl = document.getElementById("candidate");
const noteEl = document.getElementById("note");
const logBtn = document.getElementById("log-btn");
const logEl = document.getElementById("log");
const searchEl = document.getElementById("search");
const countEl = document.getElementById("count");

/** Refresh the three office links from the current candidate text. */
function refreshLinks() {
  const q = candidateEl.value.trim();
  for (const key of Object.keys(OFFICES)) {
    const a = document.getElementById(OFFICES[key].el);
    if (q) {
      a.href = OFFICES[key].build(q);
      a.removeAttribute("aria-disabled");
    } else {
      a.href = "#";
    }
  }
}

async function loadLog() {
  const data = await chrome.storage.local.get(KEY);
  return data[KEY] || [];
}

async function saveLog(items) {
  await chrome.storage.local.set({ [KEY]: items });
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return iso;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function renderLog(filter = "") {
  const items = await loadLog();
  const f = filter.trim().toLowerCase();
  const shown = items.filter((it) =>
    !f || it.name.toLowerCase().includes(f) || (it.note || "").toLowerCase().includes(f));
  countEl.textContent = items.length ? `(${items.length})` : "";
  logEl.innerHTML = "";
  if (!shown.length) {
    logEl.innerHTML = `<li class="empty">No candidates logged yet.</li>`;
    return;
  }
  for (const it of shown) {
    const li = document.createElement("li");
    li.innerHTML =
      `<div class="name">${escapeHtml(it.name)}</div>` +
      `<div class="meta">Checked ${fmtDate(it.date)}</div>` +
      (it.note ? `<div class="note">${escapeHtml(it.note)}</div>` : "") +
      `<div class="actions"><button class="danger" data-id="${it.id}">Remove</button></div>`;
    logEl.appendChild(li);
  }
  logEl.querySelectorAll("button.danger").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const items = await loadLog();
      await saveLog(items.filter((it) => it.id !== btn.dataset.id));
      renderLog(searchEl.value);
    });
  });
}

logBtn.addEventListener("click", async () => {
  const name = candidateEl.value.trim();
  if (!name) return;
  const items = await loadLog();
  items.unshift({
    id: Date.now().toString(36),
    name,
    note: noteEl.value.trim(),
    date: new Date().toISOString(),
  });
  await saveLog(items);
  noteEl.value = "";
  renderLog(searchEl.value);
});

candidateEl.addEventListener("input", refreshLinks);
searchEl.addEventListener("input", () => renderLog(searchEl.value));

refreshLinks();
renderLog();
