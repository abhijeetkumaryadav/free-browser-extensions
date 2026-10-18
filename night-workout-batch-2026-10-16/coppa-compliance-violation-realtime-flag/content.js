/* COPPA Red Flag — on-demand page scanner.
   Injected via chrome.scripting ONLY when the user clicks "Scan this page".
   Pure heuristic pattern matching, 100% local. The final expression is the
   scan payload returned to the popup. NOT a legal compliance determination. */

(() => {
  'use strict';

  const findings = [];

  /** Record one finding. Severity: 'error' | 'warning' | 'notice'. */
  function add(severity, check, title, detail, snippet) {
    findings.push({ severity, check, title, detail, snippet: snippet || '' });
  }

  const host = location.hostname || '';

  /** Short, safe human description of an element for the report. */
  function describe(el) {
    if (!el || !el.tagName) return '';
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    let cls = '';
    if (typeof el.className === 'string' && el.className.trim()) {
      cls = '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    const label = (el.getAttribute('aria-label') || el.getAttribute('name') ||
      el.getAttribute('placeholder') || '').trim();
    return `<${tag}${id}${cls}>${label ? ` "${label.slice(0, 40)}"` : ''}`;
  }

  const pageText = document.body ? document.body.innerText.slice(0, 20000) : '';
  const consentMention = /parental consent|parent'?s (permission|consent)|verifiable parental|guardian consent|consent of (a|the) parent/i.test(pageText);
  const titleMeta = ((document.title || '') + ' ' +
    ((document.querySelector('meta[name="description"]') || {}).content || '')).slice(0, 2000);
  const kidSignal = /kid|child|children|toddler|preschool|kindergarten|elementary|toy/i.test(titleMeta);

  /* ---------- Check 1: age / birthdate collection ---------- */
  const AGE_RE = /dob|date.?of.?birth|birth.?date|birth.?day|\bage\b|age.?verif|how.?old/i;
  const ageControls = new Set();
  document.querySelectorAll('input, select, textarea').forEach((el) => {
    const hay = [el.name || '', el.id || '', el.placeholder || '',
      el.getAttribute('aria-label') || '', el.type || ''].join(' ');
    if (AGE_RE.test(hay)) ageControls.add(el);
  });
  document.querySelectorAll('label').forEach((lb) => {
    if (AGE_RE.test(lb.textContent || '')) {
      const ctl = lb.control || (lb.htmlFor ? document.getElementById(lb.htmlFor) : null);
      if (ctl) ageControls.add(ctl);
    }
  });
  if (ageControls.size > 0) {
    add('error', 'age-collection',
      `Asks for age or birthdate (${ageControls.size} field${ageControls.size > 1 ? 's' : ''})`,
      'Pages aimed at children under 13 generally may not collect age or birthdate information ' +
      'without verifiable parental consent. This is one of the strongest data-collection red flags.',
      describe([...ageControls][0]));
  }

  /* ---------- Check 2: email / phone collection ---------- */
  const emailFields = [...document.querySelectorAll(
    'input[type="email"], input[name*="email" i], input[id*="email" i]')];
  const phoneFields = [...document.querySelectorAll(
    'input[type="tel"], input[name*="phone" i], input[id*="phone" i]')];
  if (emailFields.length > 0 || phoneFields.length > 0) {
    const parts = [];
    if (emailFields.length > 0) parts.push(`${emailFields.length} email`);
    if (phoneFields.length > 0) parts.push(`${phoneFields.length} phone`);
    if (consentMention) {
      add('notice', 'contact-consent-mentioned',
        `Collects contact info (${parts.join(' + ')} field(s)) — page mentions parental consent`,
        'The page collects contact details but does mention parental consent in its text. ' +
        'Still worth reading exactly how that consent is obtained.',
        describe(emailFields[0] || phoneFields[0]));
    } else {
      add('warning', 'contact-no-consent',
        `Collects contact info (${parts.join(' + ')} field(s)) — no parental-consent mention found`,
        'The page collects email or phone details, but no mention of parental consent was found in ' +
        'the visible text. For kid-directed pages, contact info generally requires verifiable parental consent.',
        describe(emailFields[0] || phoneFields[0]));
    }
  }

  /* ---------- Check 3: location / address collection ---------- */
  const locFields = [...document.querySelectorAll('input')].filter((el) =>
    /zip|postal|address|location|\bcity\b/i.test([el.name, el.id, el.placeholder].join(' ')));
  if (locFields.length > 0) {
    add('warning', 'location-collection',
      `Asks for location/address (${locFields.length} field${locFields.length > 1 ? 's' : ''})`,
      'Collecting a child\u2019s location or home address is sensitive personal information. ' +
      'Kid-directed pages need a clear reason and parental consent for this.',
      describe(locFields[0]));
  }

  /* ---------- Check 4: third-party trackers ---------- */
  const thirdHosts = new Set();
  document.querySelectorAll('script[src], iframe[src]').forEach((el) => {
    try {
      const u = new URL(el.src, location.href);
      if (u.hostname && u.hostname !== host && !u.hostname.endsWith(`.${host}`)) {
        thirdHosts.add(u.hostname);
      }
    } catch (e) { /* ignore malformed URLs */ }
  });
  const TRACKER_HINT = /track|analytic|pixel|beacon|ads?|metric|telemetry|tagmanager|hotjar|mixpanel|segment/i;
  const trackerish = [...thirdHosts].filter((h) => TRACKER_HINT.test(h));
  if (trackerish.length > 0) {
    add('warning', 'third-party-trackers',
      `${trackerish.length} likely tracker domain${trackerish.length > 1 ? 's' : ''} loaded`,
      'Scripts or frames from domains that look like analytics/advertising trackers were loaded. ' +
      'On kid-directed pages, behavioral tracking is a major red flag. (Heuristic hostname match — not proof of tracking.)',
      trackerish.slice(0, 5).join(', ') + (trackerish.length > 5 ? ` +${trackerish.length - 5} more` : ''));
  } else if (thirdHosts.size > 0) {
    add('notice', 'third-party-other',
      `${thirdHosts.size} other third-party domain${thirdHosts.size > 1 ? 's' : ''} loaded`,
      'External scripts or frames were loaded, but none matched common tracker name patterns. ' +
      'Still worth a glance on kid-directed pages.',
      [...thirdHosts].slice(0, 5).join(', '));
  }

  /* ---------- Check 5: privacy-policy link ---------- */
  const collectsData = ageControls.size > 0 || emailFields.length > 0 ||
    phoneFields.length > 0 || locFields.length > 0;
  const privacyLink = [...document.querySelectorAll('a')].some((a) => /privacy/i.test(a.textContent || ''));
  if (collectsData && !privacyLink) {
    add('warning', 'no-privacy-link',
      'Collects personal info but no privacy-policy link found',
      'Pages that collect personal information should link to a privacy policy. ' +
      'No privacy-related link text was found among the page links.',
      '');
  }

  /* ---------- Summary payload ---------- */
  return {
    url: location.href,
    host,
    kidSignal,
    consentMention,
    scannedAt: new Date().toISOString(),
    findings
  };
})();
