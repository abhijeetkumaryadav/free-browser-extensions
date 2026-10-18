/* Geo Location Spoofing Panel — popup logic.
 * All settings live in chrome.storage.local. The content script picks them up
 * on every page load and injects the page-world spoof when active.
 */

const PRESETS = [
  { name: 'Custom…', lat: null, lng: null },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
  { name: 'New York, USA', lat: 40.7128, lng: -74.006 },
  { name: 'San Francisco, USA', lat: 37.7749, lng: -122.4194 },
  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
  { name: 'Berlin, Germany', lat: 52.52, lng: 13.405 },
  { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093 },
  { name: 'Mumbai, India', lat: 19.076, lng: 72.8777 },
  { name: 'São Paulo, Brazil', lat: -23.5558, lng: -46.6396 },
  { name: 'Reykjavik, Iceland', lat: 64.1466, lng: -21.9426 }
];

const DEFAULTS = {
  masterEnabled: true,
  latitude: 51.5074,
  longitude: -0.1278,
  accuracy: 100,
  disabledHosts: []
};

const $ = (id) => document.getElementById(id);

async function loadSettings() {
  return chrome.storage.local.get(DEFAULTS);
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

async function init() {
  const s = await loadSettings();

  // Preset dropdown
  const sel = $('presetSelect');
  PRESETS.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
  // Select the preset matching stored coords, else "Custom…"
  const matchIdx = PRESETS.findIndex(
    (p, i) => i > 0 && p.lat === s.latitude && p.lng === s.longitude
  );
  sel.value = matchIdx >= 0 ? matchIdx : 0;

  $('masterToggle').checked = s.masterEnabled;
  $('latInput').value = s.latitude;
  $('lngInput').value = s.longitude;
  $('accRange').value = s.accuracy;
  $('accValue').textContent = s.accuracy + ' m';

  // Per-site toggle for the active tab's host
  let host = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    host = tab && tab.url ? hostOf(tab.url) : '';
  } catch { /* activeTab may be unavailable */ }
  if (host) {
    $('siteHint').textContent = 'Current site: ' + host;
    $('siteToggle').checked = !(s.disabledHosts || []).includes(host);
    $('siteToggle').disabled = false;
  } else {
    $('siteHint').textContent = 'Open a website to toggle per-site spoofing.';
    $('siteToggle').disabled = true;
  }

  // --- events ---
  sel.addEventListener('change', () => {
    const p = PRESETS[Number(sel.value)];
    if (p.lat !== null) {
      $('latInput').value = p.lat;
      $('lngInput').value = p.lng;
    }
  });

  $('accRange').addEventListener('input', () => {
    $('accValue').textContent = $('accRange').value + ' m';
  });

  $('saveBtn').addEventListener('click', async () => {
    const lat = parseFloat($('latInput').value);
    const lng = parseFloat($('lngInput').value);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
        !Number.isFinite(lng) || lng < -180 || lng > 180) {
      $('saveMsg').textContent = 'Enter valid lat (−90…90) / lng (−180…180).';
      $('saveMsg').classList.remove('hidden');
      return;
    }
    await chrome.storage.local.set({
      latitude: lat,
      longitude: lng,
      accuracy: Number($('accRange').value)
    });
    $('saveMsg').textContent = 'Saved ✓ — reload open pages to apply.';
    $('saveMsg').classList.remove('hidden');
    setTimeout(() => $('saveMsg').classList.add('hidden'), 2500);
  });

  $('masterToggle').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ masterEnabled: e.target.checked });
  });

  $('siteToggle').addEventListener('change', async (e) => {
    if (!host) return;
    const cur = await loadSettings();
    const disabled = new Set(cur.disabledHosts || []);
    if (e.target.checked) disabled.delete(host);
    else disabled.add(host);
    await chrome.storage.local.set({ disabledHosts: [...disabled] });
  });
}

document.addEventListener('DOMContentLoaded', init);
