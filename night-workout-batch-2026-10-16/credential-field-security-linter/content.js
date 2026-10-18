/* CredLint content script — READ-ONLY audit of credential-related form fields.
 * It inspects page STRUCTURE (attributes, form config) and never reads, stores,
 * or transmits anything typed into fields. Injected on demand via chrome.scripting. */
(() => {
  'use strict';

  // Short, stable description of an element for the report (no values ever included)
  function describe(el) {
    const parts = [el.tagName.toLowerCase()];
    if (el.id) parts.push('#' + el.id.slice(0, 40));
    if (el.name) parts.push('[name="' + String(el.name).slice(0, 40) + '"]');
    const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/)[0] : '';
    if (cls) parts.push('.' + cls.slice(0, 30));
    if (el.getAttribute('type')) parts.push('[type="' + el.getAttribute('type') + '"]');
    return parts.join('');
  }

  function issue(severity, title, detail, el) {
    return { severity, title, detail, target: el ? describe(el) : 'page' };
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (!r || (r.width === 0 && r.height === 0)) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  }

  function runAudit() {
    const issues = [];
    const url = location.href;
    const isHttps = url.startsWith('https://');

    // --- Page-level: insecure transport ------------------------------------
    if (!isHttps && !url.startsWith('about:') && !url.startsWith('chrome')) {
      issues.push(issue(
        'error',
        'Login form served over plain HTTP',
        'Credentials typed on this page would travel over an unencrypted connection and can be intercepted on the network. The site should serve login pages over HTTPS.',
        null
      ));
    }

    // --- Collect candidate fields ------------------------------------------
    const inputs = Array.from(document.querySelectorAll('input, textarea'));
    const pwFields = inputs.filter(el => (el.getAttribute('type') || '').toLowerCase() === 'password' && !el.disabled && isVisible(el));
    const textish = inputs.filter(el => {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'email', 'tel', ''].includes(t) && !el.disabled && isVisible(el);
    });

    // Likely username/email login fields (name/id/placeholder/autocomplete hints)
    const loginish = textish.filter(el => {
      const hay = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '') + ' ' + (el.getAttribute('autocomplete') || '')).toLowerCase();
      return /user|login|email|account|uname/.test(hay);
    });

    if (pwFields.length === 0 && loginish.length === 0) {
      return { issues, summary: 'No credential fields detected on this page.' };
    }

    // --- Password field checks ---------------------------------------------
    pwFields.forEach(el => {
      const ac = el.getAttribute('autocomplete');

      if (!ac) {
        issues.push(issue(
          'warning',
          'Password field missing autocomplete attribute',
          'Add autocomplete="current-password" (login) or autocomplete="new-password" (sign-up/change) so password managers can offer to fill or generate credentials securely.',
          el
        ));
      } else if (!/^(current-password|new-password)$/i.test(ac.trim())) {
        issues.push(issue(
          'notice',
          'Unusual autocomplete value on password field',
          `autocomplete="${ac}" is not one of the standard password tokens (current-password / new-password). Non-standard values may confuse password managers.`,
          el
        ));
      }

      const form = el.form;
      if (!form) {
        issues.push(issue(
          'warning',
          'Password field is not inside a <form>',
          'A password input outside a form element can break password-manager detection and standard submit behavior.',
          el
        ));
      } else {
        const method = (form.getAttribute('method') || 'get').toLowerCase();
        if (method === 'get') {
          issues.push(issue(
            'error',
            'Login form submits with GET',
            'A GET submission puts credentials in the URL — they end up in history, server logs, and referrers. Use method="post".',
            form
          ));
        }
        const action = form.getAttribute('action');
        if (action && /^(http:)?\/\//i.test(action) && !action.toLowerCase().startsWith('https://')) {
          issues.push(issue(
            'error',
            'Form posts credentials to a non-HTTPS URL',
            'The form action uses plain HTTP, so credentials would be sent unencrypted. Post to an https:// endpoint.',
            form
          ));
        }
        if (form.getAttribute('autocomplete') === 'off') {
          issues.push(issue(
            'warning',
            'autocomplete="off" on the login form',
            'This is mostly ignored by browsers and blocks password managers from helping users create and store strong, unique passwords.',
            form
          ));
        }
      }

      if (el.getAttribute('autocomplete') === 'off') {
        issues.push(issue(
          'warning',
          'autocomplete="off" on password field',
          'Blocks password managers. Prefer autocomplete="current-password" or "new-password".',
          el
        ));
      }

      const maxLen = el.getAttribute('maxlength');
      if (maxLen && parseInt(maxLen, 10) < 16) {
        issues.push(issue(
          'warning',
          'Very short maxlength on password field',
          `maxlength="${maxLen}" prevents passphrases and password-manager-generated passwords. Allow at least 64+ characters.`,
          el
        ));
      }

      if (el.readOnly) {
        issues.push(issue(
          'notice',
          'Password field is read-only',
          'A read-only password input is unusual; verify it is intentional and not a broken login flow.',
          el
        ));
      }
    });

    // --- Plain-text inputs used where a password is expected ----------------
    textish.forEach(el => {
      const hay = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '')).toLowerCase();
      if (/pass(word|phrase)?|pwd|secret/.test(hay) && (el.getAttribute('type') || 'text').toLowerCase() !== 'password') {
        issues.push(issue(
          'error',
          'Credential entered in a plain-text field',
          'This field looks like it collects a password but is not type="password", so entries are visible on screen and to shoulder-surfers.',
          el
        ));
      }
    });

    // --- Username / login identifier checks ---------------------------------
    loginish.forEach(el => {
      const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
      if (!ac) {
        issues.push(issue(
          'notice',
          'Login identifier missing autocomplete',
          'Add autocomplete="username" (or "email") so password managers can pair this field with the password field.',
          el
        ));
      }
      if (ac === 'off') {
        issues.push(issue(
          'warning',
          'autocomplete="off" on login identifier',
          'Prevents password-manager autofill. Use autocomplete="username" instead.',
          el
        ));
      }
    });

    // --- Duplicate field names (heuristic) -----------------------------------
    const names = {};
    pwFields.forEach(el => {
      const n = (el.name || '').trim();
      if (n) { names[n] = (names[n] || 0) + 1; }
    });
    Object.entries(names).forEach(([n, count]) => {
      if (count > 1) {
        issues.push(issue(
          'notice',
          'Duplicate password field names',
          `Multiple password inputs share name="${n}", which can confuse form handling and password managers.`,
          null
        ));
      }
    });

    const counts = {
      error: issues.filter(i => i.severity === 'error').length,
      warning: issues.filter(i => i.severity === 'warning').length,
      notice: issues.filter(i => i.severity === 'notice').length
    };
    return { issues, counts, summary: `${pwFields.length} password field(s), ${loginish.length} login identifier(s) found.` };
  }

  // Single entry point the popup calls via chrome.scripting
  window.__credLintAudit = runAudit;
})();
