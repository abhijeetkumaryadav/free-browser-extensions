// Research Journey Mapper — manual milestone logbook rendered as a visual timeline.
// Honest scope: only shows milestones the user logs. Never reads browsing history.

"use strict";

const $ = (id) => document.getElementById(id);

const TYPE_META = {
  question: { label: "Question", cls: "q" },
  source:   { label: "Source",   cls: "s" },
  draft:    { label: "Draft",    cls: "d2" },
  decision: { label: "Decision", cls: "dc" },
  note:     { label: "Note",     cls: "" },
};

const store = {
  load(cb) { chrome.storage.local.get("milestones", (r) => cb(Array.isArray(r.milestones) ? r.milestones : [])); },
  save(items, cb) { chrome.storage.local.set({ milestones: items }, cb); },
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtDate(iso) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

function render(items) {
  const filter = $("typeFilter").value;
  const shown = items
    .filter((m) => !filter || m.type === filter)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.id - a.id);

  if (!shown.length) {
    $("timeline").innerHTML = '<div class="empty">No milestones yet.<br>Log your first one to start the journey.</div>';
    return;
  }
  $("timeline").innerHTML = shown.map((m) => {
    const meta = TYPE_META[m.type] || TYPE_META.note;
    return `<div class="node ${meta.cls}">
      <button class="del" data-id="${m.id}" title="Delete">×</button>
      <div class="trow"><span class="tag">${esc(meta.label)}</span><span class="date">${esc(fmtDate(m.date))}</span></div>
      <div class="title">${esc(m.title)}</div>
      ${m.detail ? `<div class="detail">${esc(m.detail)}</div>` : ""}
    </div>`;
  }).join("");

  $("timeline").querySelectorAll(".del").forEach((btn) => {
    btn.addEventListener("click", () => deleteMilestone(Number(btn.dataset.id)));
  });
}

function deleteMilestone(id) {
  store.load((items) => {
    store.save(items.filter((m) => m.id !== id), () => refresh());
  });
}

function refresh() {
  store.load(render);
}

function addMilestone() {
  const type = $("mType").value;
  const title = $("mTitle").value.trim();
  const date = $("mDate").value || new Date().toISOString().slice(0, 10);
  const detail = $("mDetail").value.trim();
  if (!title) { $("mTitle").focus(); return; }
  store.load((items) => {
    items.push({ id: Date.now(), type, title, date, detail });
    store.save(items, () => {
      $("mTitle").value = "";
      $("mDetail").value = "";
      $("mDate").value = "";
      switchTab("timeline");
      refresh();
    });
  });
}

function exportSummary() {
  store.load((items) => {
    const lines = items
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((m) => {
        const meta = TYPE_META[m.type] || TYPE_META.note;
        return `- [${m.date}] ${meta.label}: ${m.title}${m.detail ? " — " + m.detail : ""}`;
      });
    const text = `# Research Journey (${items.length} milestones)\n\n${lines.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
    chrome.downloads.download({ url, filename: "research-journey.md", saveAs: true });
  });
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $("tab-timeline").classList.toggle("hidden", name !== "timeline");
  $("tab-add").classList.toggle("hidden", name !== "add");
}

document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => switchTab(t.dataset.tab))
);
$("typeFilter").addEventListener("change", refresh);
$("saveBtn").addEventListener("click", addMilestone);
$("exportBtn").addEventListener("click", exportSummary);

refresh();
