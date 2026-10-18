// Page Context Packager — popup logic.
// Injects the extractor into the active tab on demand, renders chunk
// navigation, copy, and download. Persists user settings locally.

'use strict';

// ---- state ---------------------------------------------------------------
const state = {
  chunks: [],        // string[]
  index: 0,          // current chunk
  title: '',
  markdown: '',
};

// ---- helpers -------------------------------------------------------------
const $ = (id) => document.getElementById(id);

function setStatus(msg) {
  $('status').textContent = msg;
  clearTimeout(setStatus._t);
  setStatus._t = setTimeout(() => { $('status').textContent = ''; }, 2500);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ---- extraction ----------------------------------------------------------
async function extractPage() {
  const tab = await getActiveTab();
  if (!tab?.id) { setStatus('No active tab found.'); return; }

  $('extractBtn').disabled = true;
  setStatus('Extracting…');

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    const maxChars = Math.max(1000, parseInt($('maxChars').value, 10) || 4000);
    const overlap = Math.max(0, parseInt($('overlap').value, 10) || 0);

    const [res] = await chrome.tabs.sendMessage(tab.id, {
      type: 'PCP_EXTRACT', maxChars, overlap,
    });

    if (!res?.ok) throw new Error('Extractor did not respond.');
    state.chunks = res.chunks;
    state.index = 0;
    state.title = res.title;
    state.markdown = res.markdown;

    $('stChars').textContent = res.chars.toLocaleString();
    $('stWords').textContent = res.words.toLocaleString();
    $('stChunks').textContent = res.chunks.length.toLocaleString();
    $('result').classList.remove('hidden');
    renderChunk();
    setStatus('Extracted. Paste chunks into your LLM chat.');
    await chrome.storage.local.set({
      pcpSettings: { maxChars, overlap },
    });
  } catch (err) {
    console.warn('[PCP] extract failed:', err);
    setStatus('Could not extract this page (try reloading it).');
  } finally {
    $('extractBtn').disabled = false;
  }
}

// ---- chunk navigation ----------------------------------------------------
function renderChunk() {
  const n = state.chunks.length;
  $('chunkLabel').textContent = n ? `Chunk ${state.index + 1} of ${n}` : 'No chunks';
  $('preview').textContent = n ? state.chunks[state.index] : '';
  $('prevChunk').disabled = state.index <= 0;
  $('nextChunk').disabled = state.index >= n - 1;
  $('prevChunk').style.opacity = state.index <= 0 ? 0.4 : 1;
  $('nextChunk').style.opacity = state.index >= n - 1 ? 0.4 : 1;
}

// ---- actions -------------------------------------------------------------
async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(`${label} copied to clipboard.`);
  } catch {
    setStatus('Clipboard blocked — select and copy manually.');
  }
}

function downloadMarkdown() {
  if (!state.markdown) return;
  const blob = new Blob([state.markdown], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const slug = (state.title || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  a.download = `${slug || 'page'}-context.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('Markdown file downloaded.');
}

// ---- init ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  // Restore user settings.
  const { pcpSettings } = await chrome.storage.local.get('pcpSettings');
  if (pcpSettings) {
    if (pcpSettings.maxChars) $('maxChars').value = pcpSettings.maxChars;
    if (pcpSettings.overlap != null) $('overlap').value = pcpSettings.overlap;
  }

  $('extractBtn').addEventListener('click', extractPage);
  $('prevChunk').addEventListener('click', () => {
    if (state.index > 0) { state.index--; renderChunk(); }
  });
  $('nextChunk').addEventListener('click', () => {
    if (state.index < state.chunks.length - 1) { state.index++; renderChunk(); }
  });
  $('copyChunk').addEventListener('click', () =>
    copyText(state.chunks[state.index] || '', 'Chunk'));
  $('copyAll').addEventListener('click', () =>
    copyText(state.markdown, 'Full text'));
  $('downloadMd').addEventListener('click', downloadMarkdown);
});
