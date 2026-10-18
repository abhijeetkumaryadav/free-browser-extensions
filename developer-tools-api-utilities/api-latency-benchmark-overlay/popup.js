// API Latency Benchmark — popup logic. All on-device; only user-entered URLs are fetched.

const $ = (id) => document.getElementById(id);
const TIMEOUT_MS = 10000;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const { lastUrls = "" } = await chrome.storage.local.get("lastUrls");
  if (lastUrls) $("urls").value = lastUrls;
  $("runBtn").addEventListener("click", runBenchmark);
}

function parseUrls() {
  const seen = new Set();
  const out = [];
  for (const line of $("urls").value.split("\n")) {
    const t = line.trim();
    if (!t || seen.has(t)) continue;
    try {
      const u = new URL(t);
      if (!/^https?:$/.test(u.protocol)) continue;
      seen.add(t);
      out.push(t);
    } catch (e) { /* skip invalid lines */ }
  }
  return out;
}

async function timeOnce(url) {
  // Single timed fetch. Returns {ok, status, ms} or {ok:false, blocked:true}.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET", mode: "cors", cache: "no-store",
      redirect: "follow", signal: ctrl.signal,
    });
    // Drain the body so timing reflects the full round trip.
    await res.arrayBuffer().catch(() => {});
    return { ok: res.ok, status: res.status, ms: performance.now() - t0 };
  } catch (err) {
    // TypeError = CORS / network block; AbortError = timed out.
    return { ok: false, blocked: err && err.name !== "AbortError", timeout: err && err.name === "AbortError" };
  } finally {
    clearTimeout(timer);
  }
}

async function runBenchmark() {
  const urls = parseUrls();
  const btn = $("runBtn");
  if (!urls.length) {
    $("urls").focus();
    return;
  }
  await chrome.storage.local.set({ lastUrls: urls.join("\n") });
  btn.disabled = true;
  btn.textContent = "Running…";
  const card = $("resultsCard");
  const box = $("results");
  card.hidden = false;
  box.innerHTML = "";
  $("summary").textContent = "";

  const runs = parseInt($("runs").value, 10) || 3;
  const results = [];
  for (const url of urls) {
    const row = document.createElement("div");
    row.className = "res";
    row.innerHTML = `<div class="top"><div class="host"></div></div><div class="empty-res">Testing…</div>`;
    row.querySelector(".host").textContent = url;
    box.appendChild(row);

    const samples = [];
    let status = null, blocked = false, timedOut = false;
    for (let i = 0; i < runs; i++) {
      const r = await timeOnce(url);
      if (r.blocked) { blocked = true; break; }
      if (r.timeout) { timedOut = true; break; }
      samples.push(r.ms);
      status = r.status;
    }
    const rec = { url, samples, status, blocked, timedOut };
    results.push(rec);
    row.replaceWith(renderRow(rec, 0, 0)); // placeholder rank until all done
  }

  // Final render, sorted fastest → slowest; blocked/timeout last.
  box.innerHTML = "";
  const ok = results.filter((r) => r.samples.length).sort((a, b) => avg(a) - avg(b));
  const bad = results.filter((r) => !r.samples.length);
  const maxAvg = ok.length ? Math.max(...ok.map(avg)) : 1;
  [...ok, ...bad].forEach((r, i) => box.appendChild(renderRow(r, i + 1, maxAvg)));
  const fastest = ok[0];
  $("summary").textContent = fastest
    ? `${results.length} tested · fastest ${hostOf(fastest.url)}`
    : `${results.length} tested · none reachable`;
  btn.disabled = false;
  btn.textContent = "Run benchmark";
}

function avg(r) {
  return r.samples.reduce((a, b) => a + b, 0) / r.samples.length;
}
function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return url; }
}
function fmtMs(n) {
  return n >= 1000 ? (n / 1000).toFixed(2) + " s" : Math.round(n) + " ms";
}

function renderRow(r, rank, maxAvg) {
  const el = document.createElement("div");
  el.className = "res";
  const top = document.createElement("div");
  top.className = "top";
  const rk = document.createElement("div");
  rk.className = "rank";
  rk.textContent = rank || "–";
  const host = document.createElement("div");
  host.className = "host";
  host.textContent = r.url;
  host.title = r.url;
  top.append(rk, host);

  if (r.samples.length) {
    const a = avg(r);
    const mn = Math.min(...r.samples), mx = Math.max(...r.samples);
    const badge = document.createElement("span");
    badge.className = "badge ok";
    badge.textContent = "HTTP " + r.status;
    const avgEl = document.createElement("div");
    avgEl.className = "avg";
    avgEl.innerHTML = `${fmtMs(a)} <small>avg</small>`;
    top.append(badge, avgEl);
    el.appendChild(top);
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("i");
    fill.style.width = Math.max(4, (a / maxAvg) * 100).toFixed(1) + "%";
    bar.appendChild(fill);
    el.appendChild(bar);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `min <b>${fmtMs(mn)}</b> · max <b>${fmtMs(mx)}</b> · ${r.samples.length} run${r.samples.length > 1 ? "s" : ""}`;
    el.appendChild(meta);
  } else {
    const badge = document.createElement("span");
    badge.className = "badge " + (r.blocked ? "blocked" : "err");
    badge.textContent = r.blocked ? "Blocked (CORS)" : "Timed out";
    top.appendChild(badge);
    el.appendChild(top);
    const note = document.createElement("div");
    note.className = "empty-res";
    note.style.textAlign = "left";
    note.textContent = r.blocked
      ? "The endpoint refused cross-origin access from this browser."
      : `No response within ${TIMEOUT_MS / 1000}s.`;
    el.appendChild(note);
  }
  return el;
}
