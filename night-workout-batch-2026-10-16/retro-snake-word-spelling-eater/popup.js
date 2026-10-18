/* Snake Word Eater — popup logic. Difficulty persists; game launches on explicit click. */
const $ = (id) => document.getElementById(id);

/** Load persisted difficulty and best score. */
function load() {
  chrome.storage.local.get({ snake_diff: 110, snake_best: 0 }, (r) => {
    $('difficulty').value = String(r.snake_diff);
    $('best').textContent = r.snake_best;
  });
}

function currentTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => cb(tabs[0]));
}

/** Send a control message to the running game (if any). */
function message(type) {
  currentTab((tab) => {
    if (tab && tab.id != null) chrome.tabs.sendMessage(tab.id, { type }, () => {});
  });
}

/** Inject the game — explicit user click only; refused on browser-internal pages. */
function start() {
  $('hint').textContent = '';
  const diff = Number($('difficulty').value);
  chrome.storage.local.set({ snake_diff: diff }, () => {
    currentTab((tab) => {
      if (!tab || !tab.url || /^(chrome|edge|about|chrome-extension):/.test(tab.url)) {
        $('hint').textContent = 'Cannot run on browser internal pages.';
        return;
      }
      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, files: ['content.js'] },
        () => {
          if (chrome.runtime.lastError) $('hint').textContent = chrome.runtime.lastError.message;
          else message('snake-restart'); // (re)start a fresh game even if already injected
        }
      );
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  $('difficulty').addEventListener('change', () =>
    chrome.storage.local.set({ snake_diff: Number($('difficulty').value) }));
  $('start').addEventListener('click', start);
  $('restart').addEventListener('click', () => message('snake-restart'));
  $('stop').addEventListener('click', () => message('snake-stop'));
  // Refresh the best score whenever the popup opens or storage changes.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.snake_best) $('best').textContent = changes.snake_best.newValue;
  });
});
