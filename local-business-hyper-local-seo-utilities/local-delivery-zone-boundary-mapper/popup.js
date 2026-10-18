/* Delivery Zone Mapper — define delivery zones and check customer coverage.
 * All zone data lives in chrome.storage.local. The only network calls are to
 * OpenStreetMap Nominatim, fired only when the user clicks a button. */

'use strict';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'deliveryZones';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const KM_PER_DEG_LAT = 111.32;
const MI_PER_KM = 0.621371;
const EARTH_RADIUS_KM = 6371;

let zones = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  zones = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  render();
  $('addBtn').addEventListener('click', addZone);
  $('checkBtn').addEventListener('click', checkAddress);
  $('exportBtn').addEventListener('click', exportCsv);
  $('clearBtn').addEventListener('click', clearAll);
  $('cAddr').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkAddress();
  });
  $('zAddr').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addZone();
  });
}

function save() {
  return chrome.storage.local.set({ [STORAGE_KEY]: zones });
}

function setStatus(msg, isError = false) {
  const el = $('status');
  el.textContent = msg;
  el.hidden = false;
  el.classList.toggle('error', isError);
}

/** Geocode an address via Nominatim. Only called from user button clicks. */
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

/** Great-circle distance in km between two lat/lon points. */
function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function fmtMoney(n) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function addZone() {
  $('status').hidden = true;
  const name = $('zName').value.trim();
  const address = $('zAddr').value.trim();
  const radius = parseFloat($('zRadius').value);
  const unit = $('zUnit').value;
  const fee = parseFloat($('zFee').value);
  const min = parseFloat($('zMin').value);

  if (!name) return setStatus('Please give the zone a name.', true);
  if (!address) return setStatus('Please enter a center address.', true);
  if (!(radius > 0)) return setStatus('Radius must be greater than zero.', true);
  if (!(fee >= 0) || !(min >= 0)) return setStatus('Fee and minimum must be zero or more.', true);

  const btn = $('addBtn');
  btn.disabled = true;
  btn.textContent = 'Geocoding…';
  try {
    const geo = await geocode(address);
    const radiusKm = unit === 'mi' ? radius / MI_PER_KM : radius;
    zones.push({
      id: `z${Date.now()}`,
      name,
      address: geo.displayName,
      lat: geo.lat,
      lon: geo.lon,
      radiusKm: Math.round(radiusKm * 100) / 100,
      fee: Math.round(fee * 100) / 100,
      minOrder: Math.round(min * 100) / 100,
    });
    await save();
    $('zName').value = '';
    $('zAddr').value = '';
    render();
    setStatus(`Added zone "${name}".`);
  } catch (err) {
    setStatus(`Geocoding failed: ${err.message}.`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Geocode & add zone';
  }
}

async function checkAddress() {
  const box = $('checkResult');
  box.hidden = true;
  box.innerHTML = '';
  const address = $('cAddr').value.trim();
  if (!address) {
    box.hidden = false;
    box.innerHTML = '<span class="miss">Enter a customer address first.</span>';
    return;
  }
  if (zones.length === 0) {
    box.hidden = false;
    box.innerHTML = '<span class="miss">No zones defined yet — add one below.</span>';
    return;
  }

  const btn = $('checkBtn');
  btn.disabled = true;
  btn.textContent = 'Geocoding…';
  try {
    const geo = await geocode(address);
    const withDist = zones
      .map((z) => ({ z, distKm: haversineKm(geo.lat, geo.lon, z.lat, z.lon) }))
      .sort((a, b) => a.distKm - b.distKm);
    const hits = withDist.filter((d) => d.distKm <= d.z.radiusKm);

    const title = document.createElement('div');
    const short = geo.displayName.split(',').slice(0, 2).join(',').trim();
    if (hits.length > 0) {
      title.innerHTML = `<span class="hit">✓ Covered</span> — ${escapeHtml(short)} is inside ${hits.length} zone${hits.length > 1 ? 's' : ''}:`;
    } else {
      title.innerHTML = `<span class="miss">✗ Not covered</span> — ${escapeHtml(short)} is outside all zones. Nearest: ${escapeHtml(withDist[0].z.name)} (${withDist[0].distKm.toFixed(1)} km away).`;
    }
    box.appendChild(title);

    const ul = document.createElement('ul');
    const rows = hits.length > 0 ? hits : withDist.slice(0, 3);
    rows.forEach(({ z, distKm }) => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      left.textContent = `${z.name} — ${distKm.toFixed(1)} km away`;
      const right = document.createElement('span');
      right.className = 'fee';
      right.textContent = `fee ${fmtMoney(z.fee)} · min ${fmtMoney(z.minOrder)}`;
      li.appendChild(left);
      li.appendChild(right);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    box.hidden = false;
  } catch (err) {
    box.hidden = false;
    box.innerHTML = `<span class="miss">Geocoding failed: ${escapeHtml(err.message)}.</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Geocode & check zones';
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function render() {
  const list = $('list');
  list.innerHTML = '';
  $('count').textContent = zones.length ? `(${zones.length})` : '';

  if (zones.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No zones yet — define your first one above.';
    list.appendChild(li);
  }

  [...zones].reverse().forEach((z) => {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot';
    const info = document.createElement('div');
    info.className = 'z-info';
    const nm = document.createElement('div');
    nm.className = 'z-name';
    nm.textContent = z.name;
    const meta = document.createElement('div');
    meta.className = 'z-meta';
    meta.textContent = `r ${z.radiusKm} km · fee ${fmtMoney(z.fee)} · min ${fmtMoney(z.minOrder)}`;
    meta.title = z.address;
    info.appendChild(nm);
    info.appendChild(meta);
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = `Delete "${z.name}"`;
    del.setAttribute('aria-label', `Delete ${z.name}`);
    del.addEventListener('click', async () => {
      zones = zones.filter((x) => x.id !== z.id);
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

/** Schematic overview: circles sized by radius, positioned by lat/lon.
 *  Relative view only — no map tiles, no network. */
function drawSchematic() {
  const canvas = $('map');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (zones.length === 0) {
    ctx.fillStyle = 'rgba(154,163,178,0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Zone overview appears here', W / 2, H / 2 + 4);
    return;
  }

  const meanLat = zones.reduce((s, z) => s + z.lat, 0) / zones.length;
  const meanLon = zones.reduce((s, z) => s + z.lon, 0) / zones.length;
  const kmPerDegLon = KM_PER_DEG_LAT * Math.cos((meanLat * Math.PI) / 180);
  const pts = zones.map((z) => ({
    z,
    x: (z.lon - meanLon) * kmPerDegLon,
    y: -(z.lat - meanLat) * KM_PER_DEG_LAT,
  }));

  const extent = Math.max(
    Math.max(...pts.map((p) => p.z.radiusKm)) * 2,
    ...pts.map((p) => Math.abs(p.x) + p.z.radiusKm),
    ...pts.map((p) => Math.abs(p.y) + p.z.radiusKm),
    1
  );
  const pad = 26;
  const scale = Math.min((W - pad * 2) / (extent * 2), (H - pad * 2) / (extent * 2));

  pts.forEach((p) => {
    const cx = W / 2 + p.x * scale;
    const cy = H / 2 + p.y * scale;
    const r = Math.max(4, p.z.radiusKm * scale);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(139,92,246,0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(139,92,246,0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#8b5cf6';
    ctx.fill();
    ctx.fillStyle = 'rgba(238,241,245,0.9)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const label = p.z.name.length > 18 ? p.z.name.slice(0, 17) + '…' : p.z.name;
    ctx.fillText(label, cx, Math.min(cy + r + 12, H - 4));
  });
}

function csvCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv() {
  if (zones.length === 0) {
    setStatus('Nothing to export — add a zone first.', true);
    return;
  }
  const rows = [
    ['name', 'center_address', 'latitude', 'longitude', 'radius_km', 'delivery_fee', 'min_order'],
    ...zones.map((z) => [
      csvCell(z.name),
      csvCell(z.address),
      z.lat,
      z.lon,
      z.radiusKm,
      z.fee,
      z.minOrder,
    ]),
  ];
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'delivery-zones.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

async function clearAll() {
  if (zones.length === 0) return;
  if (!confirm(`Delete all ${zones.length} zones? This cannot be undone.`)) return;
  zones = [];
  await save();
  render();
  setStatus('All zones cleared.');
}
