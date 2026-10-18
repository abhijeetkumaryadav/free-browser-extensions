// ============================================================================
// background.js — keeps recording session alive across popup closes and
// routes progress updates between the content script and the popup.
// No network. All state lives in chrome.storage.local.
// ============================================================================

const session = {
  tabId: null,
  name: '',
  events: [],
  recording: false,
};

// Relays progress from the content script to any open popup.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.kind === 'macro-progress' && sender.tab) {
    // Forward to popup views (if open) via broadcast to runtime ports.
    broadcast(msg);
  } else if (msg.kind === 'macro-replay-progress' || msg.kind === 'macro-replay-done') {
    broadcast(msg);
  }
  return false;
});

// Keep track of popup connections so we can push live counts.
const ports = new Set();
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'macro-popup') return;
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));
});

function broadcast(msg) {
  for (const p of ports) {
    try { p.postMessage(msg); } catch { ports.delete(p); }
  }
}

// Persist a finished macro.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.kind === 'macro-save') {
    saveMacro(msg.macro).then(() => broadcast({ kind: 'macro-saved' }));
  }
  return false;
});

async function saveMacro(macro) {
  const { macros = [] } = await chrome.storage.local.get('macros');
  macro.id = 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  macro.createdAt = Date.now();
  macros.push(macro);
  await chrome.storage.local.set({ macros });
}
