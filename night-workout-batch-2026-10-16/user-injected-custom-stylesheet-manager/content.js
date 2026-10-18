/* StyleForge content script — receives CSS text and injects/removes a <style> node.
   Runs only on sites the user configured. */
const STYLE_ID = 'styleforge-user-css';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'styleforge:apply') {
    document.getElementById(STYLE_ID)?.remove();
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = msg.css || '';
    document.documentElement.appendChild(el);
    sendResponse({ ok: true });
  }
  if (msg.type === 'styleforge:remove') {
    document.getElementById(STYLE_ID)?.remove();
    sendResponse({ ok: true });
  }
  return false;
});
