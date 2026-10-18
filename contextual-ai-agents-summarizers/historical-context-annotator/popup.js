// Historical Context Annotator — popup logic.
// extractEvents() is injected into the page; it must stay self-contained.
// Notes are stored per page in chrome.storage.local; nothing leaves the device.

function extractEvents() {
  const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
  const dateRe = new RegExp(
    "(?:\\b\\d{1,2}\\s+(?:" + MONTHS + ")\\s+\\d{3,4}\\b)" +
    "|(?:\\b(?:" + MONTHS + ")\\s+\\d{1,2},?\\s+\\d{3,4}\\b)" +
    "|(?:\\b(?:1[0-9]{3}|20[0-9]{2})\\b)", "gi");
  const yearRe = /\b(1[0-9]{3}|20[0-9]{2})\b/;

  const text = (document.body && document.body.innerText) || "";
  // Chunk the text into sentence-ish pieces.
  const chunks = text.match(/[^.!?\n]{12,}?(?:[.!?]|$)/g) || [];
  const out = [];
  const seen = new Set();
  for (const raw of chunks) {
    const sentence = raw.replace(/\s+/g, " ").trim();
    if (sentence.length < 15) continue;
    dateRe.lastIndex = 0;
    let m;
    while ((m = dateRe.exec(sentence)) !== null) {
      const date = m[0].trim();
      const ym = date.match(yearRe);
      const year = ym ? parseInt(ym[1], 10) : 0;
      const key = year + "|" + sentence.slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ year, date, sentence: sentence.slice(0, 240) });
      if (out.length >= 120) break;
    }
    if (out.length >= 120) break;
  }
  out.sort((a, b) => (b.year || 0) - (a.year || 0));
  return out;
}

const $ = (id) => document.getElementById(id);
let pageKey = null;
let notes = {};   // eventIndex -> note text for this page
let events = [];

document.addEventListener("DOMContentLoaded", () => {
  $("scan").addEventListener("click", scanPage);
});

async function scanPage() {
  const btn = $("scan");
  btn.disabled = true; btn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const url = new URL(tab.url);
    pageKey = url.origin + url.pathname;
    $("pageHost").textContent = url.hostname.replace(/^www\./, "");

    const { hcNotes = {} } = await chrome.storage.local.get("hcNotes");
    notes = hcNotes[pageKey] || {};

    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: extractEvents,
    });
    events = (res && res.result) || [];
    render();
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "Couldn’t read this page — try a regular article or document page.";
  } finally {
    btn.disabled = false; btn.textContent = "Scan page";
  }
}

function eventId(ev, i) {
  return `${ev.year}|${i}`;
}

async function saveNotes() {
  const { hcNotes = {} } = await chrome.storage.local.get("hcNotes");
  hcNotes[pageKey] = notes;
  await chrome.storage.local.set({ hcNotes });
}

function render() {
  const has = events.length > 0;
  $("tlCard").hidden = !has;
  $("empty").style.display = has ? "none" : "";
  $("evCount").textContent = events.length;
  const box = $("timeline");
  box.innerHTML = "";
  events.forEach((ev, i) => {
    const el = document.createElement("div");
    el.className = "event";
    const head = document.createElement("div");
    const yr = document.createElement("span");
    yr.className = "yr";
    yr.textContent = ev.year || "—";
    head.appendChild(yr);
    if (ev.date && String(ev.year) !== ev.date) {
      const dt = document.createElement("span");
      dt.className = "dt";
      dt.textContent = ev.date;
      head.appendChild(dt);
    }
    const sent = document.createElement("div");
    sent.className = "sent";
    sent.textContent = ev.sentence;
    const id = eventId(ev, i);
    const toggle = document.createElement("button");
    toggle.className = "note-toggle" + (notes[id] ? " has" : "");
    toggle.textContent = notes[id] ? "✎ Note saved" : "+ Add note";
    const ta = document.createElement("textarea");
    ta.rows = 2;
    ta.placeholder = "Your note for this year…";
    ta.value = notes[id] || "";
    ta.style.display = "none";
    toggle.addEventListener("click", () => {
      ta.style.display = ta.style.display === "none" ? "" : "none";
      if (ta.style.display !== "none") ta.focus();
    });
    ta.addEventListener("change", async () => {
      const v = ta.value.trim();
      if (v) { notes[id] = v; toggle.textContent = "✎ Note saved"; toggle.classList.add("has"); }
      else { delete notes[id]; toggle.textContent = "+ Add note"; toggle.classList.remove("has"); }
      await saveNotes();
    });
    el.append(head, sent, toggle, ta);
    box.appendChild(el);
  });
}
