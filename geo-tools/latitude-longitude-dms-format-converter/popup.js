/* CoordFlip — decimal <-> DMS conversion logic. All local, no network. */
'use strict';

const $ = (id) => document.getElementById(id);

/* ---------- Conversion core ---------- */

/** Decimal degrees -> {d, m, s, dir} */
function decToDms(dec, isLat) {
  const dir = dec < 0 ? (isLat ? 'S' : 'W') : (isLat ? 'N' : 'E');
  const a = Math.abs(dec);
  const d = Math.floor(a);
  const mFloat = (a - d) * 60;
  const m = Math.floor(mFloat);
  const s = (mFloat - m) * 60;
  return { d, m, s, dir };
}

/** Format a DMS component set, e.g. 28°36′50.04″N */
function formatDms(dec, isLat) {
  const { d, m, s, dir } = decToDms(dec, isLat);
  return `${d}°${m}′${s.toFixed(2)}″${dir}`;
}

/** Parse one DMS-ish string -> decimal. Accepts 28°36'50"N, 28 36 50 N, 28.6139N etc. */
function parseDms(str, isLat) {
  const s = str.trim();
  if (!s) throw new Error('Empty input.');
  // Plain decimal fallback (with optional hemisphere letter)
  const decOnly = s.match(/^([+-]?\d+(?:\.\d+)?)\s*([NnSsEeWw])?$/);
  if (decOnly) {
    let v = parseFloat(decOnly[1]);
    const hem = (decOnly[2] || '').toUpperCase();
    if (hem === 'S' || hem === 'W') v = -Math.abs(v);
    if (hem === 'N' || hem === 'E') v = Math.abs(v);
    return v;
  }
  // DMS: capture numbers and optional hemisphere letter
  const re = /([+-]?\d+(?:\.\d+)?)[°d]?\s*(\d+(?:\.\d+)?)?[′'m]?\s*(\d+(?:\.\d+)?)?[″"s]?\s*([NnSsEeWw])?/;
  const m = s.match(re);
  if (!m) throw new Error(`Could not parse "${str}".`);
  const d = parseFloat(m[1]);
  const min = m[2] ? parseFloat(m[2]) : 0;
  const sec = m[3] ? parseFloat(m[3]) : 0;
  if (min >= 60 || sec >= 60) throw new Error('Minutes/seconds must be < 60.');
  let v = Math.abs(d) + min / 60 + sec / 3600;
  const hem = (m[4] || '').toUpperCase();
  const sign = d < 0 || hem === 'S' || hem === 'W' ? -1 : 1;
  v *= sign;
  return v;
}

function validateLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Values must be numbers.');
  if (lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90.');
  if (lng < -180 || lng > 180) throw new Error('Longitude must be between -180 and 180.');
}

/* ---------- UI helpers ---------- */

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 1400);
}

function showErr(id, msg) {
  const el = $(id);
  el.textContent = msg;
  el.hidden = false;
}
function hideErr(id) { $(id).hidden = true; }

document.querySelectorAll('.copy').forEach((b) => {
  b.addEventListener('click', async () => {
    const txt = $(b.dataset.copy).textContent;
    try {
      await navigator.clipboard.writeText(txt);
      toast('Copied');
    } catch {
      // Fallback for clipboard denial
      const ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copied'); }
      catch { toast('Copy failed'); }
      ta.remove();
    }
  });
});

/* ---------- Tabs ---------- */
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    $('tab-' + t.dataset.tab).classList.add('active');
  });
});

/* ---------- Decimal -> DMS ---------- */
$('btn-dec2dms').addEventListener('click', async () => {
  hideErr('err-dec2dms');
  try {
    const lat = parseFloat($('dec-lat').value.trim().replace(',', '.'));
    const lng = parseFloat($('dec-lng').value.trim().replace(',', '.'));
    validateLatLng(lat, lng);
    const latDms = formatDms(lat, true);
    const lngDms = formatDms(lng, false);
    $('out-lat').textContent = latDms;
    $('out-lng').textContent = lngDms;
    $('out-combined').textContent = `${latDms}, ${lngDms}`;
    $('res-dec2dms').hidden = false;
    await chrome.storage.local.set({ lastDec: { lat, lng } });
  } catch (e) { showErr('err-dec2dms', e.message); }
});

