/* SmoothGlide popup logic.
 * Injected functions below are FULLY SELF-CONTAINED (func + args only):
 * they never reference popup-scope variables. */

/* ---- injected: install the smooth-scroll wheel interceptor ---- */
function applySmoothScroll(intensity, speedPct) {
  var KEY = '__smoothGlide';
  var st = window[KEY];
  if (st && st.handler) {
    window.removeEventListener('wheel', st.handler, { passive: false });
  }

  var anim = null;
  var dest = window.scrollY; // accumulated scroll destination

  function step(from, to, dur) {
    if (anim !== null) cancelAnimationFrame(anim);
    var t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      window.scrollTo(0, from + (to - from) * e);
      if (p < 1) {
        anim = requestAnimationFrame(frame);
      } else {
        anim = null;
        dest = to;
      }
    }
    anim = requestAnimationFrame(frame);
  }

  function onWheel(e) {
    var t = e.target;
    // Never hijack form fields / editable areas.
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    // Let nested scrollable containers scroll natively.
    var n = t && t.parentElement;
    while (n && n !== document.body && n !== document.documentElement) {
      if (n.scrollHeight > n.clientHeight + 2) return;
      n = n.parentElement;
    }
    e.preventDefault();
    var d = e.deltaY || 0;
    if (e.deltaMode === 1) d *= 16;                 // lines -> px
    else if (e.deltaMode === 2) d *= window.innerHeight; // pages -> px
    d *= (speedPct / 100);
    var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    dest = Math.max(0, Math.min(max, dest + d));
    step(window.scrollY, dest, 90 + intensity * 55);
  }

  window.addEventListener('wheel', onWheel, { passive: false });
  window[KEY] = { handler: onWheel };
  return true;
}

/* ---- injected: remove the interceptor, restoring native scroll ---- */
function removeSmoothScroll() {
  var st = window['__smoothGlide'];
  if (st && st.handler) {
    window.removeEventListener('wheel', st.handler, { passive: false });
  }
  try { delete window['__smoothGlide']; }
  catch (e) { window['__smoothGlide'] = undefined; }
  return true;
}

/* ---- injected: report whether the interceptor is installed ---- */
function probeSmoothScroll() {
  return !!(window['__smoothGlide'] && window['__smoothGlide'].handler);
}

/* ---------------- popup UI ---------------- */

var $ = function (id) { return document.getElementById(id); };
var DEFAULTS = { intensity: 5, speed: 100 };
var settings = { intensity: 5, speed: 100 };
var enabled = false;
var debounceTimer = null;

function setStatus(msg, on) {
  var el = $('status');
  el.textContent = msg;
  el.classList.toggle('on', !!on);
}

function isRestricted(url) {
  return !url || /^(chrome|edge|about|chrome-extension|moz-extension|view-source):/.test(url);
}

async function activeTab() {
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function run(fn, args) {
  var tab = await activeTab();
  if (!tab || isRestricted(tab.url)) {
    setStatus('Restricted page — SmoothGlide cannot modify this tab.');
    return null;
  }
  try {
    var res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fn,
      args: args || []
    });
    return res[0] ? res[0].result : null;
  } catch (e) {
    setStatus('Could not reach this tab.');
    return null;
  }
}

async function applyCurrent() {
  var ok = await run(applySmoothScroll, [settings.intensity, settings.speed]);
  if (ok) setStatus('SmoothGlide is active on this tab.', true);
  return ok;
}

async function refresh() {
  var stored = await chrome.storage.local.get(DEFAULTS);
  settings.intensity = stored.intensity;
  settings.speed = stored.speed;
  $('intensity').value = settings.intensity;
  $('speed').value = settings.speed;
  $('intensityVal').textContent = settings.intensity;
  $('speedVal').textContent = settings.speed + '%';

  var on = await run(probeSmoothScroll);
  enabled = on === true;
  $('enabled').checked = enabled;
  if (on === null) {
    // run() already set an error status
  } else if (enabled) {
    setStatus('SmoothGlide is active on this tab.', true);
  } else {
    setStatus('Off — native scrolling. Flip the switch to enable on this tab.');
  }
}

function scheduleReapply() {
  if (!enabled) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyCurrent, 250);
}

document.addEventListener('DOMContentLoaded', function () {
  refresh();

  $('enabled').addEventListener('change', async function (e) {
    enabled = e.target.checked;
    if (enabled) {
      var ok = await applyCurrent();
      if (!ok) { enabled = false; $('enabled').checked = false; }
    } else {
      await run(removeSmoothScroll);
      setStatus('Off — native scrolling. Flip the switch to enable on this tab.');
    }
  });

  $('intensity').addEventListener('input', function (e) {
    settings.intensity = parseInt(e.target.value, 10);
    $('intensityVal').textContent = settings.intensity;
    chrome.storage.local.set({ intensity: settings.intensity });
    scheduleReapply();
  });

  $('speed').addEventListener('input', function (e) {
    settings.speed = parseInt(e.target.value, 10);
    $('speedVal').textContent = settings.speed + '%';
    chrome.storage.local.set({ speed: settings.speed });
    scheduleReapply();
  });
});
