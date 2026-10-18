/* Page Latency Tester — honest load-latency measurement.
 *
 * There is no DNS API available to extensions, so "DNS propagation testing"
 * is not possible. What this extension CAN do: fetch the URL you enter and
 * time the round trip with performance.now(). Browsers hide detailed
 * cross-origin timing (DNS/connect/TTFB breakdown) unless the server sends
 * Timing-Allow-Origin, so per-phase detail is shown only when the Resource
 * Timing entry actually exposes it; otherwise the honest total is shown.
 * All requests are user-triggered and made with no-cors (no page content
 * is ever read). History stays in chrome.storage.local.
 */

const $ = (id) => document.getElementById(id);
const urlInput = $("urlInput");
const testBtn = $("testBtn");
const resultBox = $("resultBox");
const bigMs = $("bigMs");
const rTotal = $("rTotal");
const rStatus = $("rStatus");
const rDetail = $("rDetail");
const chartEl = $("chart");
const histLabel = $("histLabel");
const clearBtn = $("clearBtn");

const MAX_HISTORY = 24;

/** Normalize user input into a fetchable URL. */
function normalizeUrl(raw) {
  let u = raw.trim();
  if (!u) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch { return null; }
}

function ms(x) { return Math.round(x) + " ms"; }

/** Run one latency measurement: fetch with no-cors, time with performance.now(). */
async function measure(url) {
  const t0 = performance.now();
  let status = "unreachable";
  try {
    // no-cors: we never read the body; an opaque response still means "reachable".
    const res = await fetch(url, { mode: "no-cors", cache: "no-store", redirect: "follow", credentials: "omit" });
    status = res.type === "opaque" ? "reachable (opaque)" : "HTTP " + res.status;
  } catch (e) {
    status = "network error — host unreachable or blocked";
  }
  const total = performance.now() - t0;

  // Resource Timing: cross-origin timing fields are zeroed without
  // Timing-Allow-Origin, so only trust fields the browser actually exposed.
  let detail = "not exposed (server sent no Timing-Allow-Origin)";
  try {
    const entries = performance.getEntriesByType("resource");
    const entry = entries.reverse().find((e) => e.name === url);
    if (entry && entry.domainLookupEnd > 0) {
      detail =
        "DNS " + ms(entry.domainLookupEnd - entry.domainLookupStart) +
        " · connect " + ms(entry.connectEnd - entry.connectStart) +
        " · TTFB " + ms(entry.responseStart - entry.requestStart);
    }
  } catch { /* timing unavailable — total still shown */ }

  return { url, totalMs: Math.round(total), status, detail, ts: Date.now() };
}

/** Load history array from storage. */
async function getHistory() {
  const { history } = await chrome.storage.local.get({ history: [] });
  return Array.isArray(history) ? history : [];
}

/** Save one result, newest last, capped. */
async function saveResult(result) {
  const history = await getHistory();
  history.push(result);
  await chrome.storage.local.set({ history: history.slice(-MAX_HISTORY) });
}

/** Render the bar chart of recent tests (newest on the right). */
function renderChart(history) {
  chartEl.innerHTML = "";
  if (!history.length) {
    chartEl.innerHTML = '<div class="empty">No tests yet — run your first above.</div>';
    histLabel.textContent = "No tests yet.";
    return;
  }
  const max = Math.max(...history.map((h) => h.totalMs), 1);
  history.forEach((h) => {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = Math.max(5, Math.round((h.totalMs / max) * 100)) + "%";
    bar.title = new URL(h.url).hostname + ": " + h.totalMs + " ms";
    chartEl.appendChild(bar);
  });
  const last = history[history.length - 1];
  histLabel.textContent = history.length + " test(s) · latest: " + new URL(last.url).hostname;
}

testBtn.addEventListener("click", async () => {
  const url = normalizeUrl(urlInput.value);
  if (!url) {
    urlInput.focus();
    return;
  }
  testBtn.disabled = true;
  bigMs.textContent = "…";
  resultBox.hidden = false;

  const result = await measure(url);

  bigMs.textContent = ms(result.totalMs);
  rTotal.textContent = ms(result.totalMs);
  rStatus.textContent = result.status;
  rDetail.textContent = result.detail;

  await saveResult(result);
  renderChart(await getHistory());
  testBtn.disabled = false;
});

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") testBtn.click();
});

clearBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({ history: [] });
  renderChart([]);
});

document.addEventListener("DOMContentLoaded", async () => {
  // Pre-fill with the active tab's URL — convenient, user can change it.
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && /^https?:\/\//.test(tab.url)) urlInput.value = tab.url;
  } catch { /* tabs permission not requested; leave blank */ }
  renderChart(await getHistory());
});
