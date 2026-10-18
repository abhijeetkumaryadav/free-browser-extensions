/* Viewport Responsive Viewer — popup logic
 * Measures the active tab's viewport via scripting, renders breakpoint
 * position, and shows scaled device-width previews of the current URL. */

const ACCENT = '#10b981';
const els = {};
['pageHost','vpW','vpH','vpDpr','bpMarker','bpCaption','deviceRow','customW','customH','customGo',
 'previewLabel','scaleBadge','previewScroll','previewStage','previewEmpty','frameHint','openFull']
  .forEach(id => els[id] = document.getElementById(id));

let currentUrl = '';
let activeDevice = null;
let restored = false;

/* Restore the last-used device preview once the URL is known */
function restoreLast() {
  if (restored) return;
  restored = true;
  chrome.storage.local.get('lastDevice', ({ lastDevice }) => {
    if (lastDevice && currentUrl && /^https?:/.test(currentUrl)) {
      const btn = els.deviceRow.querySelector(`[data-w="${lastDevice.width}"]`);
      if (btn) btn.click();
    }
  });
}

/* Measure the active tab's viewport + grab its URL */
async function measure() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    const url = new URL(tab.url);
    currentUrl = tab.url;
    els.pageHost.textContent = url.host;
    restoreLast();

    // Inject a tiny probe — works on any page scripting can access.
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio || 1
      })
    }).catch(() => [{ result: null }]);

    if (result) {
      els.vpW.textContent = result.w;
      els.vpH.textContent = result.h;
      els.vpDpr.textContent = result.dpr;
      renderBreakpoint(result.w);
    } else {
      els.bpCaption.textContent = 'Cannot measure this page (browser-internal page).';
    }
  } catch (e) {
    els.bpCaption.textContent = 'Cannot measure this page.';
  }
}

/* Breakpoint zones: XS <480, SM <768, MD <1024, LG <1440, XL 1440+ */
function renderBreakpoint(w) {
  const zones = [
    { name: 'Extra small — phones', max: 480 },
    { name: 'Small — large phones', max: 768 },
    { name: 'Medium — tablets', max: 1024 },
    { name: 'Large — laptops', max: 1440 },
    { name: 'Extra large — desktops', max: Infinity }
  ];
  const zone = zones.find(z => w < z.max);
  // Map width onto the bar: log-ish scale capped at 2560px.
  const pct = Math.min(100, (w / 2560) * 100);
  els.bpMarker.style.left = `calc(${pct}% - 1px)`;
  els.bpCaption.innerHTML = `Current: <strong>${w}px</strong> — ${zone.name}`;
}

/* Render a scaled iframe preview of the current URL at device width */
function showPreview(width, height, name) {
  if (!currentUrl || !/^https?:/.test(currentUrl)) {
    els.previewLabel.textContent = 'Cannot preview this page';
    return;
  }
  activeDevice = { width, height, name };
  els.previewEmpty?.remove();

  const avail = els.previewScroll.clientWidth || 320;
  const scale = Math.min(1, avail / width);

  // Remove any previous frame
  els.previewStage.querySelectorAll('iframe').forEach(f => f.remove());

  const frame = document.createElement('iframe');
  frame.width = width;
  frame.height = height;
  frame.style.width = width + 'px';
  frame.style.height = height + 'px';
  frame.style.transform = `scale(${scale})`;
  frame.title = `${name} preview (${width}×${height})`;
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
  els.previewStage.style.width = (width * scale) + 'px';
  els.previewStage.style.height = (height * scale) + 'px';
  els.previewStage.appendChild(frame);
  frame.src = currentUrl;

  els.previewLabel.textContent = `${name} — ${width}×${height}`;
  els.scaleBadge.textContent = Math.round(scale * 100) + '% scale';
  els.frameHint.hidden = false;

  // Remember last device per host
  chrome.storage.local.set({ lastDevice: { width, height, name } });
}

/* Wire up device buttons */
els.deviceRow.querySelectorAll('.device-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    els.deviceRow.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showPreview(+btn.dataset.w, +btn.dataset.h, btn.dataset.name);
  });
});

els.customGo.addEventListener('click', () => {
  const w = Math.min(2560, Math.max(200, +els.customW.value || 0));
  const h = Math.min(2560, Math.max(200, +els.customH.value || 0));
  if (!w || !h) return;
  els.deviceRow.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
  showPreview(w, h, 'Custom');
});

/* Open the full side-by-side comparison page */
els.openFull.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

/* Re-measure every 2s while the popup is open (cheap, keeps it live) */
measure();
setInterval(measure, 2000);
