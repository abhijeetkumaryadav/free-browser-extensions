// XML Log Anomaly Detector — popup logic. All on-device, best-effort parsing.

const $ = (id) => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("analyze").addEventListener("click", analyze);
  $("sample").addEventListener("click", loadSample);
  $("copyReport").addEventListener("click", copyReport);
  const { lastLog = "" } = await chrome.storage.local.get("lastLog");
  if (lastLog) $("loginput").value = lastLog;
}

// ---- parsing ----

// Extracts an entry from one XML log line. Best-effort: attribute names vary.
function parseLine(line) {
  const t = line.trim();
  if (!t.startsWith("<")) return null;
  let doc;
  try {
    doc = new DOMParser().parseFromString(t, "text/xml");
    if (doc.querySelector("parsererror")) return null;
  } catch (e) { return null; }
  const el = doc.documentElement;
  const attr = (names) => {
    for (const n of names) { const v = el.getAttribute(n); if (v != null) return v; }
    return null;
  };
  const tsRaw = attr(["ts", "timestamp", "time", "datetime", "date"]);
  const levelRaw = (attr(["level", "severity", "type", "loglevel"]) || "INFO").toUpperCase();
  const rtRaw = attr(["rt", "response", "responsetime", "responseTime", "ms", "duration", "elapsed", "latency"]);
  const message = (el.textContent || "").trim();
  let time = null;
  if (tsRaw) { const d = new Date(tsRaw); if (!isNaN(d)) time = d; }
  const isError = /^(ERROR|FATAL|CRITICAL|ERR)$/.test(levelRaw) || /\b(fail|fatal|panic)\b/i.test(message);
  const isWarn = /^(WARN|WARNING)$/.test(levelRaw);
  return {
    time, level: levelRaw, isError, isWarn,
    rt: rtRaw != null && rtRaw !== "" ? parseFloat(rtRaw) : null,
    message: message || "(empty message)",
    raw: t,
  };
}

function analyze() {
  const text = $("loginput").value;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const entries = lines.map(parseLine).filter(Boolean);
  chrome.storage.local.set({ lastLog: text });
  if (!entries.length) {
    $("dashCard").hidden = true;
    $("anomCard").hidden = false;
    $("anomalies").innerHTML = '<div class="none-ok">No parseable XML entries found. Each line must be one XML element.</div>';
    return;
  }
  const errors = entries.filter((e) => e.isError);
  renderStats(entries, errors);
  const buckets = bucketize(entries);
  const anomalies = detectAnomalies(entries, buckets);
  renderTimeline(buckets, anomalies);
  renderAnomalies(anomalies);
  $("dashCard").hidden = false;
  $("anomCard").hidden = false;
  $("stAnom").textContent = anomalies.length;
}

function renderStats(entries, errors) {
  $("stTotal").textContent = entries.length;
  $("stParsed").textContent = entries.length;
  $("stErr").textContent = errors.length;
}

