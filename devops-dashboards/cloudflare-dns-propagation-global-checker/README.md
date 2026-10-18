# PropCheck — DNS Propagation Checker

A polished Manifest V3 browser extension that checks a domain's DNS records against
**two free public DNS-over-HTTPS resolvers** (Google DoH and Cloudflare DoH) and shows
their answers side-by-side with Match/Differs badges — a quick, honest way to spot
whether a DNS change has started propagating.

## Install (developer / unpacked)

**Chrome / Edge / Opera**
1. Download and unzip the release ZIP.
2. Open `chrome://extensions` (or `edge://extensions`, `opera://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `manifest.json`.
   (Note: Firefox support for `host_permissions` in MV3 is fine here; the
   extension uses no Chrome-only APIs.)

## How to use

1. Type a domain (e.g. `example.com`) and pick a record type (A, AAAA, CNAME, MX, TXT, NS).
2. Click **Check propagation**.
3. Each resolver's answer list is shown with a **Match** / **Differs** badge and TTLs.
4. Use the copy button to export the results as text.

## Honest scope

- This is a **two-resolver comparison**, not a global propagation network. True
  worldwide propagation checking needs dozens of vantage points; PropCheck
  approximates it by querying two independent public DoH endpoints.
- Answer sets are compared order-insensitively and TTLs are ignored (TTLs
  legitimately differ between resolvers).
- Some record types may return no data for a domain — that's a normal result,
  not an error.

## Permissions — justification

| Permission | Why |
|---|---|
| `storage` | Remembers your last domain + record type so repeat checks are one click. |
| `https://dns.google/*` (host) | Query Google's free DNS-over-HTTPS JSON API. |
| `https://cloudflare-dns.com/*` (host) | Query Cloudflare's free DNS-over-HTTPS JSON API. |

No API keys. No remote code. No tracking. No data leaves your device except the
DNS queries themselves, which go directly to the two public resolvers you chose.

## Publishing notes

- MV3 only; works in Chrome/Edge/Opera and Firefox (temporary load).
- For the Chrome Web Store: the host permissions above are required for the core
  feature and are disclosed in the store listing privacy section.
- No changes needed for Edge Add-ons or Firefox Add-ons beyond the standard
  review process.
