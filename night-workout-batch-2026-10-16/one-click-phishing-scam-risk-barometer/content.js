/* PhishBarometer content script — runs ONLY when the user clicks "Scan this page"
 * (injected via chrome.scripting). Collects LOCAL heuristic phishing signals.
 * Never reads keystrokes, never captures input values, never transmits anything.
 * Returns an array of { id, severity: 'high'|'medium'|'low', title, detail }.
 */
(() => {
  const signals = [];
  const url = new URL(location.href);
  const host = url.hostname.toLowerCase();

  const add = (id, severity, title, detail) =>
    signals.push({ id, severity, title, detail });

  /* ---------- 1. Transport security ---------- */
  if (url.protocol === 'http:') {
    add('no-https', 'high',
      'Page is not served over HTTPS',
      'This page loads over plain HTTP. Any login or payment details entered here can be read in transit.');
  }

  /* ---------- 2. Raw IP address as host ---------- */
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^\[[0-9a-f:]+\]$/i.test(host)) {
    add('ip-host', 'high',
      'Site uses a raw IP address',
      'Legitimate sites almost always use a domain name. Phishing pages often hide behind bare IP addresses.');
  }

  /* ---------- 3. Punycode / non-ASCII domain (homoglyph risk) ---------- */
  if (host.includes('xn--') || /[^\x00-\x7F]/.test(host)) {
    add('punycode', 'high',
      'Domain uses encoded or special characters',
      'Punycode / non-ASCII characters can disguise lookalike letters, e.g. a Cyrillic "а" in "pаypal".');
  }

  /* ---------- 4. Brand impersonation heuristic ---------- */
  const BRANDS = {
    paypal: 'paypal.com', apple: 'apple.com', google: 'google.com',
    amazon: 'amazon.com', microsoft: 'microsoft.com', netflix: 'netflix.com',
    chase: 'chase.com', bankofamerica: 'bankofamerica.com',
    facebook: 'facebook.com', instagram: 'instagram.com', ebay: 'ebay.com',
    dhl: 'dhl.com', fedex: 'fedex.com', usps: 'usps.com', linkedin: 'linkedin.com'
  };
  for (const [brand, official] of Object.entries(BRANDS)) {
    if (host.includes(brand) && host !== official && !host.endsWith('.' + official)) {
      add('brand-' + brand, 'high',
        `Possible ${brand} impersonation`,
        `The address contains "${brand}" but is not the official ${official} domain. Scammers pad brand names with extra words (e.g. ${brand}-secure-login.com).`);
      break;
    }
  }

  /* ---------- 5. Deep subdomain chains ---------- */
  const parts = host.split('.');
  if (parts.length > 4) {
    add('subdomains', 'medium',
      'Unusually deep subdomain chain',
      `${parts.length} hostname parts. Phishing links often bury the real domain under layers of subdomains.`);
  }

  /* ---------- 6. Suspicious tokens in hostname ---------- */
  if (/(verify|verific|secure|login|signin|account|update|confirm|billing|webscr|supportdesk)/i.test(host)) {
    add('suspicious-tokens', 'medium',
      'Suspicious words in the address',
      'Words like "verify", "secure" or "login" inside the domain itself are a common phishing lure — the real site rarely needs them there.');
  }

  /* ---------- 7. Credential forms ---------- */
  const pwFields = document.querySelectorAll('input[type="password"]');
  if (pwFields.length > 0) {
    let risky = url.protocol !== 'https:';
    let crossOrigin = false;
    document.querySelectorAll('form').forEach((f) => {
      const action = f.getAttribute('action');
      if (!action) return;
      try {
        const a = new URL(action, location.href);
        if (a.protocol !== 'https:') risky = true;
        if (a.hostname.toLowerCase() !== host) crossOrigin = true;
      } catch (e) { /* relative/invalid action — ignore */ }
    });
    if (risky || crossOrigin) {
      add('risky-form', 'high',
        'Password form posts insecurely',
        'This page asks for a password but the form submits over HTTP or to a different domain. Do not enter credentials.');
    } else {
      add('pw-form', 'low',
        'Page asks for a password',
        'A login form is present. Double-check the address bar matches the site you intended before typing anything.');
    }
  }

  /* ---------- 8. Urgency / pressure language ---------- */
  const URGENCY = [
    /verify your account/i, /account (has been )?suspended/i, /\burgent\b/i,
    /act (now|immediately)/i, /expires? in \d+\s?(hours?|minutes?)/i,
    /unusual (activity|sign-?in)/i, /security alert/i,
    /click (here|below) to (verify|confirm)/i, /final (warning|notice)/i
  ];
  let hits = 0;
  try {
    const text = (document.body ? document.body.innerText : '').slice(0, 20000);
    for (const rx of URGENCY) if (rx.test(text)) hits++;
  } catch (e) { /* ignore */ }
  if (hits >= 2) {
    add('urgency', 'medium',
      'Pressure language detected',
      `${hits} urgency patterns found ("verify", "suspended", "act now"...). Scammers manufacture panic to stop you thinking.`);
  }

  /* ---------- 9. Link text vs destination mismatch ---------- */
  let mismatches = 0;
  const anchors = document.querySelectorAll('a[href^="http"]');
  const limit = Math.min(anchors.length, 60);
  for (let i = 0; i < limit; i++) {
    const a = anchors[i];
    const txt = (a.textContent || '').trim().toLowerCase();
    if (/[a-z0-9-]+\.[a-z]{2,}/.test(txt)) {
      try {
        const dest = new URL(a.href).hostname.toLowerCase().replace(/^www\./, '');
        const shown = txt.replace(/^www\./, '').split('/')[0];
        if (shown.includes('.') && !dest.endsWith(shown) && !shown.endsWith(dest)) mismatches++;
      } catch (e) { /* ignore */ }
    }
  }
  if (mismatches > 0) {
    add('link-mismatch', 'medium',
      'Links show one address, go to another',
      `${mismatches} link(s) display a different domain than their real destination. Hover links before clicking.`);
  }

  return signals;
})();
