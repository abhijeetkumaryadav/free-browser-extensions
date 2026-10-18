# Leak Credential Scanner v1.0.0

Defensive dev tool: scans the page you're viewing for patterns that look like
exposed secrets — AWS keys, private-key headers, `api_key` assignments, bearer
tokens, database connection strings, high-entropy literals.

- **Heuristic only** — expect false positives. A finding is a suspicion, not proof.
- **Nothing ever leaves your device.** The scan runs locally; no URLs, matches,
  or page content are transmitted anywhere. The "Copy report" button copies
  to your clipboard only when you click it (the report does include full
  matched values — keep it private).

## Install

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
enable Developer mode → Load unpacked → select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
select `manifest.json`. (Temporary until signed.)
**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions

- `activeTab` — scan only the tab you click the extension on.
- `scripting` — inject the scanner into that tab on demand.
- `storage` — remember the last scan's count (never the values).

## Publishing notes

- MV3, no remote code, no data collection — straightforward store review.
- Chrome Web Store: one-time $5 developer registration + privacy disclosure
  ("does not collect user data"). Edge: free. Firefox: free, requires signing.
