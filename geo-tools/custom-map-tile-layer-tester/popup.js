'use strict';
/* TileTest — single map-tile previewer.
   Honest scope: renders exactly ONE tile from a user-provided URL template.
   No full map, no geocoding, no network beyond the one <img> the user requests. */

const $ = (id) => document.getElementById(id);
let mode = 'zxy';

function setStatus(msg, cls) {
  const el = $('status');
  el.textContent = msg;
  el.className = 'status' + (cls ? ' ' + cls : '');
}

/** Convert lat/lng to slippy-map tile x/y at zoom z. */
function latLngToTile(lat, lng, z) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const la = lat * Math.PI / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n);
  return [Math.min(Math.max(x, 0), n - 1), Math.min(Math.max(y, 0), n - 1)];
}

/** Fill {z}/{x}/{y} (and {s} subdomain placeholder) in a template. */
function buildUrl(tpl, z, x, y) {
  return tpl
    .replace(/\{s\}/g, 'a')
    .replace(/\{z\}/gi, z)
    .replace(/\{x\}/gi, x)
    .replace(/\{y\}/gi, y);
}

function load() {
  const tpl = $('tpl').value.trim();
  if (!tpl) { setStatus('Enter a tile URL template first.', 'err'); return; }
  if (!/^https?:\/\//i.test(tpl)) { setStatus('URL must start with http:// or https://', 'err'); return; }
  if (!/\{z\}|\{x\}|\{y\}/i.test(tpl)) {
    setStatus('Template should contain {z}, {x} and {y} placeholders.', 'err');
    return;
  }

  let z, x, y;
  try {
    if (mode === 'zxy') {
      z = Number($('z').value); x = Number($('x').value); y = Number($('y').value);
      if (![z, x, y].every(Number.isFinite) || z < 0 || z > 22) throw new Error('bad z/x/y');
      const max = 2 ** z - 1;
      if (x > max || y > max) throw new Error('x/y out of range for zoom ' + z + ' (max ' + max + ')');
    } else {
      const lat = Number($('lat').value), lng = Number($('lng').value);
      z = Number($('zoom').value);
      if (!Number.isFinite(lat) || lat < -85.05 || lat > 85.05) throw new Error('lat must be −85.05…85.05');
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('lng must be −180…180');
      if (!Number.isFinite(z) || z < 0 || z > 22) throw new Error('bad zoom');
      [x, y] = latLngToTile(lat, lng, z);
    }
  } catch (e) {
    setStatus(e.message || 'Check your numbers.', 'err');
    return;
  }

  const url = buildUrl(tpl, z, x, y);
  $('urlOut').textContent = url;

  const img = $('tile'), ph = $('placeholder'), btn = $('load');
  btn.disabled = true;
  img.classList.add('hidden');
  ph.classList.remove('hidden');
  ph.textContent = 'Loading…';
  setStatus('Requesting tile z=' + z + ' x=' + x + ' y=' + y + '…');

  img.onload = () => {
    btn.disabled = false;
    ph.classList.add('hidden');
    img.classList.remove('hidden');
    setStatus('Tile loaded (' + img.naturalWidth + '×' + img.naturalHeight + ').', 'ok');
    chrome.storage.local.set({ tiletest: { tpl, mode, z, x, y, lat: $('lat').value, lng: $('lng').value, zoom: $('zoom').value } });
  };
  img.onerror = () => {
    btn.disabled = false;
    ph.textContent = 'Load failed';
    setStatus('Could not load the tile — check the URL and tile server policy.', 'err');
  };
  img.src = url;
}

// Mode tabs
document.querySelectorAll('.mode').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.mode').forEach((m) => m.classList.remove('active'));
    b.classList.add('active');
    mode = b.dataset.mode;
    $('zxyRow').classList.toggle('hidden', mode !== 'zxy');
    $('latlngRow').classList.toggle('hidden', mode !== 'latlng');
  });
});

$('load').addEventListener('click', load);

// Restore last state
chrome.storage.local.get('tiletest', ({ tiletest }) => {
  if (!tiletest) return;
  if (tiletest.tpl) $('tpl').value = tiletest.tpl;
  if (tiletest.mode === 'latlng') {
    document.querySelector('.mode[data-mode="latlng"]').click();
    if (tiletest.lat) $('lat').value = tiletest.lat;
    if (tiletest.lng) $('lng').value = tiletest.lng;
    if (tiletest.zoom) $('zoom').value = tiletest.zoom;
  } else {
    if (tiletest.z !== undefined) $('z').value = tiletest.z;
    if (tiletest.x !== undefined) $('x').value = tiletest.x;
    if (tiletest.y !== undefined) $('y').value = tiletest.y;
  }
});
