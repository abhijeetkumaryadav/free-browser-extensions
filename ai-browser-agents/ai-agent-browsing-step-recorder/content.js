/* StepLog — content script.
 * Only observes pages when the background confirms recording is active.
 * Listeners are passive; password field VALUES are never recorded.
 * Typing is logged on 'change' (field blur/commit), not per keystroke. */

'use strict';

let recording = false;

/* Ask background for current state, then stay in sync via broadcasts. */
chrome.runtime.sendMessage({ kind: 'stepLog:getState' })
  .then((r) => { recording = !!(r && r.recording); })
  .catch(() => { recording = false; });

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.kind === 'stepLog:state') recording = !!msg.recording;
});

/* Build a short, stable-ish selector/label for the clicked/filled element. */
function describe(el) {
  if (!el || el === document.body) return { selector: 'body', label: 'page body' };
  const tag = el.tagName.toLowerCase();
  let selector = tag;
  if (el.id) selector += '#' + el.id;
  else if (el.className && typeof el.className === 'string') {
    const cls = el.className.trim().split(/\s+/).slice(0, 2).join('.');
    if (cls) selector += '.' + cls;
  }
  let label = el.getAttribute('aria-label')
    || el.getAttribute('name')
    || el.getAttribute('placeholder')
    || el.getAttribute('title')
    || el.getAttribute('alt')
    || (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60)
    || selector;
  return { selector, label };
}

function isSensitive(el) {
  const type = (el.getAttribute('type') || '').toLowerCase();
  return type === 'password'
    || el.getAttribute('autocomplete') === 'cc-number'
    || /card|ccv|cvv|ssn|social/i.test(el.getAttribute('name') || '');
}

function send(type, el, extra) {
  if (!recording) return;
  const { selector, label } = describe(el);
  chrome.runtime.sendMessage({
    kind: 'stepLog:event',
    eventType: type,
    selector,
    label,
    ...extra,
  }).catch(() => {});
}

/* Clicks: capture phase so we log even if the page handles the event. */
document.addEventListener('click', (e) => {
  const el = e.target instanceof Element ? e.target : document.body;
  send('click', el);
}, true);

/* Form fills: log on change (commit), never per keystroke. */
document.addEventListener('change', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
  if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') {
    send('fill', el, { value: '[' + el.type + ' control]', isPassword: false });
    return;
  }
  send('fill', el, { value: el.value || '', isPassword: isSensitive(el) });
}, true);
