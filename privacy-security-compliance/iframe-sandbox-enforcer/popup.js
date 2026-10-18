/* Iframe Sandbox Enforcer — popup logic.
 * Injected page functions are fully self-contained (no closures) so they can
 * be serialized into the tab via chrome.scripting.executeScript. */

/* ---------- Injected page helpers (must stay closure-free) ---------- */

function scanIframes() {
  const pageHost = location.hostname;
  return Array.from(document.querySelectorAll('iframe')).map((f, i) => {
    let host = '';
    try {
      host = new URL(f.src || '', location.href).hostname;
    } catch (e) { /* relative/empty src */ }
    return {
      index: i,
      src: f.src || '(no src attribute)',
      host: host,
      thirdParty: Boolean(host) && host !== pageHost,
      sandbox: f.getAttribute('sandbox') // null = not sandboxed, "" = strict
    };
  });
}

// sandboxValue: "" for strict, null to remove the sandbox attribute.
function setFrameSandbox(index, sandboxValue) {
  const frames = document.querySelectorAll('iframe');
  const f = frames[index];
  if (!f) return false;
  if (sandboxValue === null) {
    f.removeAttribute('sandbox');
  } else {
    f.setAttribute('sandbox', sandboxValue);
  }
  return true;
}

function sandboxThirdPartyFrames() {
  const pageHost = location.hostname;
  let count = 0;
  document.querySelectorAll('iframe').forEach((f) => {
    let host = '';
    try { host = new URL(f.src || '', location.href).hostname; } catch (e) {}
    if (host && host !== pageHost) {
      f.setAttribute('sandbox', '');
      count++;
    }
  });
  return count;
}

function removeThirdPartyFrames() {
  const pageHost = location.hostname;
  let count = 0;
  document.querySelectorAll('iframe').forEach((f) => {
    let host = '';
    try { host = new URL(f.src || '', location.href).hostname; } catch (e) {}
    if (host && host !== pageHost) {
      f.remove();
      count++;
    }
  });
  return count;
}

/* ---------- Popup UI ---------- */

const $ = (id) => document.getElementById(id);

let currentTabId = null;
let currentOrigin = '';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function injectable(tab) {
  return tab && tab.id != null && /^https?:/.test(tab.url || '');
}

async function runInPage(func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: currentTabId },
    func,
    args
  });
  return results && results[0] ? results[0].result : undefined;
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function renderFrames(frames) {
  const list = $('frameList');
  list.innerHTML = '';
  if (!frames || frames.length === 0) {
    list.innerHTML = '<p class="empty">No iframes found on this page.</p>';
    $('bulkRow').hidden = true;
    return;
  }
  $('bulkRow').hidden = false;
  frames.forEach((fr) => {
    const item = document.createElement('div');
    item.className = 'frame-item';

    const src = document.createElement('div');
    src.className = 'frame-src';
    src.textContent = truncate(fr.src, 90);
    item.appendChild(src);

    const badges = document.createElement('div');
    badges.className = 'badges';
    const party = document.createElement('span');
    party.className = 'badge' + (fr.thirdParty ? ' third' : '');
    party.textContent = fr.thirdParty ? 'third-party' : 'first-party';
    badges.appendChild(party);
    if (fr.sandbox !== null) {
      const sb = document.createElement('span');
      sb.className = 'badge sandboxed';
      sb.textContent = fr.sandbox === '' ? 'sandboxed (strict)' : 'sandboxed';
      badges.appendChild(sb);
    }
    item.appendChild(badges);

    const actions = document.createElement('div');
    actions.className = 'frame-actions';
    const btn = document.createElement('button');
    btn.className = 'btn small';
    if (fr.sandbox !== null) {
      btn.textContent = 'Remove sandbox';
      btn.addEventListener('click', async () => {
        await runInPage(setFrameSandbox, [fr.index, null]);
        refreshList();
      });
    } else {
      btn.textContent = 'Sandbox (strict)';
      btn.addEventListener('click', async () => {
        await runInPage(setFrameSandbox, [fr.index, '']);
        refreshList();
      });
    }
    actions.appendChild(btn);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

async function refreshList() {
  const tab = await getActiveTab();
  if (!injectable(tab)) {
    $('frameList').innerHTML =
      '<p class="empty">Open a regular web page to scan its iframes.</p>';
    $('bulkRow').hidden = true;
    return;
  }
  currentTabId = tab.id;
  const frames = await runInPage(scanIframes);
  renderFrames(frames);
}

async function loadPolicy() {
  const tab = await getActiveTab();
  if (tab && tab.url && /^https?:/.test(tab.url)) {
    currentTabId = tab.id;
    currentOrigin = new URL(tab.url).origin;
    $('originLabel').textContent = currentOrigin;
    const { policies = {} } = await chrome.storage.local.get('policies');
    $('modeSelect').value = policies[currentOrigin] || 'off';
  } else {
    $('originLabel').textContent = 'Not a web page';
    $('modeSelect').disabled = true;
    $('savePolicy').disabled = true;
  }
}

$('scanBtn').addEventListener('click', refreshList);

$('sandboxAllBtn').addEventListener('click', async () => {
  const frames = await runInPage(scanIframes);
  for (const fr of frames || []) {
    await runInPage(setFrameSandbox, [fr.index, '']);
  }
  refreshList();
});

$('blockThirdBtn').addEventListener('click', async () => {
  await runInPage(removeThirdPartyFrames);
  refreshList();
});

$('savePolicy').addEventListener('click', async () => {
  const mode = $('modeSelect').value;
  const status = $('policyStatus');
  try {
    if (mode !== 'off') {
      // Ask for optional host access scoped to this origin only, so the
      // background worker can enforce the policy automatically on load.
      const granted = await chrome.permissions.request({
        origins: [currentOrigin + '/*']
      });
      if (!granted) {
        status.textContent = 'Permission declined — policy not saved.';
        return;
      }
    }
    const { policies = {} } = await chrome.storage.local.get('policies');
    if (mode === 'off') {
      delete policies[currentOrigin];
      // Offer to drop the now-unneeded optional host permission.
      await chrome.permissions.remove({ origins: [currentOrigin + '/*'] }).catch(() => {});
    } else {
      policies[currentOrigin] = mode;
    }
    await chrome.storage.local.set({ policies });
    status.textContent = mode === 'off'
      ? 'Policy removed for this site.'
      : 'Policy saved for this site.';
  } catch (err) {
    status.textContent = 'Could not save policy: ' + err.message;
  }
});

// Init
loadPolicy();
refreshList();
