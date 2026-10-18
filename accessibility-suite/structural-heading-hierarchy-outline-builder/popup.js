'use strict';
/* Heading Outline popup logic — builds a navigable heading tree. */

const $ = (id) => document.getElementById(id);

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContent(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ho-ping' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  }
}

async function sendToTab(msg) {
  const tab = await activeTab();
  if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
    throw new Error('Open a regular web page first.');
  }
  await ensureContent(tab.id);
  return chrome.tabs.sendMessage(tab.id, msg);
}

/** Render the flat heading list as an indented tree. */
function renderOutline(headings) {
  const box = $('outline');
  const stats = $('stats');
  box.innerHTML = '';

  if (!headings.length) {
    stats.textContent = '';
    box.innerHTML = '<div class="empty">No headings (h1–h6) found on this page.</div>';
    return;
  }

  // Flag skipped levels: e.g. h1 followed by h3 skips h2.
  let prev = 0;
  let skips = 0;
  const flagged = headings.map((h) => {
    const skipped = prev > 0 && h.level > prev + 1;
    if (skipped) skips++;
    prev = h.level;
    return { ...h, skipped };
  });

  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const h of headings) counts[h.level]++;
  const summary = [1, 2, 3, 4, 5, 6]
    .filter((l) => counts[l] > 0)
    .map((l) => `h${l}×${counts[l]}`)
    .join(' · ');
  stats.innerHTML = `${headings.length} headings — ${summary}` +
    (skips ? ` — <span class="warn">${skips} skipped level${skips === 1 ? '' : 's'}</span>` : '');

  for (const h of flagged) {
    const btn = document.createElement('button');
    btn.className = 'node';
    btn.style.paddingLeft = `${8 + (h.level - 1) * 16}px`;
    btn.title = 'Click to scroll to this heading';

    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = `h${h.level}`;

    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = h.text || '(empty heading)';

    btn.append(tag, text);
    if (h.skipped) {
      const flag = document.createElement('span');
      flag.className = 'skip-flag';
      flag.textContent = 'SKIPPED';
      btn.appendChild(flag);
    }
    btn.addEventListener('click', async () => {
      try {
        await sendToTab({ type: 'ho-scroll', index: h.index });
        window.close();
      } catch (e) {
        stats.textContent = `Scroll failed: ${e.message}`;
      }
    });
    box.appendChild(btn);
  }
}

async function build() {
  $('outline').innerHTML = '<div class="empty">Reading headings…</div>';
  try {
    const res = await sendToTab({ type: 'ho-get' });
    renderOutline(res.headings || []);
  } catch (e) {
    $('outline').innerHTML = `<div class="empty">Failed: ${e.message}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('buildBtn').addEventListener('click', build);
  build(); // build immediately on open
});
