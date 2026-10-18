/* Deepfake Heuristic Warner popup — runs the on-page scan and renders results.
 * Never produces a real/fake verdict; every finding is labeled informational. */
'use strict';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function lensUrl(u) { return 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(u); }
function tineyeUrl(u) { return 'https://tineye.com/search?url=' + encodeURIComponent(u); }

function mediaCard(kind, item) {
  const sigHtml = item.signals.length
    ? item.signals.map((s) => `<div class="signal">⚠ ${esc(s)}</div>`).join('')
    : `<div class="signal ok">No heuristic signals — this proves nothing either way.</div>`;
  const thumb = kind === 'Image' && /^https?:/i.test(item.src)
    ? `<img class="thumb" src="${esc(item.src)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="micon">${kind === 'Video' ? '🎬' : '🎙️'}</div>`;
  const rev = kind === 'Image' && /^https?:/i.test(item.src)
    ? `<div class="rev-links"><a href="${esc(lensUrl(item.src))}" target="_blank" rel="noopener">Google Lens ↗</a><a href="${esc(tineyeUrl(item.src))}" target="_blank" rel="noopener">TinEye ↗</a></div>`
    : '';
  const meta = [item.dims, item.dur].filter(Boolean).join(' · ');
  return `<div class="media-card">${thumb}
    <div class="media-info">
      <div class="media-kind">${kind}${meta ? ' · ' + esc(meta) : ''}</div>
      <div class="media-src">${esc(item.short)}</div>
      ${sigHtml}${rev}
    </div></div>`;
}

async function scan() {
  $('btn-scan').disabled = true;
  $('scan-msg').textContent = 'Scanning…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
      throw new Error('Open a regular web page (not chrome:// or the new-tab page) and try again.');
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__dfScan()
    });
    const data = res[0] && res[0].result;
    if (!data) throw new Error('Scan returned no data.');
    render(data);
    try {
      await chrome.storage.local.set({ dfwLastScan: { at: Date.now(), counts: {
        images: data.images.length, videos: data.videos.length, audios: data.audios.length } } });
    } catch (e) { /* history is best-effort */ }
  } catch (e) {
    $('scan-msg').textContent = 'Could not scan: ' + (e.message || e);
  }
  $('btn-scan').disabled = false;
}

function render(data) {
  const nMedia = data.images.length + data.videos.length + data.audios.length;
  const nSig = [...data.images, ...data.videos, ...data.audios]
    .reduce((a, m) => a + m.signals.length, 0);
  $('summary').innerHTML =
    `Scanned <b>${nMedia}</b> media item(s) — <b>${nSig}</b> heuristic signal(s), ` +
    `<b>informational only</b>. No verdict is given: signals can miss real fakes and flag innocent media.`;
  const list = $('media-list');
  list.innerHTML =
    data.images.map((m) => mediaCard('Image', m)).join('') +
    data.videos.map((m) => mediaCard('Video', m)).join('') +
    data.audios.map((m) => mediaCard('Audio', m)).join('') ||
    '<p class="hint">No media elements found on this page.</p>';
  $('results').hidden = false;
  $('scan-msg').textContent = 'Scan complete — review signals with the checklist below.';
}

document.addEventListener('DOMContentLoaded', () => {
  $('btn-scan').addEventListener('click', scan);
});
