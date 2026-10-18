# RDAP Domain Info — WHOIS Viewer

Look up public domain-registration data for the current tab's domain,
fetched from the public rdap.org proxy. Shows registrar, registration /
update / expiry dates, status, name servers, and DNSSEC signing.

## What it does

- Opens the popup → auto-detects the current tab's domain.
- Fetches `https://rdap.org/domain/<domain>` and renders a compact record.
- Graceful failures: rate-limit (429), not-found (404), timeouts, and
  network errors each get a friendly message instead of a blank popup.
- A "full lookup" link opens the raw RDAP JSON on rdap.org.

## What it does NOT do (honest scope)

- **No private WHOIS API.** rdap.org is a public proxy with rate limits and
  incomplete registry coverage — lookups can fail or be throttled.
- **Does not store anything.** No caching, no history, no accounts.
- This is not a substitute for a registrar-grade WHOIS lookup.

## Permissions

- `activeTab` — reads the current tab's URL to get its domain. Nothing else.
- Host permission `https://rdap.org/*` — only used for the RDAP request.

## Privacy

The domain you look up is sent to rdap.org (necessary for the lookup).
No analytics, no telemetry, no remote libraries.

## Install (development)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. **Load unpacked** → select this folder.
