/* Handshake Tester — popup logic.
 * Endpoints are user-saved; fetch() only ever targets a saved endpoint URL. */

const $ = (id) => document.getElementById(id);
const STORE_KEY = "ht_endpoints";

/* ---------- storage helpers ---------- */
async function getEndpoints() {
  const data = await chrome.storage.local.get(STORE_KEY);
  return Array.isArray(data[STORE_KEY]) ? data[STORE_KEY] : [];
}
async function saveEndpoints(list) {
  await chrome.storage.local.set({ [STORE_KEY]: list });
}

/* ---------- endpoint list UI ---------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function renderEndpoints() {
  const list = await getEndpoints();
  const box = $("endpointList");
  const sel = $("epSelect");
  if (!list.length) {
    box.innerHTML = '<p class="empty">No endpoints yet — add one below.</p>';
    sel.innerHTML = '<option value="">(add an endpoint)</option>';
    return;
  }
  box.innerHTML = "";
  sel.innerHTML = "";
  list.forEach((ep, i) => {
    const row = document.createElement("div");
    row.className = "ep-row";
    row.innerHTML =
      '<span class="name">' + esc(ep.name) + "</span>" +
      '<span class="url">' + esc(ep.method) + " · " + esc(ep.url) + "</span>";
    const del = document.createElement("button");
    del.className = "icon-btn";
    del.title = "Delete endpoint";
    del.textContent = "✕";
    del.addEventListener("click", async () => {
      const l = await getEndpoints();
      l.splice(i, 1);
      await saveEndpoints(l);
      await renderEndpoints();
    });
    row.appendChild(del);
    box.appendChild(row);

    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = ep.name + " (" + ep.method + ")";
    sel.appendChild(opt);
  });
}

$("epAdd").addEventListener("click", async () => {
  const name = $("epName").value.trim();
  const url = $("epUrl").value.trim();
  const method = $("epMethod").value;
  if (!name || !url) return;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    $("epUrl").focus();
    return;
  }
  if (!/^https?:$/.test(parsed.protocol)) return; // http(s) only
  const list = await getEndpoints();
  list.push({ name, url: parsed.href, method });
  await saveEndpoints(list);
  $("epName").value = "";
  $("epUrl").value = "";
  await renderEndpoints();
});

/* ---------- send test request ---------- */
$("sendBtn").addEventListener("click", async () => {
  const err = $("payloadError");
  err.hidden = true;
  const list = await getEndpoints();
  const idx = Number($("epSelect").value);
  if (!list[idx]) return;

  let body = null;
  const raw = $("payload").value.trim();
  if (raw) {
    try {
      body = JSON.stringify(JSON.parse(raw));
    } catch {
      err.hidden = false;
      return;
    }
  }

  const ep = list[idx];
  const btn = $("sendBtn");
  btn.disabled = true;
  btn.textContent = "Sending…";
  $("resultCard").hidden = false;
  $("rStatus").textContent = "…";
  $("rLatency").textContent = "…";
  $("rOk").textContent = "…";
  $("rHeaders").textContent = "…";
  $("rBody").textContent = "…";

  const t0 = performance.now();
  try {
    const res = await fetch(ep.url, {
      method: ep.method,
      headers: { "Content-Type": "application/json" },
      body: ["GET", "DELETE"].includes(ep.method) ? undefined : body,
    });
    const ms = Math.round(performance.now() - t0);
    const text = (await res.text()).slice(0, 2048);

    $("rStatus").textContent = res.status + " " + res.statusText;
    $("rStatus").className = "v " + (res.ok ? "good" : "bad");
    $("rLatency").textContent = ms + " ms";
    $("rOk").textContent = res.ok ? "yes" : "no";
    $("rOk").className = "v " + (res.ok ? "good" : "bad");

    const headers = [];
    res.headers.forEach((v, k) => headers.push(k + ": " + v));
    $("rHeaders").textContent = headers.length ? headers.join("\n") : "(no headers)";
    $("rBody").textContent = text || "(empty body)";
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    $("rStatus").textContent = "failed";
    $("rStatus").className = "v bad";
    $("rLatency").textContent = ms + " ms";
    $("rOk").textContent = "no";
    $("rOk").className = "v bad";
    $("rHeaders").textContent = "(request failed)";
    $("rBody").textContent = String(e && e.message ? e.message : e);
  }
  btn.disabled = false;
  btn.textContent = "Send test";
});

renderEndpoints();
