// Syllabus Schedule Parser — best-effort date extraction + ICS/CSV export.
// All parsing happens on-device; no network, no storage.

const MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sept: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11,
};
const DOWS = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Roll the date forward a year if it lands far in the past (syllabi are forward-looking).
function rollForward(y, m, d) {
  let dt = new Date(y, m, d);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  while (dt < now - 14 * 864e5) dt = new Date(dt.getFullYear() + 1, m, d);
  return dt;
}

// Try to extract a date from one line of text. Returns {date, matchedText} or null.
function parseDate(line) {
  const now = new Date();
  let m;
  // "January 15" / "Jan 15th" / "Jan 15, 2026"
  m = line.match(/\b(January|Jan\.?|February|Feb\.?|March|Mar\.?|April|Apr\.?|May|June|Jun\.?|July|Jul\.?|August|Aug\.?|September|Sept?\.?|October|Oct\.?|November|Nov\.?|December|Dec\.?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?/i);
  if (m) {
    const mon = MONTHS[m[1].replace(".", "").toLowerCase()];
    const day = parseInt(m[2], 10);
    const year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    if (day >= 1 && day <= 31) return { date: rollForward(year, mon, day), matched: m[0] };
  }
  // ISO "2026-01-15" or "2026/01/15"
  m = line.match(/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/);
  if (m) {
    const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { date: new Date(y, mo - 1, d), matched: m[0] };
  }
  // "01/15/2026" or "01-15" (US month/day)
  m = line.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (m) {
    const mo = parseInt(m[1], 10), d = parseInt(m[2], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)) : now.getFullYear();
      return { date: rollForward(y, mo - 1, d), matched: m[0] };
    }
  }
  // Day of week → next occurrence
  m = line.match(/\b(Monday|Mon|Tuesday|Tue|Tues|Wednesday|Wed|Thursday|Thu|Thur|Thurs|Friday|Fri|Saturday|Sat|Sunday|Sun)\b/i);
  if (m) {
    const target = DOWS[m[1].toLowerCase()];
    const dt = new Date(); dt.setHours(0, 0, 0, 0);
    const diff = (target - dt.getDay() + 7) % 7;
    dt.setDate(dt.getDate() + (diff === 0 ? 7 : diff)); // "Friday" means upcoming, not today
    return { date: dt, matched: m[0] };
  }
  return null;
}

function tagType(title) {
  const t = title.toLowerCase();
  if (/\b(exam|midterm|final|quiz|test|assessment)\b/.test(t)) return "exam";
  if (/\b(assignment|homework|\bhw\b|project|essay|paper|\blab\b|report|problem set|exercise|worksheet)\b/.test(t)) return "assignment";
  if (/\b(read|reading|chapter|\bch\b|pages?|textbook)\b/.test(t)) return "reading";
  return "event";
}

function cleanTitle(line, matched) {
  let t = line.replace(matched, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/^[-•*–—:;,\s]+/, "").replace(/[-•*–—:;,\s]+$/, "").trim();
  t = t.replace(/^(due|deadline|on|by)\b[:\s]*/i, "").trim();
  return t || line.replace(matched, "").replace(/\s+/g, " ").trim() || "Scheduled item";
}

function parseSyllabus(text) {
  const events = [];
  const seen = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length < 4) continue;
    const p = parseDate(line);
    if (!p) continue;
    const title = cleanTitle(line, p.matched);
    const key = p.date.toDateString() + "|" + title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({ date: p.date, title, type: tagType(title), raw: line });
  }
  events.sort((a, b) => a.date - b.date);
  return events;
}

function escICS(s) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function toICS(events) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Syllabus Schedule Parser//EN"];
  events.forEach((e, i) => {
    const d = e.date;
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    out.push("BEGIN:VEVENT", `UID:syllabus-${i}-${ymd}@parser`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd}`, `SUMMARY:${escICS(e.title)}`,
      `DESCRIPTION:${escICS("Type: " + e.type + "\\nSource: " + e.raw)}`, "END:VEVENT");
  });
  out.push("END:VCALENDAR");
  return out.join("\r\n");
}

function toCSV(events) {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [["date", "title", "type"]];
  for (const e of events) {
    const d = e.date;
    rows.push([`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, e.title, e.type]);
  }
  return rows.map((r) => r.map(q).join(",")).join("\n");
}

function download(name, content, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const $ = (id) => document.getElementById(id);
let lastEvents = [];

document.addEventListener("DOMContentLoaded", () => {
  $("parse").addEventListener("click", onParse);
  $("clear").addEventListener("click", () => {
    $("input").value = "";
    $("results").hidden = true;
  });
  $("ics").addEventListener("click", () => download("syllabus-schedule.ics", toICS(lastEvents), "text/calendar"));
  $("csv").addEventListener("click", () => download("syllabus-schedule.csv", toCSV(lastEvents), "text/csv"));
});

function onParse() {
  const text = $("input").value;
  const box = $("results"), rows = $("rows");
  rows.innerHTML = "";
  lastEvents = parseSyllabus(text);
  box.hidden = false;
  if (!lastEvents.length) {
    const d = document.createElement("div");
    d.className = "empty-ev";
    d.textContent = "No dates found. Try lines like “Jan 20 — Homework 1 due” or “02/12 reading”.";
    rows.appendChild(d);
    $("countTitle").textContent = "Schedule";
    return;
  }
  $("countTitle").textContent = `Schedule — ${lastEvents.length} event${lastEvents.length === 1 ? "" : "s"}`;
  for (const e of lastEvents) {
    const row = document.createElement("div");
    row.className = "ev";
    const dt = document.createElement("div");
    dt.className = "dt";
    const b = document.createElement("b"); b.textContent = e.date.getDate();
    const sp = document.createElement("span"); sp.textContent = MONTH_NAMES[e.date.getMonth()].slice(0, 3);
    dt.append(b, sp);
    const ti = document.createElement("div");
    ti.className = "ti";
    const t = document.createElement("b"); t.textContent = e.title; t.title = e.raw;
    const tag = document.createElement("span"); tag.className = "tag " + e.type; tag.textContent = e.type;
    ti.append(t, document.createElement("br"), tag);
    row.append(dt, ti);
    rows.appendChild(row);
  }
}