/* ---------- DMS -> Decimal ---------- */
$('btn-dms2dec').addEventListener('click', async () => {
  hideErr('err-dms2dec');
  try {
    const lat = parseDms($('dms-lat').value, true);
    const lng = parseDms($('dms-lng').value, false);
    validateLatLng(lat, lng);
    $('out-dec-lat').textContent = lat.toFixed(6);
    $('out-dec-lng').textContent = lng.toFixed(6);
    $('out-dec-combined').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    $('res-dms2dec').hidden = false;
    await chrome.storage.local.set({ lastDms: { lat: $('dms-lat').value, lng: $('dms-lng').value } });
  } catch (e) { showErr('err-dms2dec', e.message); }
});

/* ---------- Batch ---------- */
let batchDir = 'toDms';
document.querySelectorAll('.segbtn').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.segbtn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    batchDir = b.dataset.dir;
  });
});

let lastBatchOut = '';
$('btn-batch').addEventListener('click', async () => {
  hideErr('err-batch');
  const box = $('res-batch');
  box.innerHTML = '';
  const lines = $('batch-in').value.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) { showErr('err-batch', 'Paste at least one coordinate.'); return; }
  const out = [];
  let ok = 0;
  for (const line of lines) {
    try {
      // Split on comma or semicolon; each part may be lat/lng
      const parts = line.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
      if (parts.length !== 2) throw new Error('need "lat, lng"');
      let result;
      if (batchDir === 'toDms') {
        const lat = parseFloat(parts[0].replace(',', '.'));
        const lng = parseFloat(parts[1].replace(',', '.'));
        validateLatLng(lat, lng);
        result = `${formatDms(lat, true)}, ${formatDms(lng, false)}`;
      } else {
        const lat = parseDms(parts[0], true);
        const lng = parseDms(parts[1], false);
        validateLatLng(lat, lng);
        result = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }
      ok++;
      const row = document.createElement('div');
      row.className = 'rrow';
      row.innerHTML = `<span class="bsrc"></span><span class="bline"></span>`;
      row.querySelector('.bsrc').textContent = line;
      row.querySelector('.bline').textContent = '→ ' + result;
      box.appendChild(row);
      out.push(result);
    } catch (e) {
      const row = document.createElement('div');
      row.className = 'rrow';
      row.innerHTML = `<span class="bsrc"></span><span class="bline" style="color:#f87171"></span>`;
      row.querySelector('.bsrc').textContent = line;
      row.querySelector('.bline').textContent = '✕ ' + e.message;
      box.appendChild(row);
    }
  }
  box.hidden = false;
  lastBatchOut = out.join('\n');
  $('btn-batch-copy').hidden = !out.length;
  toast(`${ok}/${lines.length} converted`);
  await chrome.storage.local.set({ lastBatch: $('batch-in').value });
});

$('btn-batch-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(lastBatchOut); toast('Copied all'); }
  catch { toast('Copy failed'); }
});

/* ---------- Restore last inputs ---------- */
(async () => {
  try {
    const s = await chrome.storage.local.get(['lastDec', 'lastDms', 'lastBatch']);
    if (s.lastDec) { $('dec-lat').value = s.lastDec.lat; $('dec-lng').value = s.lastDec.lng; }
    if (s.lastDms) { $('dms-lat').value = s.lastDms.lat; $('dms-lng').value = s.lastDms.lng; }
    if (s.lastBatch) $('batch-in').value = s.lastBatch;
  } catch { /* storage unavailable — ignore */ }
})();
