/* ZoneMap — great-circle distances + delivery-zone checker.
 * All math is local: haversine formula, equirectangular canvas sketch. No network. */
"use strict";

/* ---------- math ---------- */
const EARTH_KM = 6371.0088;
const KM_PER_MI = 1.609344;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in km between two lat/lng pairs (haversine). */
function haversineKm(aLat, aLng, bLat, bLng) {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a =
    s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

/* ---------- dom ---------- */
const $ = (id) => document.getElementById(id);
const els = {
  tabDistance: $("tabDistance"), tabZone: $("tabZone"),
  panelDistance: $("panelDistance"), panelZone: $("panelZone"),
  aLat: $("aLat"), aLng: $("aLng"), bLat: $("bLat"), bLng: $("bLng"),
  cLat: $("cLat"), cLng: $("cLng"), radius: $("radius"),
  tLat: $("tLat"), tLng: $("tLng"),
  calcBtn: $("calcBtn"), zoneBtn: $("zoneBtn"),
  distResult: $("distResult"), distValue: $("distValue"),
  zoneResult: $("zoneResult"), zoneVerdict: $("zoneVerdict"), zoneSub: $("zoneSub"),
  errorPanel: $("errorPanel"), errorText: $("errorText"),
  mapPanel: $("mapPanel"), mapCanvas: $("mapCanvas"),
};

const state = { mode: "distance", unit: "km", runit: "km" };

/* ---------- storage ---------- */
const store = {
  async load() {
    try {
      const d = await chrome.storage.local.get("zonemap");
      const s = d.zonemap || {};
      if (s.mode) setMode(s.mode, false);
      if (s.unit) setUnit(s.unit, false);
      if (s.runit) setRUnit(s.runit, false);
      for (const id of ["aLat","aLng","bLat","bLng","cLat","cLng","radius","tLat","tLng"]) {
        if (typeof s[id] === "string") els[id].value = s[id];
      }
    } catch { /* storage unavailable — run without persistence */ }
  },
  async save() {
    try {
      await chrome.storage.local.set({ zonemap: {
        mode: state.mode, unit: state.unit, runit: state.runit,
        aLat: els.aLat.value, aLng: els.aLng.value,
        bLat: els.bLat.value, bLng: els.bLng.value,
        cLat: els.cLat.value, cLng: els.cLng.value,
        radius: els.radius.value, tLat: els.tLat.value, tLng: els.tLng.value,
      }});
    } catch { /* ignore */ }
  },
};

/* ---------- parsing / validation ---------- */
function parseCoord(latStr, lngStr) {
  const lat = Number(String(latStr).trim());
  const lng = Number(String(lngStr).trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, msg: "Coordinates must be numbers." };
  if (lat < -90 || lat > 90) return { ok: false, msg: "Latitude must be between -90 and 90." };
  if (lng < -180 || lng > 180) return { ok: false, msg: "Longitude must be between -180 and 180." };
  return { ok: true, lat, lng };
}

function parseRadius(str) {
  const r = Number(String(str).trim());
  if (!Number.isFinite(r) || r <= 0) return { ok: false, msg: "Radius must be a positive number." };
  if (r > 20000) return { ok: false, msg: "Radius is unrealistically large (max 20,000)." };
  return { ok: true, value: r };
}

function showError(msg) {
  els.errorText.textContent = msg;
  els.errorPanel.hidden = false;
}
function hideError() { els.errorPanel.hidden = true; }

function fmt(n) {
  return n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
}

/* ---------- modes / units ---------- */
function setMode(mode, save = true) {
  state.mode = mode;
  const d = mode === "distance";
  els.tabDistance.classList.toggle("active", d);
  els.tabZone.classList.toggle("active", !d);
  els.tabDistance.setAttribute("aria-selected", String(d));
  els.tabZone.setAttribute("aria-selected", String(!d));
  els.panelDistance.hidden = !d;
  els.panelZone.hidden = d;
  hideError();
  if (save) store.save();
}

function setUnit(unit, save = true) {
  state.unit = unit;
  document.querySelectorAll('.unit[data-unit]').forEach((b) =>
    b.classList.toggle("active", b.dataset.unit === unit));
  if (save) store.save();
}

function setRUnit(runit, save = true) {
  state.runit = runit;
  document.querySelectorAll('.unit[data-runit]').forEach((b) =>
    b.classList.toggle("active", b.dataset.runit === runit));
  if (save) store.save();
}

/* ---------- canvas sketch ---------- */
// Simple equirectangular projection sketch — NOT a map, just a local diagram.
function drawSketch({ points, circle }) {
  const canvas = els.mapCanvas;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Gather all lat/lng extents (add circle bounds if present).
  let lats = points.map((p) => p.lat);
  let lngs = points.map((p) => p.lng);
  let midLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  if (circle) {
    // Approx degrees covered by the radius.
    const dLat = (circle.radiusKm / 111.32);
    const dLng = (circle.radiusKm / (111.32 * Math.max(0.2, Math.cos(toRad(circle.lat)))));
    lats = lats.concat([circle.lat - dLat, circle.lat + dLat]);
    lngs = lngs.concat([circle.lng - dLng, circle.lng + dLng]);
    midLat = circle.lat;
  }
  const cosLat = Math.max(0.2, Math.cos(toRad(midLat)));
  let minLat = Math.min(...lats), maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  // Pad; guard against zero span.
  const padLat = Math.max((maxLat - minLat) * 0.25, 0.002);
  const padLng = Math.max((maxLng - minLng) * 0.25, 0.002 / cosLat);
  minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng;

  const spanLat = maxLat - minLat;
  const spanLngX = (maxLng - minLng) * cosLat; // longitude squashed by latitude
  const pxPerDegLat = (H - 40) / spanLat;
  const pxPerDegLng = (W - 40) / ((maxLng - minLng) * cosLat);
  const scale = Math.min(pxPerDegLat, pxPerDegLng);

  const X = (lng) => 20 + (lng - minLng) * cosLat * scale +
    (W - 40 - spanLngX * scale) / 2;
  const Y = (lat) => 20 + (maxLat - lat) * scale +
    (H - 40 - spanLat * scale) / 2;

  // Faint graticule.
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo((W / 4) * i, 0); ctx.lineTo((W / 4) * i, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, (H / 4) * i); ctx.lineTo(W, (H / 4) * i); ctx.stroke();
  }

  // Delivery radius circle.
  if (circle) {
    const rPx = circle.radiusKm / (111.32 * cosLat) * cosLat * scale; // km -> px
    ctx.beginPath();
    ctx.arc(X(circle.lng), Y(circle.lat), Math.max(rPx, 4), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(249,115,22,0.12)";
    ctx.fill();
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Dashed connector between distance points.
  if (points.length === 2 && !circle) {
    ctx.beginPath();
    ctx.moveTo(X(points[0].lng), Y(points[0].lat));
    ctx.lineTo(X(points[1].lng), Y(points[1].lat));
    ctx.strokeStyle = "rgba(249,115,22,0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Points.
  const colors = ["#f97316", "#22c55e", "#8b5cf6"];
  points.forEach((p, i) => {
    const x = X(p.lng), y = Y(p.lat);
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = colors[i % colors.length]; ctx.fill();
    ctx.strokeStyle = "#0b0b10"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#f2f2f5";
    ctx.font = "700 20px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(p.label || "", x, y - 14);
  });

  els.mapPanel.hidden = false;
}

/* ---------- actions ---------- */
function measure() {
  hideError();
  const a = parseCoord(els.aLat.value, els.aLng.value);
  const b = parseCoord(els.bLat.value, els.bLng.value);
  if (!a.ok) return showError("Point A: " + a.msg);
  if (!b.ok) return showError("Point B: " + b.msg);

  const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
  const shown = state.unit === "km" ? km : km / KM_PER_MI;
  els.distValue.textContent = `${fmt(shown)} ${state.unit}`;
  els.distResult.hidden = false;

  drawSketch({ points: [
    { lat: a.lat, lng: a.lng, label: "A" },
    { lat: b.lat, lng: b.lng, label: "B" },
  ]});
  store.save();
}

function checkZone() {
  hideError();
  const c = parseCoord(els.cLat.value, els.cLng.value);
  const t = parseCoord(els.tLat.value, els.tLng.value);
  const r = parseRadius(els.radius.value);
  if (!c.ok) return showError("Center: " + c.msg);
  if (!r.ok) return showError(r.msg);
  if (!t.ok) return showError("Test point: " + t.msg);

  const radiusKm = state.runit === "km" ? r.value : r.value * KM_PER_MI;
  const distKm = haversineKm(c.lat, c.lng, t.lat, t.lng);
  const inside = distKm <= radiusKm;

  els.zoneVerdict.textContent = inside ? "Inside zone" : "Outside zone";
  els.zoneVerdict.className = "verdict " + (inside ? "in" : "out");
  const distShown = state.runit === "km" ? distKm : distKm / KM_PER_MI;
  els.zoneSub.textContent = `${fmt(distShown)} ${state.runit} from center · radius ${fmt(r.value)} ${state.runit}`;
  els.zoneResult.hidden = false;

  drawSketch({
    points: [
      { lat: c.lat, lng: c.lng, label: "C" },
      { lat: t.lat, lng: t.lng, label: "T" },
    ],
    circle: { lat: c.lat, lng: c.lng, radiusKm },
  });
  store.save();
}

/* ---------- wiring ---------- */
els.tabDistance.addEventListener("click", () => setMode("distance"));
els.tabZone.addEventListener("click", () => setMode("zone"));
document.querySelectorAll('.unit[data-unit]').forEach((b) =>
  b.addEventListener("click", () => setUnit(b.dataset.unit)));
document.querySelectorAll('.unit[data-runit]').forEach((b) =>
  b.addEventListener("click", () => setRUnit(b.dataset.runit)));
els.calcBtn.addEventListener("click", measure);
els.zoneBtn.addEventListener("click", checkZone);
for (const id of ["aLat","aLng","bLat","bLng"]) {
  els[id].addEventListener("keydown", (e) => { if (e.key === "Enter") measure(); });
}
for (const id of ["cLat","cLng","radius","tLat","tLng"]) {
  els[id].addEventListener("keydown", (e) => { if (e.key === "Enter") checkZone(); });
}

store.load();
