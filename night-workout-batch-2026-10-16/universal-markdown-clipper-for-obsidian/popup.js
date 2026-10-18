/* Universal Markdown Clipper — popup logic.
   Requests a clip from the content script, renders Obsidian-style Markdown
   (optional YAML frontmatter), and offers copy / .md download.
   This does NOT write into an Obsidian vault — it only copies or downloads. */
'use strict';

let lastMarkdown = '';

/** Build the final Markdown document from a clip + options. */
function renderMarkdown(clip, opts) {
  const lines = [];
  if (opts.yaml) {
    lines.push('---');
    lines.push(`title: "${clip.title.replace(/"/g, '\\"')}"`);
    lines.push(`source: ${clip.url}`);
    lines.push(`clipped: ${clip.clippedAt.slice(0, 10)}`);
    lines.push('---');
    lines.push('');
  }
  lines.push(`# ${clip.title}`);
  lines.push('');
  lines.push(`> Source: [${clip.url}](${clip.url})`);
  if (clip.description) {
    lines.push('');
    lines.push(`> ${clip.description}`);
  }
  lines.push('');
  lines.push(clip.body || '_(no content extracted)_');
  return lines.join('\n');
}

function setStatus(msg, success) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.classList.toggle('success', !!success);
}

/** Ask the active tab's content script for a clip. */
async function requestClip(opts) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) throw new Error('No active tab found.');
  if (!tab.url || !/^https?:/.test(tab.url)) {
    throw new Error('Clipping works on regular web pages (not chrome:// pages).');
  }

  // Ensure the content script is present, then ask it for the clip.
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const response = await chrome.tabs.sendMessage(tab.id, { type: 'clip-request', opts });
  if (!response || !response.ok) throw new Error(response?.error || 'Clip failed.');
  return response.clip;
}

async function onClip() {
  setStatus('Clipping…', false);
  const opts = {
    yaml: document.getElementById('optYaml').checked,
    images: document.getElementById('optImages').checked,
    selectionOnly: document.getElementById('optSelection').checked
  };
  // Persist preferences for next time.
  await chrome.storage.local.set({ umc_opts: opts });
  try {
    const clip = await requestClip(opts);
    lastMarkdown = renderMarkdown(clip, opts);
    document.getElementById('preview').textContent = lastMarkdown;
    document.getElementById('previewCard').hidden = false;
    const words = clip.body.split(/\s+/).filter(Boolean).length;
    setStatus(`Clipped from ${clip.source} — ${words} words.`, true);
  } catch (e) {
    setStatus('Error: ' + (e.message || e), false);
  }
}

function safeFilename(title) {
  return (title || 'clip')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .slice(0, 80) || 'clip';
}

document.addEventListener('DOMContentLoaded', async () => {
  // Restore preferences.
  const { umc_opts } = await chrome.storage.local.get('umc_opts');
  if (umc_opts) {
    document.getElementById('optYaml').checked = !!umc_opts.yaml;
    document.getElementById('optImages').checked = !!umc_opts.images;
    document.getElementById('optSelection').checked = !!umc_opts.selectionOnly;
  }

  document.getElementById('clipBtn').addEventListener('click', onClip);

  document.getElementById('copyBtn').addEventListener('click', async () => {
    if (!lastMarkdown) return;
    try {
      await navigator.clipboard.writeText(lastMarkdown);
      setStatus('Markdown copied to clipboard — paste it into Obsidian.', true);
    } catch (e) {
      setStatus('Copy failed: ' + e.message, false);
    }
  });

  document.getElementById('downloadBtn').addEventListener('click', () => {
    if (!lastMarkdown) return;
    const title = document.getElementById('preview').textContent.split('\n').find(l => l.startsWith('# '))?.slice(2) || 'clip';
    const blob = new Blob([lastMarkdown], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = safeFilename(title) + '.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus('Downloaded .md file — drop it into your vault.', true);
  });
});
