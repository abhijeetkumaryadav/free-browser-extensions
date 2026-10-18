/* Syllabus Deadline Extractor — heuristic date extraction + ICS export.
 * All parsing is local; the user reviews every date before export.
 * Limitations are labeled in the UI: extraction is heuristic, nothing is
 * injected into calendars automatically.
 */
'use strict';

// ----- Module: date parsing ---------------------------------------------
const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sept: 8,
  sep: 8, oct: 9, nov: 10, dec: 11
};

function pad(n) { return String(n).padStart(2, '0'); }

// Try to parse a single line into {date: Date|null, desc}.
function parseLine(line, now) {
  const patterns = [
    // "October 20", "Oct 20th", "December 3," ...
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
    // "10/20", "10-20", "10.20" with optional year
    /\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/,
    // "2026-10-20" ISO
    /\b(\d{4})-(\d{2})-(\d{2})\b/
  ];

  for (const re of patterns) {
    const m = line.match(re);
    if (!m) continue;
    let date = null;
    try {
      if (m[0].includes('-') && /^\d{4}/.test(m[0])) {
        date = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
      } else if (/^[a-z]/i.test(m[1])) {
        const month = MONTHS[m[1].toLowerCase().replace(/\./g, '')];
        if (month === undefined) continue;
        let year = now.getFullYear();
        const d = new Date(year, month, parseInt(m[2], 10));
        // If the date is more than 30 days in the past, assume next year.
        if (d.getTime() < now.getTime() - 30 * 86400000) year += 1;
        date = new Date(year, month, parseInt(m[2], 10));
      } else {
        const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        let year = now.getFullYear(), month, day;
        if (m[3]) {
          year = parseInt(m[3], 10);
          if (year < 100) year += 2000;
        }
        // Heuristic: assume MM/DD (US style). If first number > 12, swap.
        month = a <= 12 ? a - 1 : b - 1;
        day = a <= 12 ? b : a;
        date = new Date(year, month, day);
        if (isNaN(date.getTime())) continue;
      }
      if (date && !isNaN(date.getTime())) {
        // Description = the line with the matched date stripped.
        let desc = line.replace(m[0], '').trim().replace(/^[-–:;,.]+|[-–:;,.]+$/g, '').trim();
        if (desc.length > 80) desc = desc.slice(0, 77) + '…';
        if (!desc) desc = 'Deadline';
        return { date, desc };
      }
    } catch (e) { /* try next pattern */ }
  }
  return null;
}

// Scan pasted text and return an array of {desc, dateStr}.
function extractDeadlines(text) {
  const now = new Date();
  const out = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length < 6) continue;
    const hit = parseLine(line, now);
    if (hit) {
      out.push({
        desc: hit.desc,
        date: `${hit.date.getFullYear()}-${pad(hit.date.getMonth() + 1)}-${pad(hit.date.getDate())}`
      });
    }
  }
  return out;
}

// ----- Module: ICS export ------------------------------------------------
function toICSDate(dateStr) {
  return dateStr.replace(/-/g, '') + 'T090000';
}

function buildICS(events, course) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//rdx//Syllabus Deadline Extractor//EN\r\n';
  events.forEach((ev, i) => {
    const title = course ? `${course}: ${ev.desc}` : ev.desc;
    ics += 'BEGIN:VEVENT\r\n' +
      `UID:syl-${Date.now()}-${i}@rdx.local\r\n` +
      `DTSTAMP:${stamp}\r\n` +
      `DTSTART:${toICSDate(ev.date)}\r\n` +
      `DTSTART;VALUE=DATE:${ev.date.replace(/-/g, '')}\r\n` +
      `SUMMARY:${title.replace(/[\r\n]/g, ' ')}\r\n` +
      'END:VEVENT\r\n';
  });
  ics += 'END:VCALENDAR\r\n';
  return ics;
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

// ----- Module: UI ---------------------------------------------------------
const $ = (id) => document.getElementById(id);
let events = [];

function render() {
  const list = $('results');
  list.innerHTML = '';
  events.forEach((ev, i) => {
    const li = document.createElement('li');
    li.className = 'event-card';
    li.innerHTML =
      '<div class="meta">' +
      `<input type="date" value="${ev.date}" data-i="${i}" data-f="date" aria-label="Date">` +
      `<input type="text" value="${ev.desc.replace(/"/g, '&quot;')}" data-i="${i}" data-f="desc" aria-label="Description">` +
      '</div>';
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = 'Remove';
    del.addEventListener('click', () => { events.splice(i, 1); render(); });
    li.appendChild(del);
    list.appendChild(li);
  });
  $('count').textContent = events.length ? `(${events.length})` : '';
  $('results-panel').hidden = false;
  list.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('change', () => {
      events[parseInt(inp.dataset.i, 10)][inp.dataset.f] = inp.value;
    });
  });
}

$('extract').addEventListener('click', async () => {
  const text = $('syllabus').value.trim();
  if (!text) return;
  events = extractDeadlines(text);
  const course = $('course').value.trim();
  if (course) {
    try { await chrome.storage.local.set({ lastCourse: course }); } catch (e) {}
  }
  render();
  if (!events.length) {
    $('results').innerHTML = '<li class="event-card"><div class="desc">No dates found.</div>' +
      '<p class="hint">Try lines with dates like “Oct 20”, “10/20”, or “2026-10-20”.</p></li>';
  }
});

$('export-ics').addEventListener('click', () => {
  if (!events.length) return;
  const course = $('course').value.trim();
  download('syllabus-deadlines.ics', buildICS(events, course), 'text/calendar');
});

$('copy-events').addEventListener('click', async () => {
  const course = $('course').value.trim();
  const lines = events.map(ev => `${ev.date} — ${course ? course + ': ' : ''}${ev.desc}`);
  await navigator.clipboard.writeText(lines.join('\n'));
  $('copy-events').textContent = 'Copied!';
  setTimeout(() => { $('copy-events').textContent = 'Copy as text'; }, 1500);
});

$('clear-all').addEventListener('click', () => {
  events = [];
  $('results-panel').hidden = true;
});

// Restore last course name for convenience.
(async () => {
  try {
    const data = await chrome.storage.local.get('lastCourse');
    if (data.lastCourse) $('course').value = data.lastCourse;
  } catch (e) {}
})();
