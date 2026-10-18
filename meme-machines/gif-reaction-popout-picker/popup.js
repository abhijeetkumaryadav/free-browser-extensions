/* ReactPop popup logic.
 * 12 bundled original animated GIFs (assets/reactions/*.gif) + static PNGs for clipboard.
 * "Pop out" injects overlay.js into the active tab on an explicit user click.
 * "Copy" writes the static PNG to the clipboard via ClipboardItem.
 */
'use strict';

const REACTIONS = [
  'happy', 'sad', 'lol', 'facepalm',
  'wow', 'love', 'angry', 'cool',
  'sleepy', 'confused', 'party', 'shrug',
];

const grid = document.getElementById('grid');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const previewName = document.getElementById('previewName');
const popBtn = document.getElementById('popBtn');
const copyBtn = document.getElementById('copyBtn');
const toast = document.getElementById('toast');

let selected = null;
let toastTimer = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function gifUrl(name) {
  return chrome.runtime.getURL(`assets/reactions/${name}.gif`);
}

// Build the 4x3 picker grid.
REACTIONS.forEach((name) => {
  const cell = document.createElement('button');
  cell.className = 'cell';
  cell.type = 'button';
  cell.setAttribute('aria-label', `Reaction: ${name}`);

  const img = document.createElement('img');
  img.src = gifUrl(name);
  img.alt = name;
  img.draggable = false;

  const label = document.createElement('span');
  label.textContent = name;

  cell.append(img, label);
  cell.addEventListener('click', () => {
    document.querySelectorAll('.cell.selected').forEach((c) => c.classList.remove('selected'));
    cell.classList.add('selected');
    selected = name;
    previewImg.src = gifUrl(name);
    previewName.textContent = name;
    preview.hidden = false;
  });
  grid.appendChild(cell);
});

// Pop the selected reaction out as a draggable overlay on the current page.
popBtn.addEventListener('click', async () => {
  if (!selected) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('no-tab');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['overlay.js'],
    });
    await chrome.tabs.sendMessage(tab.id, { type: 'reactpop-show', gif: gifUrl(selected) });
    showToast(`Popped out “${selected}” — drag it anywhere, × to close.`);
  } catch (err) {
    showToast('Could not pop out on this page (restricted pages like chrome:// are off-limits).');
  }
});

// Copy the static PNG version to the clipboard.
copyBtn.addEventListener('click', async () => {
  if (!selected) return;
  try {
    const res = await fetch(chrome.runtime.getURL(`assets/reactions/${selected}.png`));
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    showToast(`Copied “${selected}” image to clipboard.`);
  } catch (err) {
    showToast('Copy failed in this browser — try “Pop out” instead.');
  }
});
