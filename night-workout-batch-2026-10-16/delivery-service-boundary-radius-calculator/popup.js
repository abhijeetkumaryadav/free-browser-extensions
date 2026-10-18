// ===== ENGINE-START (pure, headless-testable) =====
"use strict";

const EARTH_KM = 6371;

/* Haversine great-circle distance in km. */
function haversineKm(lat1, lon1, lat2, lon2) {
  const r = d => d * Math.PI / 180;
  const dLat = r(lat2 - lat1), dLon = r(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

function validCoord(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
         lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/* A zone: {name, lat, lon, radiusKm}. Returns the zone object or null. */
function makeZone(name, lat, lon, radiusKm) {
  name = (name || "").trim();
  if (!name || name.length > 80) return null;
  if (!validCoord(lat, lon)) return null;
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 20000) return null;
  return { name, lat, lon, radiusKm, createdAt: Date.now() };
}

/* Is a point inside a zone? Returns {inside, distanceKm}. */
function zoneContains(zone, lat, lon) {
  if (!validCoord(lat, lon)) return null;
  const d = haversineKm(zone.lat, zone.lon, lat, lon);
  return { inside: d <= zone.radiusKm, distanceKm: d };
}

/* Check a point against all zones → [{zone, inside, distanceKm}] nearest first. */
function checkPoint(zones, lat, lon) {
  if (!validCoord(lat, lon)) return null;
  return zones
    .map(z => Object.assign({ zone: z }, zoneContains(z, lat, lon)))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function fmtKm(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
}
// ===== ENGINE-END =====

/* ---- UI glue (browser only) ---- */
(function () {
  if (typeof chrome === "undefined" || !chrome.storage) return;
  const $ = id => document.getElementById(id);
  let zones = [];

  chrome.storage.local.get(["zones", "notes"], r => {
    zones = r.zones || [];
    if (r.notes) $("notes").value = r.notes;
    render();
  });
  const save = () => chrome.storage.local.set({ zones });
  $("notes").addEventListener("input", () => chrome.storage.local.set({ notes: $("notes").value }));

  document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    ["zones", "check", "dist"].forEach(k =>
      $(k + "Pane").classList.toggle("hidden", t.dataset.tab !== k));
  }));

  function render() {
    const box = $("zoneList");
    box.innerHTML = "";
    if (!zones.length) { box.innerHTML = '<div class="empty">No zones yet — add one above.</div>'; return; }
    zones.forEach((z, i) => {
      const d = document.createElement("div");
      d.className = "zone";
      d.innerHTML = `<button class="del" data-i="${i}">×</button><b>${z.name}</b>
        <div class="meta">${z.lat.toFixed(4)}, ${z.lon.toFixed(4)} · radius ${z.radiusKm} km</div>`;
      box.appendChild(d);
    });
    box.querySelectorAll(".del").forEach(b => b.addEventListener("click", () => {
      zones.splice(+b.dataset.i, 1); save(); render();
    }));
  }

  $("addZone").addEventListener("click", () => {
    const z = makeZone($("zName").value, +$("zLat").value, +$("zLon").value, +$("zRad").value);
    if (!z) return;
    zones.push(z); save(); render();
    ["zName", "zLat", "zLon", "zRad"].forEach(id => $(id).value = "");
  });

  $("checkBtn").addEventListener("click", () => {
    const lat = +$("cLat").value, lon = +$("cLon").value;
    const box = $("checkResult");
    box.innerHTML = "";
    const res = checkPoint(zones, lat, lon);
    if (!res) { box.innerHTML = '<div class="miss">Enter a valid latitude (−90…90) and longitude (−180…180).</div>'; return; }
    if (!res.length) { box.innerHTML = '<div class="miss">No zones saved yet.</div>'; return; }
    for (const r of res) {
      const d = document.createElement("div");
      d.className = r.inside ? "hit" : "miss";
      d.textContent = `${r.inside ? "✓ Inside" : "✗ Outside"} "${r.zone.name}" — ${fmtKm(r.distanceKm)} from center (radius ${r.zone.radiusKm} km)`;
      box.appendChild(d);
    }
  });

  $("distBtn").addEventListener("click", () => {
    const a = [+$("aLat").value, +$("aLon").value], b = [+$("bLat").value, +$("bLon").value];
    const box = $("distResult");
    box.innerHTML = "";
    if (!validCoord(a[0], a[1]) || !validCoord(b[0], b[1])) {
      box.innerHTML = '<div class="miss">Enter valid coordinates for both points.</div>'; return;
    }
    const d = document.createElement("div");
    d.className = "dist-out";
    d.textContent = `Distance: ${fmtKm(haversineKm(a[0], a[1], b[0], b[1]))}`;
    box.appendChild(d);
  });
})();
