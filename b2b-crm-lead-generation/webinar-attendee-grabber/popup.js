// Webinar Attendee Grabber — popup logic.
// NOTE: extractAttendees() is injected into the page via chrome.scripting,
// so it must stay fully self-contained (no references to popup scope).

/**
 * Heuristic attendee-name extractor.
 * Only reads text the user can already see on the page — no logins bypassed,
 * no hidden data accessed.
 */
function extractAttendees() {
  const names = [];
  const seen = new Set();
  // UI chrome that should never be treated as a person.
  const BAD = /^(mute|unmute|chat|raise hand|hand|join|leave|host|co-?host|more|video|audio|share|record|invite|participants?|attendees?|guests?|panelists?|speakers?|settings|close|search|you)$/i;

  function firstLine(el) {
    return (el.innerText || el.textContent || "")
      .split("\n")[0]
      .trim()
      .replace(/\s+/g, " ");
  }

  function add(t) {
    if (!t || t.length < 2 || t.length > 80) return;
    if (BAD.test(t)) return;
    if (/^[\d.,:%\s]+$/.test(t)) return; // timers, counts, percentages
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(t);
  }

  // 1) Likely participant / attendee / roster containers.
  const containers = document.querySelectorAll(
    '[aria-label*="articipant" i], [aria-label*="ttendee" i], ' +
    '[aria-label*="uest list" i], [class*="participant" i], ' +
    '[class*="attendee" i], [class*="roster" i], ' +
    '[data-testid*="participant" i], [data-testid*="attendee" i]'
  );
  for (const c of containers) {
    const items = c.querySelectorAll(
      'li, [role="listitem"], [role="option"], [class*="item" i]'
    );
    if (items.length) items.forEach((i) => add(firstLine(i)));
    else add(firstLine(c));
  }

  // 2) Fallback: video tiles labelled like "Jane Doe, unmuted".
  if (!names.length) {
    document.querySelectorAll("[aria-label]").forEach((el) => {
      const label = el.getAttribute("aria-label") || "";
      const m = label.match(
        /^([A-ZÀ-Þ][\w.'-]{1,30}(?: [A-ZÀ-Þ][\w.'-]{1,30}){0,3})(?:,|$)/
      );
      if (m) add(m[1]);
    });
  }

  return names;
}

const $ = (id) => document.getElementById(id);
let attendees = [];

document.addEventListener("DOMContentLoaded", () => {
  $("extractBtn").addEventListener("click", extract);
  $("copyBtn").addEventListener("click", copyAll);
  $("csvBtn").addEventListener("click", exportCsv);
  $("clearBtn").addEventListener("click", clear);
});

async function extract() {
  const btn = $("extractBtn");
  btn.disabled = true;
  btn.textContent = "Scanning page…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractAttendees,
    });
    attendees = (res && res.result) || [];
    render();
  } catch (e) {
    attendees = [];
    render();
  } finally {
    btn.disabled = false;
    btn.textContent = "Extract attendees from this page";
  }
}

function render() {
  const has = attendees.length > 0;
  $("results").hidden = !has;
  $("emptyState").hidden = has;
  if (!has) return;
  $("count").textContent = attendees.length;
  const list = $("list");
  list.innerHTML = "";
  attendees.forEach((name, i) => {
    const li = document.createElement("li");
    const idx = document.createElement("span");
    idx.className = "idx";
    idx.textContent = String(i + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.textContent = name;
    li.append(idx, label);
    list.appendChild(li);
  });
}

async function copyAll() {
  const text = attendees.join("\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // Fallback for clipboard restrictions: hidden textarea + execCommand.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const btn = $("copyBtn");
  btn.textContent = "Copied ✓";
  setTimeout(() => (btn.textContent = "Copy"), 1500);
}

function exportCsv() {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = ["name", ...attendees.map(esc)].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "webinar-attendees.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function clear() {
  attendees = [];
  render();
}
