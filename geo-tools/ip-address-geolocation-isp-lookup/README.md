# IPLocate — IP Geolocation & ISP Lookup

Look up approximate ISP-level geolocation for any IPv4/IPv6 address (or your own IP): country, region, city, ISP, organization, ASN, and timezone — via the free no-key ip-api.com API.

## What it does

- **IP lookup** — type any public IPv4/IPv6 address and get country (+code), region, city, ZIP, coordinates, timezone, ISP, org, and ASN.
- **My IP** — one click looks up your own public IP (blank query).
- **Copy result** — copies a plain-text summary to the clipboard.
- Last query is remembered via `chrome.storage.local`.
- Graceful errors: rate-limited, private/reserved range, invalid query, and network failures each get a plain-language message.

## Honest scope

- Results are **approximate ISP-level geolocation** — city accuracy at best, often region-level. It **cannot** pinpoint a street address or identify a person.
- Private, reserved, loopback, and link-local IPs can't be geolocated (the API refuses them).
- Free tier of ip-api.com is rate-limited (~45 requests/min); the popup tells you to wait if you're limited.
- Data source is attributed in the popup: **Data: ip-api.com**. The free endpoint is HTTP-only (no key needed); no other network calls are made.

## Permissions

- `storage` — remembers your last query.
- Host permission `http://ip-api.com/*` — the single geolocation API used. No other hosts are contacted.

## Install (development)

**Chrome / Edge / Opera:**
1. Download and unzip `ip-address-geolocation-isp-lookup.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox:** Load via `about:debugging` → This Firefox → Load Temporary Add-on. (Note: Firefox may upgrade or block the HTTP API call; Chrome/Edge recommended for this one.)

## Publishing notes

- MV3, no deprecated APIs, no remote code. One host permission with clear justification and in-popup attribution.
- Privacy: queries go only to ip-api.com, and only when you click Lookup / Use my IP.
