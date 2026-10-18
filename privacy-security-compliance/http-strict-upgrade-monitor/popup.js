/* HTTP Strict Upgrade Monitor — popup logic.
 * Read-only: injects a small scan function into the active tab (via the
 * activeTab grant from opening the popup), collects mixed-content and form
 * stats, and renders a heuristic security grade. Nothing is blocked or changed.
 */

const $ = (id) => document.getElementById(id);

/* Runs inside the page. Returns plain JSON-serializable stats. */
function pageScan() {
  const isHttpUrl = (u) => typeof u === 'string' && u.trim().toLowerCase().startsWith('http://');

  const imgs = [...document.images].filter((i) => isHttpUrl(i.currentSrc || i.src)).length;
  const scripts = [...document.scripts].filter((s) => isHttpUrl(s.src)).length;
  const frames = [...document.querySelectorAll('iframe')].filter((f) => isHttpUrl(f.src)).length;
  const others = [...document.querySelectorAll('link[href], source[src], video[src], audio[src], embed[src], object[data]')]
    .filter((el) => isHttpUrl(el.href || el.src || el.getAttribute('data'))).length;

  let insecureForms = 0;
  let pwOnHttp = 0;
  const pageIsHttp = location.protocol === 'http:';
  document.querySelectorAll('form').forEach((form) => {
    const action = form.getAttribute('action');
    // Missing action posts back to the page itself.
    const targetIsHttp = !action || action === '' ? pageIsHttp
      : isHttpUrl(new URL(action, location.href).href);
    if (targetIsHttp) insecureForms++;
    if (targetIsHttp && form.querySelector('input[type="password"]')) pwOnHttp++;
  });
  // If the page itself is http, any password field is exposed in transit.
  if (pageIsHttp) {
    pwOnHttp = Math.max(pwOnHttp,
      document.querySelectorAll('input[type="password"]').length);
  }

  return {
    protocol: location.protocol,
    imgs, scripts, frames, others, insecureForms, pwOnHttp,
    hasPasswordField: document.querySelectorAll('input[type="password"]').length > 0
  };
}

function gradeFor(stats, isHttps) {
  const warnings = [];
  let score = 100;

  if (!isHttps) { score -= 40; warnings.push('Page is served over plain HTTP — traffic is not encrypted.'); }
  const mixed = stats.imgs + stats.scripts + stats.frames + stats.others;
  if (mixed > 0) {
    score -= Math.min(30, mixed * 5);
    warnings.push(mixed + ' subresource(s) load over http:// on an HTTPS page (mixed content).');
  }
  if (stats.scripts > 0 && isHttps) { score -= 5; warnings.push('Insecure scripts are the riskiest mixed content — they can be tampered with in transit.'); }
  if (stats.insecureForms > 0) { score -= 15; warnings.push(stats.insecureForms + ' form(s) submit to an http:// endpoint.'); }
  if (stats.pwOnHttp > 0) { score -= 15; warnings.push('Password field(s) submitted over plain HTTP — credentials could be intercepted.'); }

  score = Math.max(0, score);
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : score >= 35 ? 'D' : 'F';
  return { score, grade, warnings };
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

async function runScan() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch { tab = null; }

  if (!tab || !tab.url || !/^https?:/.test(tab.url)) {
    $('hostLine').textContent = 'Open a website to scan it';
    $('protocolVal').textContent = 'n/a';
    $('urlVal').textContent = '—';
    return;
  }

  const url = tab.url;
  $('hostLine').textContent = hostOf(url);
  $('urlVal').textContent = url.length > 48 ? url.slice(0, 48) + '…' : url;

  const isHttps = url.startsWith('https://');
  const protoEl = $('protocolVal');
  protoEl.textContent = isHttps ? 'HTTPS' : 'HTTP';
  protoEl.className = 'pill ' + (isHttps ? 'secure' : 'insecure');

  let stats = null;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pageScan
    });
    stats = res && res.result;
  } catch (e) {
    $('hostLine').textContent = hostOf(url) + ' — scan blocked on this page';
  }
  if (!stats) return;

  const set = (id, v, badCls) => {
    const el = $(id);
    el.textContent = v;
    el.className = 'count' + (v > 0 ? ' ' + badCls : '');
  };
  set('imgCount', stats.imgs, 'bad');
  set('scriptCount', stats.scripts, 'bad');
  set('frameCount', stats.frames, 'bad');
  set('otherCount', stats.others, 'bad');
  set('formCount', stats.insecureForms, 'bad');
  set('pwCount', stats.pwOnHttp, 'warn');

  const { grade, warnings } = gradeFor(stats, isHttps);
  const badge = $('gradeBadge');
  badge.textContent = grade;
  badge.className = 'grade ' + grade.toLowerCase();

  if (warnings.length) {
    $('warnCard').classList.remove('hidden');
    $('warnList').innerHTML = '';
    warnings.forEach((w) => {
      const li = document.createElement('li');
      li.textContent = w;
      $('warnList').appendChild(li);
    });
  } else {
    $('warnCard').classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  runScan();
  $('rescanBtn').addEventListener('click', runScan);
});
