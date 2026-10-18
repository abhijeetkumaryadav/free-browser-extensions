/* PagePack popup — saves the active tab as .mhtml (pageCapture) or as a
   cleaned single .html (MAIN-world serializer with images inlined). */
'use strict';

const filenameInput = document.getElementById('filename');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');
const warningsEl = document.getElementById('warnings');
const imgRow = document.getElementById('imgRow');
const includeImagesEl = document.getElementById('includeImages');
const formatRadios = document.querySelectorAll('input[name="format"]');

document.addEventListener('DOMContentLoaded', init);
saveBtn.addEventListener('click', save);
formatRadios.forEach((r) => r.addEventListener('change', syncFormatUI));

function init() {
  syncFormatUI();
  // Remember last-used preferences on this device only.
  chrome.storage.local.get({ ppFormat: 'mhtml', ppImages: true }, (prefs) => {
    document.querySelector(`input[name="format"][value="${prefs.ppFormat}"]`).checked = true;
    includeImagesEl.checked = !!prefs.ppImages;
    syncFormatUI();
  });
}

function syncFormatUI() {
  const format = currentFormat();
  imgRow.classList.toggle('disabled', format !== 'html');
}

function currentFormat() {
  const checked = document.querySelector('input[name="format"]:checked');
  return checked ? checked.value : 'mhtml';
}

function setStatus(msg, kind) {
  statusEl.hidden = false;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
  statusEl.textContent = msg;
}

function showWarnings(list) {
  warningsEl.hidden = !list.length;
  warningsEl.innerHTML = '';
  list.forEach((w) => {
    const li = document.createElement('li');
    li.textContent = w;
    warningsEl.append(li);
  });
}

function slugify(name) {
  const clean = (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return clean || 'page';
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) throw new Error('No active tab found.');
  if (/^(chrome|chrome-extension|edge|about):/.test(tab.url || '')) {
    throw new Error('Saving is not allowed on browser internal pages.');
  }
  return tab;
}

async function save() {
  saveBtn.disabled = true;
  setStatus('Working…');
  showWarnings([]);
  try {
    const tab = await activeTab();
    const format = currentFormat();
    const filename = slugify(filenameInput.value || tab.title) + '.' + format;

    chrome.storage.local.set({
      ppFormat: format,
      ppImages: includeImagesEl.checked,
    });

    if (format === 'mhtml') {
      await saveMhtml(tab, filename);
    } else {
      await saveHtml(tab, filename, includeImagesEl.checked);
    }
    setStatus('Saved: ' + filename, 'ok');
  } catch (e) {
    setStatus('Failed: ' + shortErr(e), 'error');
  } finally {
    saveBtn.disabled = false;
  }
}

async function saveMhtml(tab, filename) {
  // Browser-native snapshot: most faithful single-file capture.
  const blob = await chrome.pageCapture.saveAsMHTML({ tabId: tab.id });
  await downloadBlob(blob, filename, 'multipart/related');
}

async function saveHtml(tab, filename, includeImages) {
  // Pass the flag across worlds via a DOM attribute (shared between
  // the isolated world and the page MAIN world).
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'ISOLATED',
    func: (flag) => document.documentElement.setAttribute('data-pp-images', flag ? '1' : '0'),
    args: [includeImages],
  });
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN', // MAIN world: can fetch same-origin resources
    files: ['serializer.js'],
  });
  const result = injection && injection.result;
  if (!result || !result.html) throw new Error('Serializer returned no content.');
  showWarnings(result.warnings || []);
  await downloadBlob(new Blob([result.html], { type: 'text/html' }), filename, 'text/html');
}

function downloadBlob(blob, filename, mimeType) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename, saveAs: false, mime: mimeType }, (id) => {
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(id);
    });
  });
}

function shortErr(e) {
  const msg = (e && e.message) || String(e);
  return msg.length > 110 ? msg.slice(0, 110) + '…' : msg;
}
