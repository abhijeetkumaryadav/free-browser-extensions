// Tab State Variable Watcher — popup logic.
// readOnce / startWatcher / stopWatcher are injected into the tab and
// must stay self-contained. They only READ window[name] — never write
// to page state. The polling timer handle lives on the isolated world's
// own globalThis, not on the page's window.

// --- injected: one-shot read of the given variable names ---
function readOnce(names) {
  return names.map((name) => {
    try {
      const v = window[name];
      let s;
      try { s = JSON.stringify(v); if (s === undefined) s = String(v); }
      catch (e) { s = String(v); }
      if (s.length > 2000) s = s.slice(0, 2000) + "…";
      const t = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
      return { name, ok: true, value: s, type: t };
    } catch (e) {
      return { name, ok: false, value: "(inaccessible)", type: "unknown" };
    }
  });
}

// --- injected: poll every 2s, log changes to storage (read-only on the page) ---
function startWatcher(names, tabId) {
  const g = globalThis;
  if (g.__tswTimer) clearInterval(g.__tswTimer);
  const last = {};
  async function tick() {
    for (const name of names) {
      let entry;
      try {
        const v = window[name];
        let s;
        try { s = JSON.stringify(v); if (s === undefined) s = String(v); }
        catch (e) { s = String(v); }
        if (s.length > 2000) s = s.slice(0, 2000) + "…";
        entry = {
          ok: true, value: s, type: v === null ? "null" : Array.isArray(v) ? "array" : typeof v,
          at: Date.now(),
        };
      } catch (e) {
        entry = { ok: false, value: "(inaccessible)", type: "unknown", at: Date.now() };
      }
      if (last[name] === entry.value) continue;
      last[name] = entry.value;
      const snapKey = "tsw.snap:" + tabId + ":" + name;
      const histKey = "tsw.hist:" + tabId + ":" + name;
      try {
        const cur = await chrome.storage.local.get([histKey]);
        const hist = cur[histKey] || [];
        hist.push({ value: entry.value, at: entry.at });
        await chrome.storage.local.set({ [snapKey]: entry, [histKey]: hist.slice(-25) });
      } catch (e) { /* storage unavailable — skip */ }
    }
  }
  tick();
  g.__tswTimer = setInterval(tick, 2000);
  return true;
}

// --- injected: stop the background poll ---
function stopWatcher() {
  const g = globalThis;
  if (g.__tswTimer) { clearInterval(g.__tswTimer); g.__tswTimer = null; return true; }
  return false;
}

// ---------------- popup ----------------
const $ = (id) => document.getElementById(id);
const IDENT = /^[A-Za-z_$][\w$]*$/;
let tabId = null;
let pollTimer = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    tabId = tab.id;
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  $("addBtn").addEventListener("click", addName);
  $("varName").addEventListener("keydown", (e) => { if (e.key === "Enter") addName(); });
  $("readBtn").addEventListener("click", readNow);
  $("startBtn").addEventListener("click", startAuto);
  $("stopBtn").addEventListener("click", stopAuto);
  await render();
  // refresh displayed snapshots while the popup is open
  pollTimer = setInterval(render, 2000);
  window.addEventListener("unload", () => clearInterval(pollTimer));
}

async function getNames() {
  const { names = [] } = await chrome.storage.local.get("names");
  return names;
}
async function setNames(names) {
  await chrome.storage.local.set({ names });
}

async function addName() {
  const input = $("varName");
  const name = input.value.trim();
  if (!IDENT.test(name)) {
    input.focus();
    input.style.borderColor = "#f06666";
    setTimeout(() => { input.style.borderColor = ""; }, 1200);
    return;
  }
  const names = await getNames();
  if (!names.includes(name)) {
    names.push(name);
    await setNames(names.slice(0, 30));
  }
  input.value = "";
  render();
}

async function removeName(name) {
  const names = (await getNames()).filter((n) => n !== name);
  await setNames(names);
  const keys = [`tsw.snap:${tabId}:${name}`, `tsw.hist:${tabId}:${name}`];
  await chrome.storage.local.remove(keys);
  render();
}

