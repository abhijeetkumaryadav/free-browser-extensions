/* Popup controller — persists settings, injects/removes the overlay on explicit clicks. */
const $ = (id) => document.getElementById(id);

const defaults = { style: 'hub', speed: 4, nodes: 18 };

async function loadSettings() {
  const s = await chrome.storage.local.get(defaults);
  document.querySelectorAll('#styleSeg button').forEach((b) =>
    b.classList.toggle('on', b.dataset.style === s.style));
  $('speed').value = s.speed;
  $('nodes').value = s.nodes;
  return s;
}

async function save() {
  await chrome.storage.local.set({
    style: document.querySelector('#styleSeg button.on').dataset.style,
    speed: Number($('speed').value),
    nodes: Number($('nodes').value)
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
$('speed').addEventListener('change', save);
$('nodes').addEventListener('change', save);

$('show').addEventListener('click', async () => {
  await save();
  const s = await chrome.storage.local.get(defaults);
  const tab = await activeTab();
  if (!tab?.id) return;
  // inject the toy script file first (it guards against double injection),
  // then start the overlay with the saved settings
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (cfg) => window.__circuitToy && window.__circuitToy.show(cfg),
    args: [s]
  });
});

$('remove').addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab?.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.__circuitToy && window.__circuitToy.hide()
  });
});

loadSettings();
