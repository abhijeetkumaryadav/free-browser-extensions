"use strict";
/* Star Transit Timer — popup logic + sidereal engine.
   Fully local: chrome.storage.local only. Zero network. */

// ============ ENGINE-START ============
// Pure sidereal math — no DOM, no chrome.*. Headless-testable.
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Julian date (UT) from a unix-ms timestamp. */
function julianDate(ms) {
  return ms / 86400000 + 2440587.5;
}

/** Normalize degrees into [0, 360). */
function norm360(d) {
  d = d % 360;
  return d < 0 ? d + 360 : d;
}

/** Normalize hours into [0, 24). */
function norm24(h) {
  h = h % 24;
  return h < 0 ? h + 24 : h;
}

/** Greenwich Mean Sidereal Time in hours for a unix-ms timestamp (IAU approx). */
function gmstHours(ms) {
  const jd = julianDate(ms);
  const T = (jd - 2451545.0) / 36525.0;
  let g = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
        + 0.000387933 * T * T - (T * T * T) / 38710000.0;
  return norm360(g) / 15;
}

/** Local Sidereal Time in hours. lonDeg: degrees east (+). */
function lstHours(ms, lonDeg) {
  return norm24(gmstHours(ms) + lonDeg / 15);
}

/** Validate user inputs. Returns {ok, errors[]}. */
function validateInputs(raH, decDeg, latDeg, lonDeg) {
  const errors = [];
  if (!(raH >= 0 && raH < 24)) errors.push("RA must be 0–24 hours.");
  if (!(decDeg >= -90 && decDeg <= 90)) errors.push("Dec must be −90…+90°.");
  if (!(latDeg >= -90 && latDeg <= 90)) errors.push("Latitude must be −90…+90°.");
  if (!(lonDeg >= -180 && lonDeg <= 180)) errors.push("Longitude must be −180…+180°.");
  return { ok: errors.length === 0, errors };
}

/**
 * Next upper-meridian transit for a star.
 * Returns { transitMs, inSecs, hourAngleH, altDeg, azDeg, visible }
 */
function nextTransit(raH, decDeg, latDeg, lonDeg, nowMs) {
  const lst = lstHours(nowMs, lonDeg);
  let ha = lst - raH;                    // hour angle now (hours)
  ha = norm24(ha + 12) - 12;             // → [-12, 12)
  const inHours = norm24(-ha);           // hours until HA = 0
  const inSecs = inHours * 3600;
  const transitMs = nowMs + inSecs * 1000;
  const altDeg = 90 - Math.abs(latDeg - decDeg);
  const azDeg = latDeg >= decDeg ? 180 : 0;  // culminates south (N.hem norm) or north
  return { transitMs, inSecs, hourAngleH: ha, altDeg, azDeg, visible: altDeg > 0 };
}

/** Format seconds → "Xh Ym Zs". */
function fmtCountdown(secs) {
  secs = Math.max(0, Math.round(secs));
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return (h > 0 ? h + "h " : "") + String(m).padStart(2, "0") + "m " + String(s).padStart(2, "0") + "s";
}

/** Format transit date/time in local locale. */
function fmtWhen(ms) {
  return new Date(ms).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}
// ============ ENGINE-END ============

/* ---------- UI wiring ---------- */
const $ = (id) => document.getElementById(id);
const els = { name: $("starName"), ra: $("ra"), lat: $("lat"), lon: $("lon"), dec: $("dec"), notify: $("notify") };

let state = { raH: null, dec: null, lat: null, lon: null, name: "", transitMs: 0, notify: false };
let tickTimer = null;

function loadForm() {
  chrome.storage.local.get({ sttForm: {}, sttSaved: [] }, (r) => {
    Object.assign(state, {});
    const f = r.sttForm || {};
    if (f.ra !== undefined) els.ra.value = f.ra;
    if (f.dec !== undefined) els.dec.value = f.dec;
    if (f.lat !== undefined) els.lat.value = f.lat;
    if (f.lon !== undefined) els.lon.value = f.lon;
    if (f.name) els.name.value = f.name;
    els.notify.checked = !!f.notify;
    renderSaved(r.sttSaved || []);
    const t = r.sttTrack;
    if (t && t.transitMs > Date.now()) {
      state = { ...t };
      showResult();
    }
  });
}

