/* DSN Dashboard — popup logic.
 * Fully local: contacts live in chrome.storage.local. No network. */

"use strict";

/* // ENGINE-START — pure helpers, headless-testable */
// Validate a contact {craft, when, note}. Returns error string or "".
// `when` must be an ISO datetime string; `now` (ms) injectable for tests.
function validateContact(craft, whenISO, now) {
  if (!craft || !craft.trim()) return "Enter a spacecraft name.";
  if (craft.length > 40) return "Spacecraft name is too long.";
  const when = new Date(whenISO).getTime();
  if (Number.isNaN(when)) return "Enter a valid date and time.";
  if (when <= (now ?? Date.now())) return "Contact time must be in the future.";
  return "";
}

// Return contacts with when >= now, sorted soonest-first. `now` injectable.
function upcomingContacts(contacts, now) {
  const t = now ?? Date.now();
  return contacts
    .filter((c) => c.when >= t)
    .sort((a, b) => a.when - b.when);
}

// The single next contact, or null. `now` injectable.
function nextContact(contacts, now) {
  const up = upcomingContacts(contacts, now);
  return up.length ? up[0] : null;
}

// Split ms into {d, h, m, s}. Negative clamps to zero.
function countdownParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

// "2d 04:13:05" style formatting.
function fmtCountdown(ms) {
  const p = countdownParts(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${p.d}d ${pad(p.h)}:${pad(p.m)}:${pad(p.s)}`;
}

// Compact local date-time for schedule rows.
function fmtWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
/* // ENGINE-END */

/* ---------- Lucide-style outline icons (inline SVG, stroke-only) ---------- */
const ICONS = {
  sat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 7l4-4 4 4-4 4"/><path d="M17 11l-8.5 8.5a2.12 2.12 0 1 1-3-3L14 8"/><path d="M6 18l-1 1 1 1 1-1"/><path d="M18 6l1-1-1-1-1 1"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
};

/* ---------- Storage ---------- */
const store = {
  async get() {
    const d = await chrome.storage.local.get({ contacts: [] });
    return { contacts: d.contacts || [] };
  },
  async set(patch) { await chrome.storage.local.set(patch); },
};

/* ---------- Rendering ---------- */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

let tickTimer = null;

function renderNext(contacts) {
  const el = document.getElementById("nextContact");
  const next = nextContact(contacts);
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  if (!next) {
    el.innerHTML = '<span class="countdown-empty">No upcoming contacts scheduled.</span>';
    return;
  }
  const paint = () => {
    const left = next.when - Date.now();
    if (left <= 0) { refresh(); return; } // rolled into the past — refresh
    el.innerHTML = `
      <div class="countdown-craft">${escapeHtml(next.craft)}</div>
      <div class="countdown-time">${fmtCountdown(left)}</div>
      <div class="countdown-when">${fmtWhen(next.when)}${next.note ? " · " + escapeHtml(next.note) : ""}</div>`;
  };
  paint();
  tickTimer = setInterval(paint, 1000);
}

function renderSchedule(contacts) {
  const ul = document.getElementById("schedule");
  const sorted = contacts.slice().sort((a, b) => a.when - b.when);
  if (!sorted.length) {
    ul.innerHTML = '<li class="empty">Nothing scheduled yet.</li>';
    return;
  }
  const now = Date.now();
  ul.innerHTML = sorted.map((c) => `
    <li class="${c.when < now ? "past" : ""}">
      <span class="sched-craft">${escapeHtml(c.craft)}</span>
      <span class="sched-note">${escapeHtml(c.note || "")}</span>
      <span class="sched-when">${fmtWhen(c.when)}</span>
      <button class="sched-del" data-id="${c.id}" title="Delete">×</button>
    </li>`).join("");
  ul.querySelectorAll(".sched-del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { contacts: cur } = await store.get();
      await store.set({ contacts: cur.filter((c) => c.id !== btn.dataset.id) });
      await refresh();
    });
  });
}

async function refresh() {
  const { contacts } = await store.get();
  renderNext(contacts);
  renderSchedule(contacts);
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("satIcon").innerHTML = ICONS.sat;
  document.getElementById("infoIcon").innerHTML = ICONS.info;
  await refresh();

  document.getElementById("addContact").addEventListener("click", async () => {
    const errEl = document.getElementById("formError");
    const craft = document.getElementById("craftName").value.trim();
    const whenISO = document.getElementById("contactWhen").value;
    const note = document.getElementById("contactNote").value.trim();
    const err = validateContact(craft, whenISO);
    if (err) { errEl.textContent = err; return; }
    errEl.textContent = "";
    const { contacts } = await store.get();
    contacts.push({ id: "c" + Date.now(), craft, when: new Date(whenISO).getTime(), note });
    await store.set({ contacts: contacts.slice(-50) }); // cap at 50
    document.getElementById("craftName").value = "";
    document.getElementById("contactWhen").value = "";
    document.getElementById("contactNote").value = "";
    await refresh();
  });

  document.getElementById("clearAll").addEventListener("click", async () => {
    if (!confirm("Delete all scheduled contacts?")) return;
    await store.set({ contacts: [] });
    await refresh();
  });
});
