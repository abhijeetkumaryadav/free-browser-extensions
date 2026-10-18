# CertWatch — SSL Expiry Countdown v1.0.0

Track TLS certificate expiry dates for your domains with live countdown badges and optional desktop alerts.

## Honest scope

The WebExtensions API **cannot read a site's TLS certificate details** — no API exposes the peer certificate. CertWatch instead queries **crt.sh**, the free public certificate-transparency log search (no API key), which lists publicly-logged certificates for a domain. It picks the latest-expiring *currently valid* certificate and counts down to its `not_after` date.

Caveats, stated in the popup:
- crt.sh data comes from Certificate Transparency logs — very recent renewals can lag by hours
- If crt.sh has no usable record (or is unreachable), a **manual expiry-date entry** fallback keeps the countdown working
- This tracks *publicly logged* certificates, not what your browser negotiated

## Features

- Add domains (validated, deduped); crt.sh lookup with graceful failure
- Watchlist sorted by soonest expiry; badges: green (>30d), amber (≤30d), red (≤7d), EXPIRED
- Issuer name + last-checked date per domain; remove button
- Manual expiry-date entry modal when crt.sh has no data
- Daily background check (`chrome.alarms`) with desktop notification when a cert drops under your warning threshold (7/14/30/60 days, configurable)
- All data in `chrome.storage.local`, on-device only

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist watchlist, expiry dates, and alert settings on-device |
| `alarms` | Daily background expiry re-check |
| `notifications` | Optional desktop alert when a certificate nears expiry |
| `https://crt.sh/*` (host) | Query the crt.sh certificate-transparency API — the sole network destination |

## Install (developer mode)

**Chrome / Edge / Opera**
1. Unzip `ssl-certificate-expiration-countdown-clock.zip`
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. **Load unpacked** → select the unzipped folder

**Firefox**: crt.sh fetch from an MV3 extension should work in recent Firefox; background alarms supported. Treat as Chrome/Edge-first.

## Publishing notes

- No remote code, no analytics, no API keys
- Attribution: certificate data via crt.sh (Sectigo) — free public service
- Store listing must not claim to read the browser's live TLS session; describe as "certificate transparency expiry tracking"
