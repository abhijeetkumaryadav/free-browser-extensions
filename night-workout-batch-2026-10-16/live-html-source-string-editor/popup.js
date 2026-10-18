/* Live HTML Editor — popup logic.
   Grabs the tab's HTML source, lets the user edit it, applies the edited
   HTML to the live page copy (lost on reload), or downloads it. Local only. */
'use strict';

/* ---------- page-side helpers (run in the tab via scripting) ---------- */
function getPageHtml() {
  // Serialize the live document, including doctype.
  return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
}

function applyPageHtml(html) {
  // Replace the live page copy. Never touches the server.
  document.open();
  document.write(html);
  document.close();
  return document.title || 'page';
}

/* ---------- popup wiring ---------- */
const grabBtn = document.getElementById('grabBtn');
const applyBtn = document.getElementById('applyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const editor = document.getElementById('editor');
const srcInfo = document.getElementById('srcInfo');
const sizeInfo = document.getElementById('sizeInfo');
const statusEl = document.getElementById('status');

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? tab.id : null;
}

/* Grab the tab's current HTML source into the editor. */
grabBtn.addEventListener('click', async () => {
  setStatus('Grabbing page source…');
  try {
    const tabId = await activeTabId();
    if (!tabId) throw new Error('No active tab.');
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: getPageHtml
    });
    editor.value = result || '';
    const bytes = new Blob([editor.value]).size;
    srcInfo.textContent = 'Source loaded from this tab.';
    sizeInfo.textContent = fmtBytes(bytes);
    applyBtn.disabled = downloadBtn.disabled = !editor.value;
    setStatus('Loaded ' + fmtBytes(bytes) + ' of HTML. Edit, then Apply.', 'ok');
  } catch (err) {
    setStatus('Could not grab source: ' + err.message, 'err');
  }
});

/* Apply the edited HTML to the live page copy. */
applyBtn.addEventListener('click', async () => {
  if (!editor.value.trim()) { setStatus('Nothing to apply — the editor is empty.', 'err'); return; }
  setStatus('Applying to the live page copy…');
  try {
    const tabId = await activeTabId();
    if (!tabId) throw new Error('No active tab.');
    await chrome.scripting.executeScript({
      target: { tabId },
      func: applyPageHtml,
      args: [editor.value]
    });
    setStatus('Applied to this tab. Reload the page to revert.', 'ok');
  } catch (err) {
    setStatus('Apply failed: ' + err.message, 'err');
  }
});

/* Download the edited HTML as a file. */
downloadBtn.addEventListener('click', () => {
  if (!editor.value) { setStatus('Nothing to download.', 'err'); return; }
  const blob = new Blob([editor.value], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'edited-page.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus('Downloaded edited-page.html', 'ok');
});