// Group entries per minute. Returns sorted array of {t: Date, total, errors}.
function bucketize(entries) {
  const map = new Map();
  const timed = entries.filter((e) => e.time);
  for (const e of timed) {
    const key = new Date(e.time);
    key.setSeconds(0, 0);
    const k = key.getTime();
    if (!map.has(k)) map.set(k, { t: key, total: 0, errors: 0 });
    const b = map.get(k);
    b.total++;
    if (e.isError) b.errors++;
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ---- anomaly detection ----

function detectAnomalies(entries, buckets) {
  const out = [];

  // 1. Traffic spikes: per-minute count far above the median.
  const med = median(buckets.map((b) => b.total));
  for (const b of buckets) {
    const thresh = Math.max(3, med * 3);
    if (b.total >= thresh && med > 0) {
      out.push({
        type: "spike", red: false,
        time: b.t,
        desc: `Traffic spike: <code>${b.total}</code> entries at ${fmtTime(b.t)} (median ${med}/min).`,
      });
    }
  }

  // 2. Error clusters: 3+ errors inside any 5-minute sliding window.
  const errs = entries.filter((e) => e.isError && e.time).sort((a, b) => a.time - b.time);
  let i = 0;
  for (let j = 0; j < errs.length; j++) {
    while (errs[j].time - errs[i].time > 5 * 60 * 1000) i++;
    if (j - i + 1 >= 3) {
      const win = errs.slice(i, j + 1);
      out.push({
        type: "error-cluster", red: true,
        time: win[0].time,
        desc: `Error cluster: <code>${win.length}</code> errors between ${fmtTime(win[0].time)} and ${fmtTime(win[win.length - 1].time)}.`,
      });
      i = j + 1; // skip ahead to avoid overlapping reports
    }
  }

  // 3. Response-time outliers: rt > mean + 2σ.
  const rts = entries.filter((e) => e.rt != null && !isNaN(e.rt));
  if (rts.length >= 4) {
    const mean = rts.reduce((a, e) => a + e.rt, 0) / rts.length;
    const sd = Math.sqrt(rts.reduce((a, e) => a + (e.rt - mean) ** 2, 0) / rts.length);
    const cut = mean + 2 * sd;
    for (const e of rts) {
      if (e.rt > cut) {
        out.push({
          type: "slow-response", red: false,
          time: e.time,
          desc: `Slow response: <code>${e.rt}</code> ms${e.time ? " at " + fmtTime(e.time) : ""} (mean ${mean.toFixed(0)} ms, cutoff ${cut.toFixed(0)} ms) — ${esc(e.message.slice(0, 80))}.`,
        });
      }
    }
  }

  // Dedupe identical descriptions and sort by time.
  const seen = new Set();
  return out
    .filter((a) => { if (seen.has(a.desc)) return false; seen.add(a.desc); return true; })
    .sort((a, b) => (a.time || 0) - (b.time || 0))
    .slice(0, 50);
}

// ---- rendering ----

function renderTimeline(buckets, anomalies) {
  const svg = $("timeline");
  svg.innerHTML = "";
  if (!buckets.length) return;
  const W = 348, H = 120, PADL = 6, PADR = 6, PADB = 18, PADT = 10;
  const max = Math.max(...buckets.map((b) => b.total), 1);
  const bw = (W - PADL - PADR) / buckets.length;
  const anomKeys = new Set(anomalies.filter((a) => a.type === "spike" || a.type === "error-cluster").map((a) => a.time && a.time.getTime()));
  buckets.forEach((b, idx) => {
    const h = ((H - PADT - PADB) * b.total) / max;
    const x = PADL + idx * bw;
    const y = H - PADB - h;
    const bar = document.createElementNS(NS, "rect");
    bar.setAttribute("x", (x + 1).toFixed(1));
    bar.setAttribute("y", y.toFixed(1));
    bar.setAttribute("width", Math.max(bw - 2, 1).toFixed(1));
    bar.setAttribute("height", h.toFixed(1));
    bar.setAttribute("rx", "2");
    bar.setAttribute("fill", "#6b7280");
    bar.setAttribute("opacity", "0.75");
    svg.appendChild(bar);
    if (b.errors > 0) {
      const eh = (h * b.errors) / b.total;
      const err = document.createElementNS(NS, "rect");
      err.setAttribute("x", (x + 1).toFixed(1));
      err.setAttribute("y", (H - PADB - eh).toFixed(1));
      err.setAttribute("width", Math.max(bw - 2, 1).toFixed(1));
      err.setAttribute("height", eh.toFixed(1));
      err.setAttribute("rx", "2");
      err.setAttribute("fill", "#ef4444");
      svg.appendChild(err);
    }
    if (anomKeys.has(b.t.getTime())) {
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", (x + bw / 2).toFixed(1));
      dot.setAttribute("cy", (PADT - 4).toFixed(1));
      dot.setAttribute("r", "4");
      dot.setAttribute("fill", "#f59e0b");
      svg.appendChild(dot);
    }
    if (idx % Math.ceil(buckets.length / 6) === 0) {
      const lab = document.createElementNS(NS, "text");
      lab.setAttribute("x", (x + bw / 2).toFixed(1));
      lab.setAttribute("y", (H - 5).toFixed(1));
      lab.setAttribute("text-anchor", "middle");
      lab.setAttribute("fill", "#9aa3b5");
      lab.setAttribute("font-size", "8");
      lab.textContent = fmtTime(b.t);
      svg.appendChild(lab);
    }
  });
}

function renderAnomalies(anomalies) {
  const box = $("anomalies");
  box.innerHTML = "";
  if (!anomalies.length) {
    box.innerHTML = '<div class="none-ok">No anomalies detected in the parsed entries.</div>';
    return;
  }
  for (const a of anomalies) {
    const el = document.createElement("div");
    el.className = "anom" + (a.red ? " red" : "");
    const kind = document.createElement("div");
    kind.className = "kind";
    kind.textContent = a.type.replace(/-/g, " ");
    const desc = document.createElement("div");
    desc.className = "desc";
    desc.innerHTML = a.desc;
    el.append(kind, desc);
    box.appendChild(el);
  }
}

async function copyReport() {
  const items = [...document.querySelectorAll("#anomalies .anom")].map((el) => {
    const k = el.querySelector(".kind").textContent;
    const d = el.querySelector(".desc").textContent;
    return `• [${k}] ${d}`;
  });
  await navigator.clipboard.writeText(
    `XML Log Anomaly Report — ${items.length} flagged\n` + items.join("\n")
  );
}

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Deterministic-ish sample log with an error cluster, a spike, and an outlier.
function loadSample() {
  const lines = [];
  const base = new Date("2026-10-16T10:00:00Z");
  let n = 0;
  const add = (min, sec, level, rt, msg) => {
    const t = new Date(base.getTime() + min * 60000 + sec * 1000);
    lines.push(`<log ts="${t.toISOString()}" level="${level}" rt="${rt}">${msg}</log>`);
    n++;
  };
  for (let m = 0; m < 4; m++) for (let s = 0; s < 20; s += 10) add(m, s, "INFO", 30 + s, "request ok");
  for (let m = 4; m < 6; m++) for (let s = 0; s < 60; s += 3) add(m, s, "INFO", 35, "traffic burst"); // spike
  add(7, 5, "ERROR", 500, "db connection refused");
  add(7, 40, "ERROR", 480, "db connection refused");
  add(8, 10, "ERROR", 520, "db connection refused");
  add(8, 50, "ERROR", 490, "timeout on checkout"); // cluster
  add(9, 15, "WARN", 2400, "slow downstream call"); // outlier
  add(10, 0, "INFO", 42, "request ok");
  $("loginput").value = lines.join("\n");
  analyze();
}
