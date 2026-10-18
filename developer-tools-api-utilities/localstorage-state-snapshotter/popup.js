// LocalStorage State Snapshotter — popup logic.
// Injected functions must stay self-contained (no closure references).

function captureState() {
  function read(store) {
    const out = {};
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        try { out[k] = store.getItem(k); } catch (e) { out[k] = "[unreadable]"; }
      }
    } catch (e) { /* storage blocked (e.g. private mode) */ }
    return out;
  }
  return {
    origin: location.origin,
    local: read(localStorage),
    session: read(sessionStorage),
  };
}

function restoreState(data) {
  try {
    localStorage.clear();
    for (const k of Object.keys(data.local || {})) localStorage.setItem(k, data.local[k]);
    sessionStorage.clear();
    for (const k of Object.keys(data.session || {})) sessionStorage.setItem(k, data.session[k]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

const $ = (id) => document.getElementById(id);
const MAX_SNAPS = 30;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
  $("captureBtn").addEventListener("click", capture);
  $("snapName").addEventListener("keydown", (e) => { if (e.key === "Enter") capture(); });
  $("compareBtn").addEventListener("click", renderDiff);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", importJson);
  renderList();
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !/^https?:\/\//i.test(tab.url || "")) return null;
  return tab.id;
}

async function getSnaps() {
  const { snapshots = [] } = await chrome.storage.local.get("snapshots");
  return snapshots;
}
async function setSnaps(snaps) {
  await chrome.storage.local.set({ snapshots: snaps.slice(0, MAX_SNAPS) });
}

async function capture() {
  const btn = $("captureBtn"), err = $("capError");
  err.hidden = true;
  btn.disabled = true; btn.textContent = "Capturing…";
  try {
    const tabId = await activeTabId();
    if (!tabId) throw new Error("Open a regular http(s) page first — snapshots can't run on chrome:// or extension pages.");
    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: captureState });
    const state = res && res.result;
    if (!state) throw new Error("Could not read storage on this page.");
    const snaps = await getSnaps();
    const name = $("snapName").value.trim() || ("Snapshot " + new Date().toLocaleString());
    snaps.unshift({
      id: "snap-" + Date.now(),
      name,
      origin: state.origin,
      host: state.origin.replace(/^https?:\/\//, ""),
      at: Date.now(),
      data: { local: state.local, session: state.session },
    });
    await setSnaps(snaps);
    $("snapName").value = "";
    renderList();
  } catch (e) {
    err.textContent = e.message || "Capture failed.";
    err.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = "Capture";
  }
}

async function renderList() {
  const snaps = await getSnaps();
  const card = $("listCard"), box = $("snapList");
  box.innerHTML = "";
  card.hidden = snaps.length === 0;
  if (!snaps.length) return;

  for (const s of snaps) {
    const nl = Object.keys(s.data.local || {}).length;
    const ns = Object.keys(s.data.session || {}).length;

    const row = document.createElement("div");
    row.className = "snap";

    const top = document.createElement("div");
    top.className = "snap-top";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.id = s.id;
    cb.title = "Select for comparison";
    cb.addEventListener("change", updateCompareBtn);
    const nm = document.createElement("div");
    nm.className = "nm";
    nm.textContent = s.name;
    nm.title = s.name;
    top.append(cb, nm);

    const meta = document.createElement("div");
    meta.className = "snap-meta";
    const when = new Date(s.at).toLocaleString();
    meta.innerHTML = "";
    const counts = document.createElement("span");
    counts.className = "counts";
    counts.innerHTML = `<b>${nl}</b> local · <b>${ns}</b> session keys`;
    meta.append(document.createTextNode(s.host + " · " + when + " · "), counts);

    const actions = document.createElement("div");
    actions.className = "snap-actions";

    const restore = document.createElement("button");
    restore.textContent = "Restore";
    restore.addEventListener("click", () => doRestore(s));

    const exp = document.createElement("button");
    exp.textContent = "Export";
    exp.addEventListener("click", () => doExport(s));

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "danger";
    del.addEventListener("click", async () => {
      await setSnaps((await getSnaps()).filter((x) => x.id !== s.id));
      $("diffBox").hidden = true;
      renderList();
    });

    actions.append(restore, exp, del);
    row.append(top, meta, actions);
    box.appendChild(row);
  }
  updateCompareBtn();
}

function updateCompareBtn() {
  const checked = document.querySelectorAll("#snapList input[type=checkbox]:checked");
  const btn = $("compareBtn");
  btn.disabled = checked.length !== 2;
  btn.textContent = checked.length === 2 ? "Compare selected" : `Compare selected (pick ${2 - checked.length} more)`;
  if (checked.length !== 2) $("diffBox").hidden = true;
}

async function renderDiff() {
  const checked = [...document.querySelectorAll("#snapList input[type=checkbox]:checked")].map((c) => c.dataset.id);
  if (checked.length !== 2) return;
  const snaps = await getSnaps();
  const a = snaps.find((x) => x.id === checked[0]);
  const b = snaps.find((x) => x.id === checked[1]);
  if (!a || !b) return;

  const box = $("diffBox");
  box.innerHTML = "";
  box.hidden = false;

  const h = document.createElement("h3");
  h.textContent = `Diff: “${a.name}” → “${b.name}”`;
  box.appendChild(h);

  let total = 0;
  for (const ns of ["local", "session"]) {
    const A = a.data[ns] || {}, B = b.data[ns] || {};
    const added = Object.keys(B).filter((k) => !(k in A));
    const removed = Object.keys(A).filter((k) => !(k in B));
    const changed = Object.keys(B).filter((k) => (k in A) && A[k] !== B[k]);
    total += added.length + removed.length + changed.length;

    const sec = document.createElement("h4");
    sec.textContent = ns === "local" ? "localStorage" : "sessionStorage";
    box.appendChild(sec);

    const addRow = (cls, key, val) => {
      const d = document.createElement("div");
      d.className = "dkey " + cls;
      const k = document.createElement("span");
      k.className = "k";
      k.textContent = key;
      const v = document.createElement("span");
      v.className = "v";
      v.textContent = trunc(val);
      d.append(k, v);
      box.appendChild(d);
    };
    for (const k of added) addRow("added", "+ " + k, B[k]);
    for (const k of removed) addRow("removed", "− " + k, A[k]);
    for (const k of changed) addRow("changed", "≠ " + k, `was: ${trunc(A[k])}  →  now: ${trunc(B[k])}`);
    if (!added.length && !removed.length && !changed.length) {
      const n = document.createElement("div");
      n.className = "none";
      n.textContent = "No differences.";
      box.appendChild(n);
    }
  }
  if (total === 0) {
    const n = document.createElement("div");
    n.className = "none";
    n.textContent = "Snapshots are identical.";
    box.appendChild(n);
  }
}

function trunc(v) {
  const s = String(v == null ? "" : v);
  return s.length > 140 ? s.slice(0, 140) + "…" : s;
}

async function doRestore(s) {
  const ok = confirm(
    `Restore snapshot "${s.name}"?\n\nThis will REPLACE localStorage and sessionStorage on ${s.origin} with the snapshot's contents.`
  );
  if (!ok) return;
  try {
    const tabId = await activeTabId();
    if (!tabId) throw new Error("no-tab");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabOrigin = new URL(tab.url).origin;
    if (tabOrigin !== s.origin) {
      if (!confirm(`This snapshot is from ${s.origin}, but the current tab is ${tabOrigin}.\n\nRestore anyway?`)) return;
    }
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: restoreState,
      args: [s.data],
    });
    if (!res || !res.result || !res.result.ok) throw new Error((res && res.result && res.result.error) || "failed");
    alert("Snapshot restored. Reload the page to see it take effect.");
  } catch (e) {
    alert("Restore failed: " + (e.message || e));
  }
}

function doExport(s) {
  const payload = {
    name: s.name,
    exportedAt: new Date().toISOString(),
    origin: s.origin,
    snapshot: s.data,
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  a.download = "snapshot-" + s.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const snap = payload.snapshot || payload;
    if (!snap || typeof snap.local !== "object" || typeof snap.session !== "object") {
      throw new Error("Not a valid snapshot file.");
    }
    const snaps = await getSnaps();
    snaps.unshift({
      id: "snap-" + Date.now(),
      name: String(payload.name || file.name.replace(/\.json$/i, "")).slice(0, 60),
      origin: payload.origin || "imported",
      host: (payload.origin || "imported").replace(/^https?:\/\//, ""),
      at: Date.now(),
      data: { local: snap.local, session: snap.session },
    });
    await setSnaps(snaps);
    renderList();
  } catch (err) {
    alert("Import failed: " + (err.message || err));
  } finally {
    e.target.value = "";
  }
}
