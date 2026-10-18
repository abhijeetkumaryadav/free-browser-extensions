/* Launch Window Planner — popup logic. Fully local, chrome.storage.local only. */
"use strict";

// ENGINE-START — pure, headless-testable window engine
/**
 * Build a planned launch window entry. Returns null when invalid.
 */
function makeWindow(name, whenISO, target, note) {
  const n = (name || "").trim();
  if (!n) return null;
  const t = Date.parse(whenISO);
  if (Number.isNaN(t)) return null;
  return {
    id: "w" + t + "-" + Math.floor(Math.random() * 1e6),
    name: n,
    when: new Date(t).toISOString(),
    target: (target || "").trim(),
    note: (note || "").trim()
  };
}

/** Split windows into upcoming (sorted ascending) and past (sorted descending). */
function splitWindows(list, nowMs) {
  const upcoming = [];
  const past = [];
  for (const w of list || []) {
    if (Date.parse(w.when) >= nowMs) upcoming.push(w);
    else past.push(w);
  }
  upcoming.sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
  past.sort((a, b) => Date.parse(b.when) - Date.parse(a.when));
  return { upcoming, past };
}

/** The next upcoming window, or null. */
function nextWindow(list, nowMs) {
  const { upcoming } = splitWindows(list, nowMs);
  return upcoming.length ? upcoming[0] : null;
}

/** Break ms into {d, h, m, s}; clamps negatives to zero. */
function countdownParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60
  };
}

/** "2d 4h 13m 05s" style formatting. */
function fmtCountdown(p) {
  const two = (n) => String(n).padStart(2, "0");
  const bits = [];
  if (p.d > 0) bits.push(p.d + "d");
  bits.push(two(p.h) + "h", two(p.m) + "m", two(p.s) + "s");
  return bits.join(" ");
}

/** Friendly local date/time for a stored ISO string. */
function fmtWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}
// ENGINE-END

/* ---------------- UI ---------------- */
const $ = (id) => document.getElementById(id);
const STORE_KEY = "lwWindows";

async function loadWindows() {
  const data = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(data[STORE_KEY]) ? data[STORE_KEY] : [];
}
async function saveWindows(list) {
  await chrome.storage.local.set({ [STORE_KEY]: list });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

const trashSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

async function render() {
  const list = await loadWindows();
  const now = Date.now();
  const { upcoming, past } = splitWindows(list, now);

  // Next-window hero card
  const next = upcoming[0] || null;
  if (next) {
    $("nextName").textContent = next.name;
    $("nextCountdown").textContent = fmtCountdown(countdownParts(Date.parse(next.when) - now));
    $("nextMeta").textContent =
      fmtWhen(next.when) + (next.target ? " · target: " + next.target : "");
  } else {
    $("nextName").textContent = "No windows yet";
    $("nextCountdown").textContent = "—";
    $("nextMeta").textContent = "";
  }

  // List
  const box = $("list");
  box.innerHTML = "";
  $("emptyMsg").style.display = list.length ? "none" : "block";
  const rows = [...upcoming.map((w) => ({ w, past: false })), ...past.map((w) => ({ w, past: true }))];
  for (const { w, past: isPast } of rows) {
    const div = document.createElement("div");
    div.className = "item" + (isPast ? " past" : "");
    const cd = isPast ? "closed" : fmtCountdown(countdownParts(Date.parse(w.when) - now));
    div.innerHTML =
      '<div class="grow">' +
        '<div class="nm">' + esc(w.name) + '</div>' +
        '<div class="dt">' + esc(fmtWhen(w.when)) + (w.target ? " · " + esc(w.target) : "") + '</div>' +
        (w.note ? '<div class="nt">' + esc(w.note) + "</div>" : "") +
      "</div>" +
      '<div class="cd">' + esc(cd) + "</div>" +
      '<button class="del" title="Delete" aria-label="Delete window">' + trashSvg + "</button>";
    div.querySelector(".del").addEventListener("click", async () => {
      const cur = await loadWindows();
      await saveWindows(cur.filter((x) => x.id !== w.id));
      render();
    });
    box.appendChild(div);
  }
}

function wireTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      tabs.forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-selected", "false"); });
      t.classList.add("active");
      t.setAttribute("aria-selected", "true");
      document.querySelectorAll(".tabpane").forEach((p) => p.classList.remove("active"));
      $("tab-" + t.dataset.tab).classList.add("active");
    });
  });
}

function wireForm() {
  $("addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const entry = makeWindow($("inName").value, $("inWhen").value, $("inTarget").value, $("inNote").value);
    if (!entry) return; // required fields guard the form; this is a safety net
    const list = await loadWindows();
    list.push(entry);
    await saveWindows(list);
    $("inName").value = ""; $("inWhen").value = ""; $("inTarget").value = ""; $("inNote").value = "";
    render();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireTabs();
  wireForm();
  render();
  setInterval(render, 1000); // live countdown
});
