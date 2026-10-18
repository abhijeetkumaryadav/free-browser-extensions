/* Popup controller — persists settings, folds/unfolds only on explicit clicks. */
const $ = (id) => document.getElementById(id);

const defaults = { style: 'crane', depth: 75, delay: 25 };

async function loadSettings() {
  const s = await chrome.storage.local.get(defaults);
  document.querySelectorAll('#styleSeg button').forEach((b) =>
    b.classList.toggle('on', b.dataset.style === s.style));
  $('depth').value = s.depth;
  $('delay').value = s.delay;
}

async function save() {
  await chrome.storage.local.set({
    style: document.querySelector('#styleSeg button.on').dataset.style,
    depth: Number($('depth').value),
    delay: Number($('delay').value)
  });
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

$('styleSeg').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#styleSeg button').forEach((x) => x.classList.remove('on'));
  b.classList.add('on'); save();
});
$('depth').addEventListener('change', save);
$('delay').addEventListener('change', save);

$('fold').addEventListener('click', async () => {
  await save();
  const s = await chrome.storage.local.get(defaults);
  const tab = await activeTab();
  if (!tab?.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (cfg) => window.__origamiToy && window.__origamiToy.fold(cfg),
    args: [s]
  });
});

$('unfold').addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab?.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.__origamiToy && window.__origamiToy.unfold()
  });
});

loadSettings();
