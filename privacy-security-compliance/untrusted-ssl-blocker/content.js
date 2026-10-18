/* Untrusted SSL Blocker — content script.
 * Finds forms that collect passwords or payment details. Read-only. */
'use strict';

function scanForms() {
  const out = [];
  document.querySelectorAll('form').forEach((f, i) => {
    const hasPassword = !!f.querySelector('input[type="password"]');
    const hasPayment = !!f.querySelector(
      'input[name*="card" i], input[name*="ccnum" i], input[name*="cvc" i], ' +
      'input[name*="cvv" i], input[autocomplete*="cc-number" i], input[autocomplete*="cc-csc" i]'
    );
    if (hasPassword || hasPayment) {
      let action = '(submits to this page)';
      try { if (f.action) action = new URL(f.action, location.href).href; } catch (e) {}
      out.push({ index: i + 1, hasPassword, hasPayment, action });
    }
  });
  return out;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'usb-scan-forms') sendResponse({ forms: scanForms() });
  return true;
});
