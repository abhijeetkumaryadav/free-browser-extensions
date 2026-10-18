/* Layout Pixel-Perfect Overlay — content script (injected on demand via scripting).
 * Renders the mockup image as a fixed, draggable overlay. All state lives in
 * chrome.storage.local under the key `ppo:<host>`; this script re-reads on
 * storage change so the popup sliders update the page live. */

const OVERLAY_ID = '__ppo_overlay__';
const HANDLE_ID = '__ppo_handle__';

let settings = null;
let host = location.host;
let imgEl = null;
let wrapEl = null;
let dragState = null;

/* Storage key for this site */
const key = () => `ppo:${host}`;

/* Build the overlay DOM */
function build() {
  if (document.getElementById(OVERLAY_ID)) return;

  wrapEl = document.createElement('div');
  wrapEl.id = OVERLAY_ID;
  wrapEl.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'z-index:2147483647',
    'pointer-events:none', // let clicks pass through except the handle
    'transform-origin:top left'
  ].join(';');

  imgEl = document.createElement('img');
  imgEl.style.cssText = 'display:block;user-select:none;-webkit-user-drag:none;';
  imgEl.draggable = false;
  wrapEl.appendChild(imgEl);

  // Small drag handle in the corner (pointer events re-enabled here)
  const handle = document.createElement('div');
  handle.id = HANDLE_ID;
  handle.title = 'Drag to move overlay';
  handle.style.cssText = [
    'position:absolute', 'top:-14px', 'left:-14px', 'width:28px', 'height:28px',
    'border-radius:50%', 'background:#f97316', 'cursor:move', 'pointer-events:auto',
    'display:flex', 'align-items:center', 'justify-content:center',
    'box-shadow:0 2px 8px rgba(0,0,0,.5)', 'color:#1c0e02',
    'font-size:14px', 'font-weight:bold', 'line-height:1'
  ].join(';');
  handle.textContent = '✥';
  wrapEl.appendChild(handle);

  handle.addEventListener('mousedown', e => {
    e.preventDefault(); e.stopPropagation();
    dragState = { sx: e.clientX - settings.x, sy: e.clientY - settings.y };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag, { once: true });
  });

  document.documentElement.appendChild(wrapEl);
}

function onDrag(e) {
  if (!dragState) return;
  settings.x = Math.round(e.clientX - dragState.sx);
  settings.y = Math.round(e.clientY - dragState.sy);
  apply();
}

function endDrag() {
  document.removeEventListener('mousemove', onDrag);
  dragState = null;
  save(); // persist position (debounced by caller rhythm)
}

/* Apply current settings to the overlay */
function apply() {
  if (!settings || !settings.image || !settings.enabled) {
    if (wrapEl) wrapEl.style.display = 'none';
    return;
  }
  build();
  wrapEl.style.display = 'block';
  if (imgEl.getAttribute('src') !== settings.image) imgEl.src = settings.image;
  imgEl.style.opacity = settings.opacity / 100;
  wrapEl.style.transform = `translate(${settings.x}px, ${settings.y}px) scale(${settings.scale / 100})`;
  wrapEl.style.mixBlendMode = settings.blend ? 'difference' : 'normal';
}

/* Persist settings for this host */
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ [key()]: settings });
  }, 400);
}

/* Load settings, then watch for popup-driven changes */
async function init() {
  const data = await chrome.storage.local.get(key());
  settings = data[key()] || null;
  if (!settings) return; // nothing configured for this site
  apply();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[key()]) {
    settings = changes[key()].newValue || null;
    apply();
  }
});

/* The popup pings us after injecting to force a refresh */
chrome.runtime.onMessage.addListener(msg => {
  if (msg && msg.type === 'ppo-refresh') {
    host = location.host;
    init();
  }
});

init();
