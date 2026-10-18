/* Context Chunker — prompt-text chunking engine + popup UI.
   Fully local: no network, no AI. Token counts are a 4-char heuristic. */

'use strict';

// ===================== ENGINE-START =====================
/**
 * Estimate tokens with the common 4-characters-per-token heuristic.
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

/**
 * Split text into chunks of at most `size` chars, with `overlap` chars
 * carried over between consecutive chunks. Unless allowMidWord is set,
 * chunks prefer to end on whitespace boundaries.
 *
 * @param {string} text
 * @param {number} size     max chars per chunk
 * @param {number} overlap  chars of overlap between chunks
 * @param {boolean} allowMidWord
 * @returns {Array<{index:number, text:string, chars:number, tokens:number}>}
 */
function chunkText(text, size, overlap, allowMidWord) {
  text = (text || '').trim();
  if (!text) return [];
  size = Math.max(50, Math.floor(size) || 1500);
  overlap = Math.max(0, Math.min(Math.floor(overlap) || 0, size - 1));

  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length && !allowMidWord) {
      // Prefer a word boundary: cut before the last whitespace in the window.
      const slice = text.slice(start, end);
      const lastWs = Math.max(
        slice.lastIndexOf(' '),
        slice.lastIndexOf('\n'),
        slice.lastIndexOf('\t')
      );
      if (lastWs > 0) {
        end = start + lastWs;
      }
      // else: no whitespace in window (one giant word) — hard split.
    }
    const piece = text.slice(start, end).trim();
    if (piece) {
      chunks.push({
        index: chunks.length + 1,
        text: piece,
        chars: piece.length,
        tokens: estimateTokens(piece),
      });
    }
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}
// ===================== ENGINE-END =====================

const $ = (id) => document.getElementById(id);

const copySvg =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderChunks(chunks) {
  const wrap = $('chunks');
  wrap.innerHTML = '';
  const totalTokens = chunks.reduce((n, c) => n + c.tokens, 0);

  const summary = $('summary');
  summary.classList.remove('hidden');
  summary.innerHTML =
    `<span><strong>${chunks.length}</strong> chunk${chunks.length === 1 ? '' : 's'}</span>` +
    `<span>≈ <strong>${totalTokens.toLocaleString()}</strong> tokens total</span>`;

  chunks.forEach((c) => {
    const div = document.createElement('div');
    div.className = 'chunk';
    div.innerHTML =
      `<div class="chunk-head"><span class="title">Chunk ${c.index}</span>` +
      `<span class="meta">${c.chars.toLocaleString()} chars · ≈${c.tokens.toLocaleString()} tokens</span></div>` +
      `<div class="chunk-preview">${escapeHtml(c.text.slice(0, 220))}${c.text.length > 220 ? '…' : ''}</div>` +
      `<button class="copy-btn" type="button">${copySvg}<span>Copy chunk</span></button>`;
    const btn = div.querySelector('.copy-btn');
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(c.text);
        btn.classList.add('done');
        btn.querySelector('span').textContent = 'Copied';
        setTimeout(() => {
          btn.classList.remove('done');
          btn.querySelector('span').textContent = 'Copy chunk';
        }, 1200);
      } catch (e) {
        btn.querySelector('span').textContent = 'Copy failed';
      }
    });
    wrap.appendChild(div);
  });
}

function syncLabels() {
  $('chunkSizeVal').textContent = Number($('chunkSize').value).toLocaleString();
  $('overlapVal').textContent = Number($('overlap').value).toLocaleString();
}

function saveSettings() {
  chrome.storage.local.set({
    chunker: {
      size: Number($('chunkSize').value),
      overlap: Number($('overlap').value),
      allowMidWord: $('breakWords').checked,
    },
  });
}

async function init() {
  syncLabels();
  $('chunkSize').addEventListener('input', () => {
    if (Number($('overlap').value) >= Number($('chunkSize').value)) {
      $('overlap').value = Number($('chunkSize').value) - 100;
    }
    syncLabels();
    saveSettings();
  });
  $('overlap').addEventListener('input', () => { syncLabels(); saveSettings(); });
  $('breakWords').addEventListener('change', saveSettings);

  try {
    const data = await chrome.storage.local.get('chunker');
    if (data.chunker) {
      $('chunkSize').value = data.chunker.size;
      $('overlap').value = data.chunker.overlap;
      $('breakWords').checked = !!data.chunker.allowMidWord;
      syncLabels();
    }
  } catch (e) { /* defaults are fine */ }

  $('chunkBtn').addEventListener('click', () => {
    const chunks = chunkText(
      $('input').value,
      Number($('chunkSize').value),
      Number($('overlap').value),
      $('breakWords').checked
    );
    if (chunks.length === 0) {
      $('summary').classList.remove('hidden');
      $('summary').innerHTML = '<span>Nothing to chunk — paste some text first.</span>';
      $('chunks').innerHTML = '';
      return;
    }
    renderChunks(chunks);
  });
}

document.addEventListener('DOMContentLoaded', init);
