// Local Tab Mesh — popup logic.
const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- Mesh roster -------------------------------------------------------------
async function refreshRoster() {
  const box = $('members');
  try {
    const res = await chrome.runtime.sendMessage({ __ltmRoster: true });
    const members = (res && res.members) || [];
    $('memberCount').textContent = `(${members.length})`;
    if (!members.length) {
      box.innerHTML = '<p class="empty">No tabs joined yet. Open tabs on a site and press <b>+ Join this tab</b>.</p>';
      return;
    }
    box.innerHTML = '';
    for (const m of members) {
      const div = document.createElement('div');
      div.className = 'member';
      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = m.title || m.url;
      title.title = m.url;
      const right = document.createElement('span');
      right.style.display = 'flex'; right.style.alignItems = 'center'; right.style.gap = '8px';
      const dot = document.createElement('span');
      dot.className = 'dot'; dot.title = 'joined';
      const sendBtn = document.createElement('button');
      sendBtn.className = 'btn btn-small';
      sendBtn.textContent = 'Send';
      sendBtn.addEventListener('click', () => sendMessage(m.tabId));
      right.append(dot, sendBtn);
      div.append(title, right);
      box.appendChild(div);
    }
  } catch (e) {
    box.innerHTML = '<p class="empty">Could not reach the background worker.</p>';
  }
}

// --- Join current tab ----------------------------------------------------------
$('joinTab').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    $('joinTab').textContent = '✓ Joined';
    setTimeout(() => { $('joinTab').textContent = '+ Join this tab'; }, 2000);
    setTimeout(refreshRoster, 600);
  } catch (e) {
    $('joinTab').textContent = 'Cannot join this tab';
    setTimeout(() => { $('joinTab').textContent = '+ Join this tab'; }, 2000);
  }
});

// --- Sending -------------------------------------------------------------------
async function sendMessage(onlyTabId) {
  const type = $('msgType').value;
  const body = $('msgBody').value.trim();
  if (!body) { $('msgBody').focus(); return; }
  const payload = { __ltm: true, type, body, at: Date.now() };

  // 1) BroadcastChannel — reaches every joined tab in this profile directly.
  try {
    new BroadcastChannel('local-tab-mesh').postMessage(payload);
  } catch (e) { /* ignore */ }

  // 2) Background relay — direct tab messaging (belt and braces).
  try {
    const res = await chrome.runtime.sendMessage({ __ltmSend: true, type, body });
    addInbox(`Broadcast sent · background relay reached ${res.delivered ?? 0} member(s).`);
  } catch (e) {
    addInbox('Broadcast sent via BroadcastChannel.');
  }
  $('msgBody').value = '';
}

$('sendAll').addEventListener('click', () => sendMessage(null));

// --- Inbox ---------------------------------------------------------------------
function addInbox(text) {
  const box = $('inbox');
  const empty = box.querySelector('.empty');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = 'inbox-item';
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = new Date().toLocaleTimeString();
  const pre = document.createElement('pre');
  pre.textContent = text;
  div.append(meta, pre);
  box.prepend(div);
}

// Receive via BroadcastChannel while the popup is open.
try {
  const bc = new BroadcastChannel('local-tab-mesh');
  bc.onmessage = (ev) => {
    if (ev.data && ev.data.__ltm === true) addInbox(`[${ev.data.type}] ${ev.data.body}`);
  };
} catch (e) { /* ignore */ }

$('openHelp').addEventListener('click', (e) => {
  e.preventDefault();
  alert('Local Tab Mesh lets tabs in the same browser join a mesh and exchange notes, snippets and URLs.\n\n' +
        '1. Open the tabs you want in the mesh.\n' +
        '2. Press "+ Join this tab" on each one.\n' +
        '3. Type a message and press "Send to all members".\n\n' +
        'Same browser profile only — not real P2P, no servers, no encryption. Messages are plain in-memory page toasts.');
});

refreshRoster();
// Refresh roster while open (tabs come and go).
setInterval(refreshRoster, 5000);
