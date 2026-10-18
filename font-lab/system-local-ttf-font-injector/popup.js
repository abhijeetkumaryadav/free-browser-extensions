/* FontStack popup — applies curated system font stacks to the active tab.
   Injected functions must be fully self-contained (MV3 CSP forbids eval;
   chrome.scripting serializes the function only). */

'use strict';

const STACKS = [
  { group: 'Universal web-safe', items: [
    { name: 'Arial', stack: "Arial, 'Helvetica Neue', Helvetica, sans-serif" },
    { name: 'Georgia', stack: "Georgia, 'Times New Roman', serif" },
    { name: 'Verdana', stack: "Verdana, Geneva, sans-serif" },
    { name: 'Courier New', stack: "'Courier New', Courier, monospace" },
    { name: 'Times New Roman', stack: "'Times New Roman', Times, serif" },
    { name: 'Trebuchet MS', stack: "'Trebuchet MS', Verdana, sans-serif" },
    { name: 'Tahoma', stack: "Tahoma, Geneva, Verdana, sans-serif" },
  ]},
  { group: 'Windows', items: [
    { name: 'Segoe UI', stack: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
    { name: 'Calibri', stack: "Calibri, 'Segoe UI', sans-serif" },
    { name: 'Cambria', stack: "Cambria, Georgia, serif" },
    { name: 'Consolas', stack: "Consolas, 'Courier New', monospace" },
  ]},
  { group: 'macOS', items: [
    { name: 'San Francisco', stack: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif" },
    { name: 'Helvetica Neue', stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
    { name: 'Menlo', stack: "Menlo, Monaco, Consolas, monospace" },
    { name: 'Palatino', stack: "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif" },
  ]},
  { group: 'Linux', items: [
    { name: 'DejaVu Sans', stack: "'DejaVu Sans', Verdana, sans-serif" },
    { name: 'Liberation Serif', stack: "'Liberation Serif', 'Times New Roman', serif" },
    { name: 'Ubuntu', stack: "Ubuntu, 'DejaVu Sans', sans-serif" },
    { name: 'Noto Sans', stack: "'Noto Sans', 'DejaVu Sans', sans-serif" },
  ]},
];

const STYLE_ID = 'fontstack-injected-style';

/** Self-contained: injected into the page's MAIN world so it can reach page CSS. */
function applyStack(stackCss) {
  const id = 'fontstack-injected-style';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.documentElement.appendChild(el);
  }
  el.textContent =
    `html body, html body * { font-family: ${stackCss} !important; }` +
    `html body code, html body pre, html body kbd, html body samp, html body tt { font-family: inherit !important; }`;
}

/** Self-contained: removes the injected stylesheet entirely. */
function removeStack() {
  const el = document.getElementById('fontstack-injected-style');
  if (el) el.remove();
}

/** Self-contained: reports whether a stack is currently applied. */
function stackState() {
  return !!document.getElementById('fontstack-injected-style');
}

const $ = (id) => document.getElementById(id);

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function runOnTab(fn, args) {
  const tab = await getTab();
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: fn,
    args: args || [],
  });
}

function setStatus(active, label) {
  const box = $('status');
  box.classList.toggle('on', active);
  $('statusText').textContent = label;
  $('restore').disabled = !active;
}

function renderGroups(activeName) {
  const host = $('groups');
  host.textContent = '';
  STACKS.forEach(({ group, items }) => {
    const g = document.createElement('section');
    g.className = 'group';
    const title = document.createElement('div');
    title.className = 'group-title';
    title.textContent = group;
    g.appendChild(title);
    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.className = 'stack' + (item.name === activeName ? ' active' : '');
      const nameRow = document.createElement('div');
      nameRow.className = 'name';
      nameRow.appendChild(document.createTextNode(item.name));
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = item.name === activeName ? 'Applied' : 'System';
      nameRow.appendChild(badge);
      const preview = document.createElement('div');
      preview.className = 'preview';
      preview.style.fontFamily = item.stack;
      preview.textContent = 'AaBbCcDdEe 123!? — the quick brown fox';
      btn.appendChild(nameRow);
      btn.appendChild(preview);
      btn.addEventListener('click', () => apply(item));
      g.appendChild(btn);
    });
    host.appendChild(g);
  });
}

async function apply(item) {
  try {
    await runOnTab(applyStack, [item.stack]);
  } catch (err) {
    setStatus(false, 'Blocked page');
    return;
  }
  await chrome.storage.local.set({ lastApplied: item.name });
  renderGroups(item.name);
  setStatus(true, item.name);
}

async function restore() {
  await runOnTab(removeStack, []);
  await chrome.storage.local.remove('lastApplied');
  renderGroups(null);
  setStatus(false, 'Ready');
}

document.addEventListener('DOMContentLoaded', async () => {
  let activeName = null;
  try {
    const tab = await getTab();
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: stackState,
    });
    if (result) {
      const stored = await chrome.storage.local.get('lastApplied');
      activeName = stored.lastApplied || 'Applied';
    }
  } catch { /* restricted page — stay in ready state */ }
  renderGroups(activeName);
  setStatus(!!activeName, activeName || 'Ready');
  $('restore').addEventListener('click', restore);
});
