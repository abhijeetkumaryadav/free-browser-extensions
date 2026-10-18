/* JavaScript Execution Toggler — popup logic.
 * Uses chrome.contentSettings.javascript (Chromium). The extension keeps its
 * own mirror of site rules in storage because the API cannot enumerate rules,
 * so the list can be displayed and individually removed. */

const $ = (id) => document.getElementById(id);
const jsSettings = () => (chrome.contentSettings && chrome.contentSettings.javascript) || null;

let currentOrigin = '';
let currentPattern = '';
let currentSetting = 'allow';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function usableTab(tab) {
  return tab && tab.url && /^https?:/.test(tab.url);
}

async function getRules() {
  const { rules = [] } = await chrome.storage.local.get('rules');
  return rules;
}

async function saveRules(rules) {
  await chrome.storage.local.set({ rules });
}

// Re-apply every stored rule after a full clear (clear() has no per-pattern form).
async function reapplyRules(rules) {
  const api = jsSettings();
  await api.clear({ scope: 'regular' });
  for (const r of rules) {
    await api.set({ primaryPattern: r.pattern, setting: r.setting, scope: 'regular' });
  }
}

async function refreshState() {
  const api = jsSettings();
  if (!api) {
    $('unsupportedNotice').hidden = false;
    $('toggleBtn').disabled = true;
    $('defaultSelect').disabled = true;
    $('resetAllBtn').disabled = true;
    return;
  }

  const tab = await getActiveTab();
  if (usableTab(tab)) {
    currentOrigin = new URL(tab.url).origin;
    currentPattern = currentOrigin + '/*';
    $('originLabel').textContent = currentOrigin;
    $('patternLabel').textContent = currentPattern;
    try {
      const res = await api.get({ primaryUrl: tab.url });
      currentSetting = res.setting || 'allow';
    } catch (e) {
      currentSetting = 'allow';
    }
    const dot = $('stateDot');
    const word = $('stateWord');
    dot.className = 'dot ' + (currentSetting === 'block' ? 'blocked' : 'allowed');
    word.textContent = currentSetting === 'block' ? 'blocked' : 'allowed';
    word.className = currentSetting === 'block' ? 'blocked' : 'allowed';
    $('toggleBtn').disabled = false;
    $('toggleBtn').textContent =
      currentSetting === 'block' ? 'Allow JavaScript here' : 'Block JavaScript here';
  } else {
    $('originLabel').textContent = 'Not a web page';
    $('stateWord').textContent = '—';
    $('toggleBtn').disabled = true;
  }

  // Global default: reflect the last value set from this popup.
  const { globalDefault = 'allow' } = await chrome.storage.local.get('globalDefault');
  $('defaultSelect').value = globalDefault;

  renderRules(await getRules());
}

function renderRules(rules) {
  const list = $('ruleList');
  list.innerHTML = '';
  $('ruleCount').textContent = rules.length ? `(${rules.length})` : '';
  if (rules.length === 0) {
    list.innerHTML = '<p class="empty">No site rules yet. Toggle JavaScript on any site to add one.</p>';
    return;
  }
  rules.forEach((r) => {
    const item = document.createElement('div');
    item.className = 'rule-item';

    const pattern = document.createElement('span');
    pattern.className = 'rule-pattern';
    pattern.textContent = r.pattern;
    item.appendChild(pattern);

    const meta = document.createElement('div');
    meta.className = 'rule-meta';
    const state = document.createElement('span');
    state.className = 'rule-state ' + (r.setting === 'block' ? 'blocked' : 'allowed');
    state.textContent = r.setting === 'block' ? 'blocked' : 'allowed';
    meta.appendChild(state);

    const del = document.createElement('button');
    del.className = 'btn small';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      const remaining = (await getRules()).filter((x) => x.pattern !== r.pattern);
      await reapplyRules(remaining);
      await saveRules(remaining);
      refreshState();
    });
    meta.appendChild(del);
    item.appendChild(meta);
    list.appendChild(item);
  });
}

$('toggleBtn').addEventListener('click', async () => {
  const api = jsSettings();
  if (!api || !currentPattern) return;
  const next = currentSetting === 'block' ? 'allow' : 'block';
  await api.set({ primaryPattern: currentPattern, setting: next, scope: 'regular' });

  const rules = await getRules();
  const idx = rules.findIndex((r) => r.pattern === currentPattern);
  const entry = { pattern: currentPattern, setting: next, updatedAt: Date.now() };
  if (idx >= 0) rules[idx] = entry;
  else rules.push(entry);
  await saveRules(rules);
  refreshState();
});

$('defaultSelect').addEventListener('change', async (e) => {
  const api = jsSettings();
  if (!api) return;
  const value = e.target.value;
  // '<all_urls>' as primaryPattern sets the default for sites without a rule.
  await api.set({ primaryPattern: '<all_urls>', setting: value, scope: 'regular' });
  await chrome.storage.local.set({ globalDefault: value });
});

$('resetAllBtn').addEventListener('click', async () => {
  const api = jsSettings();
  if (!api) return;
  await api.clear({ scope: 'regular' });
  await saveRules([]);
  await chrome.storage.local.set({ globalDefault: 'allow' });
  refreshState();
});

// Init
refreshState();
