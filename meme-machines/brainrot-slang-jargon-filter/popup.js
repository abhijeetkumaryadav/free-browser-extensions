/* Brainrot Slang Filter — popup logic.
 * The actual page rewriting happens in `translatePage` / `restorePage`,
 * which are serialized and injected into the active tab via chrome.scripting.
 * They are fully self-contained: no closure references, all data via args.
 * Runs only on an explicit user click. Form fields are never touched.
 */

'use strict';

/* ------------------------------------------------------------------ */
/* Bundled dictionary: formal word -> silly slang (light, inoffensive). */
/* Passed into the page as a JSON-serializable executeScript argument. */
/* ------------------------------------------------------------------ */
const DICT = {
  good: 'bussin', great: 'fire', excellent: 'fire', amazing: 'goated',
  awesome: 'goated', wonderful: 'goated', fantastic: 'fire',
  bad: 'mid', boring: 'mid', terrible: 'mid', awful: 'mid',
  cool: 'drippy', nice: 'drippy', beautiful: 'snatched', pretty: 'snatched',
  friend: 'bestie', friends: 'besties', buddy: 'bestie',
  money: 'bag', cash: 'bag', rich: 'loaded', expensive: 'spendy',
  yes: 'yessir', yeah: 'yessir', no: 'nah', nope: 'nah',
  hello: 'yo', hi: 'yo', goodbye: 'peace out', bye: 'peace out',
  eat: 'munch', eating: 'munching', food: 'grub', meal: 'grub',
  delicious: 'bussin', tasty: 'bussin',
  sleep: 'crash', sleeping: 'crashing', tired: 'beat', exhausted: 'beat',
  happy: 'vibing', excited: 'hyped', fun: 'a vibe', funny: 'hilarious',
  laugh: 'cackle', laughing: 'cackling',
  sad: 'down bad', angry: 'pressed', annoyed: 'pressed',
  smart: 'big brain', genius: 'big brain', silly: 'goofy', weird: 'sus',
  fast: 'zooming', slow: 'glacial', quick: 'speedy',
  big: 'chonky', large: 'chonky', huge: 'mega chonky',
  small: 'smol', tiny: 'smol', little: 'smol',
  love: 'stan', like: 'vibe with', win: 'dub', winning: 'dubbing',
  lose: 'take the L', losing: 'taking the L',
  team: 'squad', group: 'squad', party: 'shindig',
  house: 'crib', home: 'crib', car: 'whip',
  dog: 'pupper', cat: 'kitty', baby: 'smol bean',
  work: 'grind', working: 'grinding', job: 'grind',
  very: 'hella', really: 'lowkey', actually: 'no cap', literally: 'lowkey',
  crazy: 'unhinged', insane: 'unhinged', perfect: 'immaculate',
};

/* ------------------------------------------------------------------ */
/* Injected page functions (must stay self-contained!)                 */
/* ------------------------------------------------------------------ */

/**
 * Rewrite page text using the dictionary. Runs inside the page.
 * Restores any previous run first so repeated clicks never compound.
 * @returns {{replaced:number, nodes:number}} stats
 */
function translatePage(dict, intensity) {
  // Restore any previous run first so repeated clicks never compound.
  // (Inlined here because this function is serialized into the page alone.)
  (window.__brfOriginals || []).forEach(([node, text]) => {
    if (node && node.isConnected) node.nodeValue = text;
  });

  const originals = []; // [textNode, originalText]
  let replaced = 0;
  let touchedNodes = 0;

  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'OPTION', 'SELECT']);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let n;
  while ((n = walker.nextNode())) {
    const parent = n.parentElement;
    if (!parent) continue;
    if (SKIP.has(parent.tagName)) continue;
    if (parent.isContentEditable) continue;
    if (parent.closest('input, textarea, select, [contenteditable="true"]')) continue;
    if (!/[a-zA-Z]/.test(n.nodeValue)) continue;
    textNodes.push(n);
  }

  const keys = Object.keys(dict);

  textNodes.forEach(node => {
    const original = node.nodeValue;
    let count = 0;
    const next = original.replace(/\b[a-zA-Z']+\b/g, word => {
      const hit = dict[word.toLowerCase()];
      if (!hit) return word;
      if (Math.random() * 100 >= intensity) return word;
      count++;
      // Preserve capitalization style of the original word.
      if (word === word.toUpperCase() && word.length > 1) return hit.toUpperCase();
      if (word[0] === word[0].toUpperCase()) {
        return hit.charAt(0).toUpperCase() + hit.slice(1);
      }
      return hit;
    });
    if (count > 0) {
      originals.push([node, original]);
      node.nodeValue = next;
      replaced += count;
      touchedNodes++;
    }
  });

  window.__brfOriginals = originals;
  return { replaced, nodes: touchedNodes };
}

/** Restore text saved by translatePage. Runs inside the page. */
function restorePage() {
  const originals = window.__brfOriginals || [];
  let count = 0;
  originals.forEach(([node, text]) => {
    if (node && node.isConnected) {
      node.nodeValue = text;
      count++;
    }
  });
  window.__brfOriginals = [];
  return { restored: count };
}

/* ------------------------------------------------------------------ */
/* Popup UI                                                            */
/* ------------------------------------------------------------------ */

const statusEl = () => document.getElementById('status');

function setStatus(html) {
  statusEl().innerHTML = html;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function runOnPage(func, args) {
  const tab = await activeTab();
  if (!tab || !tab.id) throw new Error('no-tab');
  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func,
    args,
  });
  return res ? res.result : null;
}

async function initIntensity() {
  const { brfIntensity = 60 } = await chrome.storage.local.get('brfIntensity');
  const slider = document.getElementById('intensity');
  const label = document.getElementById('intVal');
  slider.value = brfIntensity;
  label.textContent = brfIntensity + '%';
  slider.addEventListener('input', async () => {
    label.textContent = slider.value + '%';
    await chrome.storage.local.set({ brfIntensity: Number(slider.value) });
  });
}

function bindButtons() {
  const translateBtn = document.getElementById('translateBtn');
  const restoreBtn = document.getElementById('restoreBtn');

  translateBtn.addEventListener('click', async () => {
    const intensity = Number(document.getElementById('intensity').value);
    translateBtn.disabled = true;
    try {
      const stats = await runOnPage(translatePage, [DICT, intensity]);
      if (!stats || stats.replaced === 0) {
        setStatus('No swappable words found on this page. Try a wordier page.');
      } else {
        setStatus(`Swapped <strong>${stats.replaced}</strong> words across <strong>${stats.nodes}</strong> text blocks. Behold.`);
      }
    } catch (err) {
      setStatus('Could not rewrite this page (browser-restricted pages like chrome:// are off-limits).');
    }
    translateBtn.disabled = false;
  });

  restoreBtn.addEventListener('click', async () => {
    try {
      const { restored } = (await runOnPage(restorePage, [])) || { restored: 0 };
      setStatus(restored > 0
        ? `Restored <strong>${restored}</strong> text blocks to normal. Dignity: recovered.`
        : 'Nothing to restore — the page was already normal.');
    } catch (err) {
      setStatus('Could not reach this page (browser-restricted pages are off-limits).');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initIntensity();
  bindButtons();
});
