/* Content script (ISOLATED world): scans the page for exposed-secret patterns.
   Injected on demand by the popup via chrome.scripting.executeScript.
   The file's final expression value (the findings array) is returned to the
   popup. Top-level declarations are fine: each injection is a fresh script. */
'use strict';

  // --- Heuristic pattern rules: [label, regex, severity] -----------------
  // Kept deliberately generic: these are patterns, not real secrets.
  const RULES = [
    ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g, 'high'],
    ['AWS secret key assignment', /aws[_-]?secret[_-]?access[_-]?key["'\s:=]+[A-Za-z0-9/+=]{20,}/gi, 'high'],
    ['Private key header', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, 'high'],
    ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, 'high'],
    ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, 'high'],
    ['Generic API key assignment', /\b(api[_-]?key|apikey|api[_-]?secret|client[_-]?secret|access[_-]?token)["'\s:=]+[A-Za-z0-9_\-./+=]{16,}/gi, 'medium'],
    ['Password in code', /\b(pass(word)?|passwd|pwd)["'\s:=]+[^"'\s]{6,}/gi, 'medium'],
    ['Bearer token', /\bBearer\s+[A-Za-z0-9\-._~+/=]{20,}/g, 'medium'],
    ['High-entropy string literal', /["']([A-Za-z0-9+/=]{40,})["']/g, 'low'],
    ['Database connection string', /\b(mongodb|postgres|mysql|redis):\/\/[^\s"'<>]+/gi, 'high'],
    ['Google API key', /\bAIza[0-9A-Za-z\-_]{35}\b/g, 'medium']
  ];

  // Redact most of a matched value, keeping just enough to identify it.
  function redact(value) {
    const s = String(value);
    if (s.length <= 12) return '••••••••';
    return s.slice(0, 6) + '••••••••' + s.slice(-4);
  }

  function snippetAround(text, index, len) {
    const start = Math.max(0, index - 40);
    const end = Math.min(text.length, index + len + 40);
    return text.slice(start, end).replace(/\s+/g, ' ').trim();
  }

  function scan() {
    const findings = [];
    // Scan: full HTML, inline scripts, and common meta/link attributes.
    const sources = [document.documentElement.outerHTML];
    document.querySelectorAll('script:not([src])').forEach(el => {
      if (el.textContent) sources.push(el.textContent);
    });

    const seen = new Set();
    for (const src of sources) {
      for (const [label, regex, severity] of RULES) {
        regex.lastIndex = 0;
        let m;
        while ((m = regex.exec(src)) !== null) {
          const value = m[0].length > 200 ? m[0].slice(0, 200) + '…' : m[0];
          const key = label + '|' + value;
          if (seen.has(key)) continue;          // de-dupe identical hits
          seen.add(key);
          findings.push({
            label, severity,
            match: value,                        // full value, redacted in UI until revealed
            redacted: redact(value),
            context: snippetAround(src, m.index, m[0].length),
            where: src === sources[0] ? 'page HTML' : 'inline script'
          });
          if (findings.length >= 50) return findings; // cap for sanity
        }
      }
    }
    return findings;
  }

  // The findings array is the file's completion value -> returned to popup.
  scan();
