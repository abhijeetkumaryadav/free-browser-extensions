// ---------------------------------------------------------------------------
// popup.js — drives the SEO checklist UI.
// Injects content.js on explicit click only; scoring is local via analyzer.js.
// ---------------------------------------------------------------------------

'use strict';

const $ = (id) => document.getElementById(id);

const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const CROSS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/** Guard for pages where content scripts cannot run. */
function isInjectable(tab) {
  return tab && tab.url && /^(https?|file):/.test(tab.url);
}

function verdictFor(score) {
  if (score >= 80) return 'Strong on-page basics';
  if (score >= 60) return 'Decent — a few gaps';
  if (score >= 40) return 'Needs work';
  return 'Weak on-page SEO';
}

async function analyze() {
  const kw = $('kw').value.trim();
  if (!kw) {
    $('kw').focus();
    return;
  }
  $('analyze').disabled = true;

  const list = $('checks');
  list.innerHTML = '<li class="empty">Scanning page…</li>';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!isInjectable(tab)) {
      list.innerHTML = '<li class="empty">This page can’t be analyzed (internal browser page).</li>';
      $('analyze').disabled = false;
      return;
    }
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    const data = res && res.result;
    if (!data) throw new Error('no data');
    const { score, checks } = scoreSeo(data, kw);
    render(score, checks);
    chrome.storage.local.set({ lastKeyword: kw });
  } catch (e) {
    list.innerHTML = '<li class="empty">Couldn’t read this page. Try another tab.</li>';
  }
  $('analyze').disabled = false;
}

function render(score, checks) {
  $('scorebar').classList.remove('hidden');
  $('scoreNum').textContent = score;
  $('scoreFill').style.width = score + '%';
  const v = $('verdict');
  v.textContent = verdictFor(score);

  const list = $('checks');
  list.innerHTML = '';
  for (const c of checks) {
    const li = document.createElement('li');
    li.innerHTML =
      `<span class="badge ${c.pass ? 'pass' : 'fail'}">${c.pass ? CHECK_ICON : CROSS_ICON}</span>` +
      `<div class="check-body">` +
      `<div class="check-label"><span>${escapeHtml(c.label)}</span><span class="check-weight">${c.weight} pts</span></div>` +
      (c.detail ? `<div class="check-detail">${escapeHtml(c.detail)}</div>` : '') +
      (c.pass ? '' : `<div class="check-tip">Tip: ${escapeHtml(c.tip)}</div>`) +
      `</div>`;
    list.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

document.addEventListener('DOMContentLoaded', async () => {
  $('analyze').addEventListener('click', analyze);
  $('kw').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') analyze();
  });
  const { lastKeyword } = await chrome.storage.local.get('lastKeyword');
  if (lastKeyword) $('kw').value = lastKeyword;
});
