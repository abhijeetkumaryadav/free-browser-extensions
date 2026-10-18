# Tech Stack Infrastructure Detector

Sniffs the **client-side tech fingerprints** of any page you visit: frontend frameworks,
CSS frameworks, CMSs, analytics, payments, and support tools.

## How it works

1. Click **“Scan this page”** — the extension injects a read-only collector into the
   active tab (via `chrome.scripting`, `activeTab` permission, explicit click only).
2. The collector gathers signals: framework `window` globals, `<script>`/`<link>` URLs,
   `meta` generator tags, and known markup patterns (`wp-content`, `__NEXT_DATA__`, …).
3. Each signal is matched against a **bundled, dependency-free pattern list** and
   reported with a confidence level: **HIGH / MEDIUM / LOW**.

## Honest limitations

- **Heuristic only.** Detection is based on client-side fingerprints; minified,
  obfuscated, or custom stacks can evade it, and false positives happen.
- **No server visibility.** It cannot see server languages, databases, hosting
  infrastructure, or anything behind the network.
- Matches are only as good as the bundled pattern list — it is intentionally small
  and conservative.

## Privacy

- 100% local. No network requests, no analytics, no external lookups.
- Read-only scan — the page is never modified.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`activeTab` + `scripting`) |
| `popup.html` / `popup.css` / `popup.js` | Popup UI, collector function, rule matcher |
| `icons/` | Generated 16/48/128 PNG icons |
