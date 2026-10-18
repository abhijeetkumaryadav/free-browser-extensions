/* DOM Depth Analyzer — popup UI.
   Injects content.js on click (activeTab), receives depth stats,
   renders max depth, per-depth bar chart, and deepest elements. */

'use strict';

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showError(msg) {
  const e = $('error');
  e.textContent = msg;
  e.classList.remove('hidden');
  $('results').classList.add('hidden');
}

function render(data) {
  $('error').classList.add('hidden');
  $('results').classList.remove('hidden');

  const depths = Object.keys(data.perDepth).map(Number).sort((a, b) => a - b);
  const max = depths.length ? depths[depths.length - 1] : 0;

  $('maxDepth').textContent = max;
  $('totalNodes').textContent = data.total.toLocaleString();
  const deep15 = depths
    .filter((d) => d >= 15)
    .reduce((n, d) => n + data.perDepth[d], 0);
  $('deepCount').textContent = deep15.toLocaleString();

  // Bar chart: one bar per depth level.
  const chart = $('chart');
  chart.innerHTML = '';
  const counts = depths.map((d) => data.perDepth[d]);
  const peak = Math.max(...counts, 1);
  depths.forEach((d) => {
    const wrap = document.createElement('div');
    wrap.className = 'bar-wrap' + (d >= 15 ? ' hot' : '');
    wrap.title = `Depth ${d}: ${data.perDepth[d].toLocaleString()} nodes`;
    const h = Math.max(3, Math.round((data.perDepth[d] / peak) * 100));
    wrap.innerHTML =
      `<div class="bar" style="height:${h}%"></div>` +
      `<div class="bar-label">${d}</div>`;
    chart.appendChild(wrap);
  });

  // Deepest elements list.
  const list = $('deepest');
  list.innerHTML = '';
  if (!data.deepest.length) {
    list.innerHTML = '<div class="deep-item">No elements found.</div>';
    return;
  }
  data.deepest.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'deep-item';
    const cls = item.cls ? ` <span class="cls">.${escapeHtml(item.cls.split(' ').join('.'))}</span>` : '';
    div.innerHTML =
      `<span class="depth-badge">depth ${item.depth}</span>` +
      `<span class="tag">&lt;${escapeHtml(item.tag)}&gt;</span>${cls}` +
      `<span class="path">${escapeHtml(item.path)}</span>`;
    list.appendChild(div);
  });
}

async function scan() {
  const btn = $('scanBtn');
  btn.disabled = true;
  $('error').classList.add('hidden');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab found.');
    if (/^(chrome|chrome-extension|edge|about):/.test(tab.url || '')) {
      throw new Error('Cannot scan internal browser pages. Try a regular website.');
    }

    // Inject the analyzer (click-only, per activeTab).
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });

    const res = await chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_DEPTH' });
    if (!res || !res.ok) throw new Error((res && res.error) || 'Scan failed.');
    render(res.data);
  } catch (e) {
    showError('Scan failed: ' + (e && e.message ? e.message : String(e)));
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('scanBtn').addEventListener('click', scan);
});
