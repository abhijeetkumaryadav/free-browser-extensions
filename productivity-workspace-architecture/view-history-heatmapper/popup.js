/* View History Heatmapper — popup logic.
 * Reads the last 30 days of local browsing history, buckets visits
 * into a [day][hour] grid, and renders a GitHub-style heatmap with
 * summary stats. All computation is local; nothing is stored or sent. */

const DAYS = 30;
const HOURS = 24;

const loadingEl = document.getElementById('loading');
const contentEl = document.getElementById('content');
const heatmapEl = document.getElementById('heatmap');
const yLabelsEl = document.getElementById('yLabels');
const xLabelsEl = document.getElementById('xLabels');

/** Format an hour (0-23) as a 12h label, e.g. 13 -> "1p". */
function hourLabel(h) {
  const suffix = h < 12 ? 'a' : 'p';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + suffix;
}

/** Short day label for a Date, e.g. "Mon 12". */
function dayLabel(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[date.getDay()]} ${date.getDate()}`;
}

/** Map a visit count to an intensity level 0..4 using quantile-ish breaks. */
function level(count, max) {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

async function build() {
  // Grid: grid[dayIndex][hour] — dayIndex 0 = oldest, 29 = today.
  const grid = Array.from({ length: DAYS }, () => new Array(HOURS).fill(0));
  const hourTotals = new Array(HOURS).fill(0);
  const dayTotals = new Array(DAYS).fill(0);
  let total = 0;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTime = startOfToday.getTime() - (DAYS - 1) * 86400000;

  // chrome.history.search caps results at maxResults; page through with
  // decreasing endTime windows to cover the full 30 days.
  let endTime = Date.now();
  const seen = new Set();
  while (endTime > startTime) {
    const items = await chrome.history.search({
      text: '',
      startTime,
      endTime,
      maxResults: 1000,
    });
    if (!items.length) break;
    let oldestInBatch = endTime;
    for (const item of items) {
      if (!item.lastVisitTime || seen.has(item.id)) continue;
      seen.add(item.id);
      const d = new Date(item.lastVisitTime);
      const dayIdx = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - (startOfToday.getTime() - (DAYS - 1) * 86400000)) / 86400000);
      if (dayIdx < 0 || dayIdx >= DAYS) continue;
      // Weight by visit count so heavy-use pages contribute fairly.
      const weight = Math.max(1, Math.min(10, item.visitCount || 1));
      const h = d.getHours();
      grid[dayIdx][h] += weight;
      hourTotals[h] += weight;
      dayTotals[dayIdx] += weight;
      total += weight;
      if (item.lastVisitTime < oldestInBatch) oldestInBatch = item.lastVisitTime;
    }
    if (oldestInBatch >= endTime) break; // no progress; avoid infinite loop
    endTime = oldestInBatch - 1;
    if (seen.size > 30000) break; // safety cap
  }

  const max = Math.max(1, ...grid.flat());

  // ---- Render grid (columns = days, oldest left) ----
  const frag = document.createDocumentFragment();
  for (let day = 0; day < DAYS; day++) {
    for (let h = 0; h < HOURS; h++) {
      const cell = document.createElement('div');
      const count = grid[day][h];
      cell.className = 'cell l' + level(count, max);
      const date = new Date(startOfToday.getTime() - (DAYS - 1 - day) * 86400000);
      cell.title = `${dayLabel(date)}, ${hourLabel(h)} — ${count} visit${count === 1 ? '' : 's'}`;
      frag.appendChild(cell);
    }
  }
  heatmapEl.appendChild(frag);

  // ---- Y labels: every 3 hours ----
  const yFrag = document.createDocumentFragment();
  for (let h = 0; h < HOURS; h++) {
    const s = document.createElement('span');
    s.textContent = h % 3 === 0 ? hourLabel(h) : '';
    yFrag.appendChild(s);
  }
  yLabelsEl.appendChild(yFrag);

  // ---- X labels: every 5th day ----
  const xFrag = document.createDocumentFragment();
  for (let day = 0; day < DAYS; day++) {
    const s = document.createElement('span');
    if (day % 5 === 0) {
      const date = new Date(startOfToday.getTime() - (DAYS - 1 - day) * 86400000);
      s.textContent = String(date.getDate());
      s.title = dayLabel(date);
    }
    xFrag.appendChild(s);
  }
  xLabelsEl.appendChild(xFrag);

  // ---- Stats ----
  document.getElementById('statTotal').textContent = total.toLocaleString();
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));
  document.getElementById('statHour').textContent = total ? hourLabel(peakHour) : '—';
  const peakDay = dayTotals.indexOf(Math.max(...dayTotals));
  const peakDate = new Date(startOfToday.getTime() - (DAYS - 1 - peakDay) * 86400000);
  document.getElementById('statDay').textContent = total ? dayLabel(peakDate) : '—';

  loadingEl.classList.add('hidden');
  contentEl.classList.remove('hidden');
}

build().catch((err) => {
  console.error('Heatmap build failed:', err);
  loadingEl.innerHTML = '<p>Could not read history. Check the extension has the history permission.</p>';
});
