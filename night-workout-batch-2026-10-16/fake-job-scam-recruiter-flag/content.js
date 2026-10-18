/* Fake Job Scam Recruiter Flag — content script
 * Runs ONLY on explicit user click (injected via chrome.scripting).
 * Collects: page text (truncated), mailto: links, email-like strings,
 * WhatsApp/Telegram mentions, and the page URL/host. No network calls. */
(() => {
  'use strict';

  // Grab visible-ish text, capped to keep payloads small.
  const raw = (document.body ? document.body.innerText : '') || '';
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, 20000);

  // Emails from mailto: links plus visible email-shaped strings.
  const emailSet = new Set();
  document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
    const e = a.getAttribute('href').replace(/^mailto:/i, '').split('?')[0].trim();
    if (e) emailSet.add(e.toLowerCase());
  });
  const visible = raw.slice(0, 12000);
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let m;
  while ((m = re.exec(visible)) && emailSet.size < 25) {
    emailSet.add(m[0].toLowerCase());
  }

  // Instant-messenger recruitment red flag: recruiters who only contact via WhatsApp/Telegram.
  const imMentions = /\b(whatsapp|telegram)\b/i.test(text);

  // Any salary-like figures for the too-good-pay heuristic.
  const salaryStrings = [];
  const salRe = /(?:rs\.?|₹|\$|€|£)\s?[\d,]+(?:\.\d{1,2})?(?:\s?(?:k|lakh|l|\/ ?(?:month|mo|year|annum|pa|week|wk|hour|hr)))?/gi;
  let s;
  while ((s = salRe.exec(text)) && salaryStrings.length < 15) {
    salaryStrings.push(s[0]);
  }

  const host = location.hostname || '';

  chrome.runtime.sendMessage({
    type: 'JOB_PAGE_DATA',
    payload: {
      text,
      emails: [...emailSet],
      imMentions,
      salaryStrings,
      host,
      url: location.href
    }
  });
})();
