/* KidTrack Shield — popup logic.
 * On-demand scan of the active tab; computes a 0–100 exposure score,
 * a kid-readable verdict, findings and tips. 100% local. */
/* global chrome */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const TIPS = [
    'Tip: a high score means lots of companies may be watching this page. Ask a grown-up before signing up!',
    'Tip: trackers follow you across websites to build a profile of what you like.',
    'Tip: using a private window does not hide you from trackers on the page itself.',
    'Tip: never type your real name, school, or address on a page with a high score.',
    'Tip: you can lower scores by using pages with fewer ads and pop-ups.'
  ];

  /** 0–100 score: higher = more exposure. Weights chosen for kid clarity. */
  function exposureScore(r) {
    let s = 0;
    s += Math.min(r.thirdPartyRequests, 60);          // up to 60 pts
    s += Math.min(r.trackerHosts.length * 8, 24);    // up to 24 pts
    s += Math.min(r.pixelCount * 4, 16);             // up to 16 pts
    return Math.max(0, Math.min(100, Math.round(s)));
  }

  function verdictFor(score) {
    if (score < 15)  return { label: '🟢 Super clean!',   sub: 'Hardly any trackers here. Nice page!' };
    if (score < 40)  return { label: '🟡 A few watchers',  sub: 'Some companies may see you here.' };
    if (score < 70)  return { label: '🟠 Lots of eyes',    sub: 'Many trackers are watching this page.' };
    return { label: '🔴 Tracker party!', sub: 'Tons of companies may be following you here. Be careful!' };
  }

  function renderFindings(r) {
    const list = $('findings');
    list.innerHTML = '';
    const items = [];
    for (const h of r.trackerHosts.slice(0, 6)) {
      items.push({ text: 'Known tracker domain', host: h });
    }
    for (const p of r.pixels.slice(0, 4)) {
      items.push({ text: `Possible tracking pixel — ${p.reason}`, host: p.host || '(page itself)' });
    }
    if (r.thirdPartyHosts > 0 && items.length === 0) {
      items.push({ text: 'Other companies loading things here', host: `${r.thirdPartyHosts} outside hosts` });
    }
    if (items.length === 0) {
      $('findingsCard').hidden = true;
      return;
    }
    $('findingsCard').hidden = false;
    for (const it of items) {
      const li = document.createElement('li');
      li.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>' +
        `<div><div>${escapeHtml(it.text)}</div><div class="host">${escapeHtml(it.host)}</div></div>`;
      list.appendChild(li);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function showResults(r) {
    const score = exposureScore(r);
    const v = verdictFor(score);
    $('scoreCard').hidden = false;
    $('statsCard').hidden = false;
    $('clearBtn').hidden = false;
    $('ring').style.setProperty('--p', score);
    $('scoreNum').textContent = score;
    $('verdict').childNodes[0].textContent = v.label;
    $('verdictSub').textContent = v.sub;
    $('statThird').textContent = r.thirdPartyRequests;
    $('statPixels').textContent = r.pixelCount;
    $('statHosts').textContent = r.trackerHosts.length;
    $('tipText').textContent = TIPS[score % TIPS.length];
    renderFindings(r);
    chrome.storage.local.set({ lastScan: { at: Date.now(), score, result: r } });
  }

  function clearResults() {
    $('scoreCard').hidden = true;
    $('statsCard').hidden = true;
    $('findingsCard').hidden = true;
    $('clearBtn').hidden = true;
    chrome.storage.local.remove('lastScan');
  }

  async function scan() {
    const btn = $('scanBtn');
    btn.disabled = true;
    btn.textContent = 'Scanning…';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error('No active tab found.');
      if (!/^https?:/.test(tab.url || '')) {
        throw new Error('This page cannot be scanned (try a normal website).');
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'kidtrack-scan' });
      if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'Scan failed.');
      showResults(resp.result);
    } catch (err) {
      const msg = String((err && err.message) || err);
      $('verdict').childNodes[0].textContent = '😕 Scan hiccup';
      $('verdictSub').textContent = msg;
      $('scoreCard').hidden = false;
      $('ring').style.setProperty('--p', 0);
      $('scoreNum').textContent = '?';
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 Scan this page';
    }
  }

  // Restore last scan (if any).
  chrome.storage.local.get('lastScan', ({ lastScan }) => {
    if (lastScan && lastScan.result) showResults(lastScan.result);
  });

  $('scanBtn').addEventListener('click', scan);
  $('clearBtn').addEventListener('click', clearResults);
})();
