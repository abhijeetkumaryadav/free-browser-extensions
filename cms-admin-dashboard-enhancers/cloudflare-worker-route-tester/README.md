# Worker Route Tester v1.0.0

Test your Cloudflare Worker routes right from the toolbar: enter a worker base URL and a list of test paths, fire the requests, and see status code, response time, and key headers per route. Save reusable test suites and export results as CSV.

## Features

- Test any HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) against paths you enter
- Per-route status badge (2xx / 3xx / 4xx / 5xx / network error), response time in ms
- Expandable full response-header viewer per route
- Summary stats: routes tested, healthy count, average response time
- Saved test suites (base URL + method + paths) with one-click load
- CSV export of results for reporting

## Privacy

**Only URLs you explicitly type are ever requested.** The extension performs no background network calls, analytics, or telemetry. All test suites and form state stay in on-device `chrome.storage.local`.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) → enable Developer mode → Load unpacked → select the folder.

**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`. Note: `host_permissions` for arbitrary user-entered URLs works in Firefox; temporary add-ons lose storage on restart.

**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions

- `storage` — save test suites and remember your last form input, on-device only.
- `clipboardWrite` — copy Markdown/CSV exports to the clipboard.
- `host_permissions` (`http://*/*`, `https://*/*`) — required because test targets are URLs *you* type (workers often live on custom domains or localhost). The extension never requests any URL you didn't enter.

## Publishing notes

- Manifest V3, no remote code, no external libraries.
- When submitting to the Chrome Web Store, explain the broad host permission in the "Permissions justification" field: it exists solely to fetch user-entered test URLs.