function saveForm() {
  chrome.storage.local.set({
    sttForm: {
      ra: els.ra.value, dec: els.dec.value, lat: els.lat.value,
      lon: els.lon.value, name: els.name.value, notify: els.notify.checked
    }
  });
}

$("track").addEventListener("click", () => {
  const raH = parseFloat(els.ra.value), dec = parseFloat(els.dec.value);
  const lat = parseFloat(els.lat.value), lon = parseFloat(els.lon.value);
  const v = validateInputs(raH, dec, lat, lon);
  if (!v.ok) { alert(v.errors.join("\n")); return; }
  const res = nextTransit(raH, dec, lat, lon, Date.now());
  state = { raH, dec, lat, lon, name: els.name.value.trim(), notify: els.notify.checked, transitMs: res.transitMs };
  chrome.storage.local.set({ sttTrack: state }, () => {});
  saveForm();
  showResult();
  if (state.notify) scheduleNotify();
});

function scheduleNotify() {
  const delay = Math.max(1, Math.round((state.transitMs - Date.now()) / 60000));
  chrome.alarms.clear("stt-transit", () => {
    chrome.alarms.create("stt-transit", { delayInMinutes: delay });
  });
}

function showResult() {
  const res = nextTransit(state.raH, state.dec, state.lat, state.lon, Date.now());
  $("result").classList.remove("hidden");
  $("rStar").textContent = state.name || ("RA " + state.raH.toFixed(4) + "h");
  $("rAlt").textContent = res.altDeg.toFixed(1) + "°";
  $("rAz").textContent = res.azDeg + "° " + (res.azDeg === 180 ? "(south)" : "(north)");
  $("rVis").textContent = res.visible ? "Yes — above horizon" : "No — below horizon";
  updateCountdown();
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const secs = (state.transitMs - Date.now()) / 1000;
  if (secs <= 0) {
    $("countdown").textContent = "Transit now";
    $("when").textContent = fmtWhen(state.transitMs);
    clearInterval(tickTimer);
    return;
  }
  $("countdown").textContent = fmtCountdown(secs);
  $("when").textContent = fmtWhen(state.transitMs);
}

function renderSaved(list) {
  const ul = $("saved");
  ul.innerHTML = "";
  if (!list.length) { ul.innerHTML = '<li><span class="nm">No saved stars yet</span></li>'; return; }
  list.forEach((s, i) => {
    const li = document.createElement("li");
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.innerHTML = "";
    nm.appendChild(document.createTextNode(s.name || ("Star " + (i + 1))));
    const sm = document.createElement("small");
    sm.textContent = "RA " + s.raH.toFixed(4) + "h · Dec " + s.dec.toFixed(2) + "°";
    nm.appendChild(sm);
    const btns = document.createElement("span");
    const load = document.createElement("button");
    load.textContent = "Load";
    load.addEventListener("click", () => {
      els.name.value = s.name || ""; els.ra.value = s.raH; els.dec.value = s.dec;
      els.lat.value = s.lat; els.lon.value = s.lon; saveForm();
    });
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      list.splice(i, 1);
      chrome.storage.local.set({ sttSaved: list }, () => renderSaved(list));
    });
    btns.appendChild(load); btns.appendChild(del);
    li.appendChild(nm); li.appendChild(btns);
    ul.appendChild(li);
  });
}

document.addEventListener("input", saveForm);
document.addEventListener("change", saveForm);

// Save-current button? Keep simple: double-click on result saves.
$("result").addEventListener("dblclick", () => {
  chrome.storage.local.get({ sttSaved: [] }, (r) => {
    const list = r.sttSaved || [];
    list.push({ name: state.name, raH: state.raH, dec: state.dec, lat: state.lat, lon: state.lon });
    chrome.storage.local.set({ sttSaved: list.slice(-20) }, () => renderSaved(list.slice(-20)));
  });
});

loadForm();