function snapKey(name) { return `tsw.snap:${tabId}:${name}`; }
function histKey(name) { return `tsw.hist:${tabId}:${name}`; }

async function readNow() {
  const btn = $("readBtn");
  const names = await getNames();
  if (!names.length || tabId == null) return;
  btn.disabled = true;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId }, func: readOnce, args: [names],
    });
    const results = (res && res.result) || [];
    const patch = {};
    for (const r of results) {
      const entry = { ok: r.ok, value: r.value, type: r.type, at: Date.now() };
      patch[snapKey(r.name)] = entry;
      const cur = await chrome.storage.local.get([histKey(r.name)]);
      const hist = cur[histKey(r.name)] || [];
      if (!hist.length || hist[hist.length - 1].value !== entry.value) {
        hist.push({ value: entry.value, at: entry.at });
        patch[histKey(r.name)] = hist.slice(-25);
      }
    }
    await chrome.storage.local.set(patch);
  } catch (e) {
    /* e.g. chrome:// pages — show nothing new */
  } finally {
    btn.disabled = false;
    render();
  }
}

async function startAuto() {
  const names = await getNames();
  if (!names.length || tabId == null) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId }, func: startWatcher, args: [names, tabId],
    });
    await chrome.storage.local.set({ ["tsw.watching:" + tabId]: true });
  } catch (e) {}
  render();
}

async function stopAuto() {
  if (tabId == null) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: stopWatcher });
    await chrome.storage.local.set({ ["tsw.watching:" + tabId]: false });
  } catch (e) {}
  render();
}

function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  return Math.floor(m / 60) + "h ago";
}

async function render() {
  const names = await getNames();
  const box = $("vars");
  box.innerHTML = "";
  $("emptyVars").style.display = names.length ? "none" : "";
  const { ["tsw.watching:" + tabId]: watching } = await chrome.storage.local.get("tsw.watching:" + tabId);
  const pill = $("status");
  pill.textContent = watching ? "Watching" : "Idle";
  pill.className = "pill " + (watching ? "live" : "idle");

  const snapKeys = names.map(snapKey);
  const histKeys = names.map(histKey);
  const store = snapKeys.length ? await chrome.storage.local.get([...snapKeys, ...histKeys]) : {};

  for (const name of names) {
    const snap = store[snapKey(name)];
    const hist = store[histKey(name)] || [];
    const card = document.createElement("div");
    card.className = "var";

    const head = document.createElement("div");
    head.className = "var-head";
    const code = document.createElement("code");
    code.textContent = name;
    const type = document.createElement("span");
    type.className = "type";
    type.textContent = snap ? snap.type : "—";
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×"; x.title = "Stop watching";
    x.addEventListener("click", () => removeName(name));
    head.append(code, type, x);

    const val = document.createElement("div");
    val.className = "var-val";
    const v = snap ? snap.value : "(not read yet)";
    val.textContent = v.length > 220 ? v.slice(0, 220) + "…" : v;
    val.title = v;

    const time = document.createElement("div");
    time.className = "var-time";
    time.textContent = snap ? "updated " + ago(snap.at) : "press “Read now” or start auto-watch";

    card.append(head, val, time);

    if (hist.length) {
      const det = document.createElement("details");
      det.className = "hist";
      const sum = document.createElement("summary");
      sum.textContent = `Change history (${hist.length})`;
      det.appendChild(sum);
      for (const h of [...hist].reverse().slice(0, 10)) {
        const e = document.createElement("div");
        e.className = "hist-entry";
        const b = document.createElement("b");
        b.textContent = new Date(h.at).toLocaleTimeString();
        e.append(b, document.createTextNode("  " + (h.value.length > 160 ? h.value.slice(0, 160) + "…" : h.value)));
        det.appendChild(e);
      }
      card.appendChild(det);
    }
    box.appendChild(card);
  }
}
