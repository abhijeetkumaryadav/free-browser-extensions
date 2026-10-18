/* Territory Planner — sales territory planning with user-triggered geocoding.
 * All territory data lives in chrome.storage.local. The only network call is
 * to OpenStreetMap Nominatim, fired only when the user clicks "Geocode & add". */

'use strict';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'territories';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const KM_PER_DEG_LAT = 111.32;

let territories = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  territories = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  render();
  $('addBtn').addEventListener('click', addTerritory);
  $('exportBtn').addEventListener('click', exportCsv);
  $('clearBtn').addEventListener('click', clearAll);
  // Enter in the address field submits.
  $('tAddr').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTerritory();
  });
}

function save() {
  return chrome.storage.local.set({ [STORAGE_KEY]: territories });
}

function setStatus(msg, isError = false) {
  const el = $('status');
  el.textContent = msg;
  el.hidden = false;
  el.classList.toggle('error', isError);
}

function clearStatus() {
  $('status').hidden = true;
}

/** Geocode an address via Nominatim. Only called from the user's button click. */
async function geocode(address) {
  const url = `${NOMINATIM_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`geocoder responded ${res.status}`);
  const results = await res.json();
  if (!results || results.length === 0) throw new Error('no match found');
  return {
    lat: parseFloat(results[0].lat),
    lon: parseFloat(results[0].lon),
    displayName: results[0].display_name,
  };
}

async function addTerritory() {
  clearStatus();
  const name = $('tName').value.trim();
  const address = $('tAddr').value.trim();
  const radius = parseFloat($('tRadius').value);
  const unit = $('tUnit').value;

  if (!name) return setStatus('Please give the territory a name.', true);
  if (!address) return setStatus('Please enter a center address.', true);
  if (!(radius > 0)) return setStatus('Radius must be greater than zero.', true);

  const btn = $('addBtn');
  btn.disabled = true;
  btn.textContent = 'Geocoding…';
  try {
    const geo = await geocode(address);
    const radiusKm = unit === 'mi' ? radius * 1.60934 : radius;
    territories.push({
      id: `t${Date.now()}`,
      name,
      address: geo.displayName,
      lat: geo.lat,
      lon: geo.lon,
      radiusKm: Math.round(radiusKm * 100) / 100,
    });
    await save();
    $('tName').value = '';
    $('tAddr').value = '';
    render();
    const short = geo.displayName.split(',').slice(0, 2).join(',').trim();
    setStatus(`Added "${name}" near ${short}.`);
  } catch (err) {
    setStatus(`Geocoding failed: ${err.message}.`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Geocode & add territory';
  }
}

function areaKm2(t) {
  return Math.PI * t.radiusKm * t.radiusKm;
}

function fmtRadius(t) {
  return `${t.radiusKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km`;
}

function render() {
  const list = $('list');
  list.innerHTML = '';
  $('count').textContent = territories.length ? `(${territories.length})` : '';

  if (territories.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No territories yet — add your first one above.';
    list.appendChild(li);
  }

  // Newest first.
  [...territories].reverse().forEach((t) => {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot';
    const info = document.createElement('div');
    info.className = 't-info';
    const nm = document.createElement('div');
    nm.className = 't-name';
    nm.textContent = t.name;
    const meta = document.createElement('div');
    meta.className = 't-meta';
    meta.textContent = `${t.address.split(',').slice(0, 2).join(',').trim()} · r ${fmtRadius(t)} · ≈ ${areaKm2(t).toLocaleString(undefined, { maximumFractionDigits: 1 })} km²`;
    meta.title = t.address;
    info.appendChild(nm);
    info.appendChild(meta);
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = `Delete "${t.name}"`;
    del.setAttribute('aria-label', `Delete ${t.name}`);
    del.addEventListener('click', async () => {
      territories = territories.filter((x) => x.id !== t.id);
      await save();
      render();
    });
    li.appendChild(dot);
    li.appendChild(info);
    li.appendChild(del);
    list.appendChild(li);
  });

  drawSchematic();
}

/** Draw a simple schematic: circles sized by radius, positioned by lat/lon.
 *  Not a map — a relative overview. No tiles, no network. */
function drawSchematic() {
  const canvas = $('map');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (territories.length === 0) {
    ctx.fillStyle = 'rgba(154,163,178,0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Territory overview appears here', W / 2, H / 2 + 4);
    return;
  }

  // Convert lat/lon to local km offsets from the mean center.
  const meanLat = territories.reduce((s, t) => s + t.lat, 0) / territories.length;
  const meanLon = territories.reduce((s, t) => s + t.lon, 0) / territories.length;
  const kmPerDegLon = KM_PER_DEG_LAT * Math.cos((meanLat * Math.PI) / 180);
  const pts = territories.map((t) => ({
    t,
    x: (t.lon - meanLon) * kmPerDegLon,
    y: -(t.lat - meanLat) * KM_PER_DEG_LAT, // north is up
  }));

  // Scale so the largest circle + extents fit with padding.
  const maxR = Math.max(...pts.map((p) => p.t.radiusKm));
  const extent = Math.max(
    maxR * 2,
    ...pts.map((p) => Math.abs(p.x) + p.t.radiusKm),
    ...pts.map((p) => Math.abs(p.y) + p.t.radiusKm),
    1
  );
  const pad = 26;
  const scale = Math.min((W - pad * 2) / (extent * 2), (H - pad * 2) / (extent * 2));

  pts.forEach((p, i) => {
    const cx = W / 2 + p.x * scale;
    const cy = H / 2 + p.y * scale;
    const r = Math.max(4, p.t.radiusKm * scale);
    const hueShift = (i * 47) % 360;
    // Keep the single accent color; vary only alpha for overlap readability.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,184,166,0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,184,166,0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Center dot.
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#14b8a6';
    ctx.fill();
    // Label.
    ctx.fillStyle = 'rgba(238,241,245,0.9)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const label = p.t.name.length > 18 ? p.t.name.slice(0, 17) + '…' : p.t.name;
    ctx.fillText(label, cx, Math.min(cy + r + 12, H - 4));
    void hueShift; // single-accent design: no hue variation
  });
}

function csvCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv() {
  if (territories.length === 0) {
    setStatus('Nothing to export — add a territory first.', true);
    return;
  }
  const rows = [
    ['name', 'address', 'latitude', 'longitude', 'radius_km', 'area_km2'],
    ...territories.map((t) => [
      csvCell(t.name),
      csvCell(t.address),
      t.lat,
      t.lon,
      t.radiusKm,
      Math.round(areaKm2(t) * 100) / 100,
    ]),
  ];
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'territories.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

async function clearAll() {
  if (territories.length === 0) return;
  if (!confirm(`Delete all ${territories.length} territories? This cannot be undone.`)) return;
  territories = [];
  await save();
  render();
  setStatus('All territories cleared.');
}
