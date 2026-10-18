/* Application Manifest Resource Linter.
   Flow: content script finds <link rel="manifest"> on the tab and fetches
   the manifest URL (same-origin, no special permissions needed beyond
   activeTab+scripting). The lint rules run on the parsed JSON here.
   Honest scope: lints the manifest FILE — not installability, not the app. */

'use strict';

const $ = (id) => document.getElementById(id);
const VALID_DISPLAY = ['fullscreen', 'standalone', 'minimal-ui', 'browser', 'picture-in-picture'];
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parse an icon size string like "192x192" or "any". */
function parseSize(s) {
  if (typeof s !== 'string') return null;
  const m = s.trim().toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)$/);
  if (!m) return null;
  return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
}

/** Run lint rules over a parsed manifest object. Returns [{level, title, hint}]. */
function lintManifest(m) {
  const out = [];
  const add = (level, title, hint) => out.push({ level, title, hint });

  // --- name ---
  if (!m.name && !m.short_name) {
    add('err', 'Missing <code>name</code>', 'Provide at least "name" (or "short_name") so the app has a label.');
  } else {
    add('ok', 'Name present', 'Uses "' + (m.name || m.short_name) + '".');
    if (m.name && m.name.length > 45) {
      add('warn', 'Long <code>name</code>', 'Over ~45 characters may be truncated on home screens; keep short_name concise.');
    }
  }

  // --- start_url ---
  if (!m.start_url) {
    add('err', 'Missing <code>start_url</code>', 'Without it the launched page is undefined; usually "/" or the app entry.');
  } else {
    add('ok', 'start_url present', 'Value: "' + m.start_url + '".');
  }

  // --- display ---
  if (!m.display) {
    add('warn', 'Missing <code>display</code>', 'Defaults to "browser". Use "standalone" or "minimal-ui" for an app-like feel.');
  } else if (!VALID_DISPLAY.includes(m.display)) {
    add('err', 'Invalid <code>display</code> "' + m.display + '"', 'Must be one of: ' + VALID_DISPLAY.join(', ') + '.');
  } else {
    add('ok', 'display valid', 'Value: "' + m.display + '".');
  }

  // --- icons ---
  if (!Array.isArray(m.icons) || m.icons.length === 0) {
    add('err', 'Missing <code>icons</code>', 'Provide at least a 192px and a 512px PNG for install prompts and splash screens.');
  } else {
    let has192 = false, has512 = false, bad = 0;
    m.icons.forEach((ic, i) => {
      if (!ic || typeof ic.src !== 'string') { bad++; return; }
      const sizes = String(ic.sizes || '').split(/\s+/).map(parseSize).filter(Boolean);
      if (sizes.length === 0 && !/any/i.test(String(ic.sizes || ''))) bad++;
      sizes.forEach((s) => {
        if (s.w >= 192 && s.h >= 192) has192 = true;
        if (s.w >= 512 && s.h >= 512) has512 = true;
      });
      if (!ic.type) {
        add('warn', 'Icon #' + (i + 1) + ' missing <code>type</code>', 'Add e.g. "type": "image/png" so browsers don\'t have to sniff it.');
      }
    });
    if (bad > 0) add('warn', bad + ' icon entr' + (bad > 1 ? 'ies' : 'y') + ' lack usable <code>sizes</code>', 'Use "192x192", "512x512", or "any".');
    if (!has192) add('warn', 'No 192px icon', 'Install prompts typically want at least 192x192.');
    if (!has512) add('warn', 'No 512px icon', 'Splash screens typically want at least 512x512.');
    if (has192 && has512 && bad === 0) add('ok', 'Icons look good', m.icons.length + ' icon(s), 192px+ and 512px+ present.');
  }

  // --- colors ---
  ['background_color', 'theme_color'].forEach((key) => {
    const v = m[key];
    if (!v) {
      add('warn', 'Missing <code>' + key + '</code>', 'Sets the splash screen / browser UI color; recommended for a polished install.');
    } else if (!HEX_COLOR.test(String(v).trim())) {
      add('warn', 'Suspicious <code>' + key + '</code> "' + v + '"', 'Should be a CSS hex color like "#ffffff".');
    } else {
      add('ok', key + ' valid', 'Value: "' + v + '".');
    }
  });

  // --- id ---
  if (m.id && typeof m.id !== 'string') {
    add('warn', 'Odd <code>id</code> type', '"id" should be a string URL.');
  }

  return out;
}

/** Ask the active tab for its manifest link and fetched JSON. */
async function fetchManifestFromTab(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const link = document.querySelector('link[rel="manifest"]');
      if (!link || !link.href) return { found: false };
      try {
        const res = await fetch(link.href, { credentials: 'same-origin' });
        if (!res.ok) return { found: true, href: link.href, error: 'HTTP ' + res.status };
        const text = await res.text();
        try {
          return { found: true, href: link.href, json: JSON.parse(text) };
        } catch (e) {
          return { found: true, href: link.href, error: 'Not valid JSON: ' + e.message };
        }
      } catch (e) {
        return { found: true, href: link.href, error: 'Fetch failed: ' + e.message };
      }
    },
  });
  return result && result.result ? result.result : { found: false };
}

function renderIssues(issues) {
  const ul = $('results');
  ul.innerHTML = '';
  let e = 0, w = 0, o = 0;
  issues.forEach((it) => {
    if (it.level === 'err') e++;
    else if (it.level === 'warn') w++;
    else o++;
    const li = document.createElement('li');
    li.className = it.level;
    const lvl = document.createElement('span');
    lvl.className = 'lvl';
    lvl.textContent = it.level === 'ok' ? 'pass' : it.level === 'warn' ? 'warning' : 'error';
    const title = document.createElement('div');
    title.innerHTML = it.title; // titles are built internally; no user input
    li.appendChild(lvl);
    li.appendChild(title);
    if (it.hint) {
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = it.hint;
      li.appendChild(hint);
    }
    ul.appendChild(li);
  });
  $('errCount').textContent = e;
  $('warnCount').textContent = w;
  $('okCount').textContent = o;
  $('summary').classList.remove('hidden');
}

async function runLint() {
  const btn = $('lint');
  btn.disabled = true;
  $('results').innerHTML = '';
  $('summary').classList.add('hidden');
  $('status').textContent = 'Looking for a manifest link…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
      $('status').textContent = 'Open a regular http(s) page first — internal pages have no web manifest.';
      return;
    }
    const data = await fetchManifestFromTab(tab.id);
    if (!data.found) {
      $('status').textContent = 'No <link rel="manifest"> found on this page.';
      return;
    }
    if (data.error || !data.json) {
      $('status').textContent = 'Manifest found but unreadable: ' + (data.error || 'unknown error');
      return;
    }
    $('status').textContent = 'Manifest: ' + data.href;
    renderIssues(lintManifest(data.json));
  } catch (err) {
    $('status').textContent = 'Lint failed: ' + err.message;
  } finally {
    btn.disabled = false;
  }
}

$('lint').addEventListener('click', runLint);
$('clear').addEventListener('click', () => {
  $('results').innerHTML = '';
  $('summary').classList.add('hidden');
  $('status').textContent = 'Click the button to check the current tab.';
});
