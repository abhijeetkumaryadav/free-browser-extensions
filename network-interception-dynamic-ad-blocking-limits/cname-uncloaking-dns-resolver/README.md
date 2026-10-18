# CNAME Uncloak — DNS Resolver v1.0.0

Reveal CNAME chains and final IP addresses for any domain using DNS-over-HTTPS. Educational, read-only, on-click lookups — a simple way to see when a first-party hostname is aliased to a third party.

## Features

- **CNAME chain resolution** — follows up to 8 CNAME hops, then collects A + AAAA records
- **Type any domain**, or one click to use the current tab's hostname
- **Visual chain display** — each hop with record type, terminal name, and final IPs
- **Educational verdict** — "Direct resolution" vs "Aliased to a third party", with a plain-language note when the destination hostname hints at analytics/tracking infrastructure
- **Two DoH providers** — Google (`dns.google`) or Cloudflare (`cloudflare-dns.com`), remembered on-device
- Strict domain validation; IDNs normalized via punycode

## Install

1. Unzip `cname-uncloaking-dns-resolver.zip` anywhere.
2. Open `chrome://extensions` (Edge: `edge://extensions`; Firefox: `about:debugging#/runtime/this-firefox`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers only your chosen DNS provider. |
| `activeTab` | Lets "Use current tab's domain" read the active tab's hostname — only when you click it. |
| Host permissions `dns.google`, `cloudflare-dns.com` | The only network destinations: public DNS-over-HTTPS JSON APIs, queried on click. |

No content scripts, no background page, no browsing-history access.

## Privacy

Queries go only to the DNS-over-HTTPS provider you selected, and only when you click Resolve. Nothing is logged or stored besides the provider choice.

## Honest scope

- **Educational heuristic only.** CNAME aliasing is widely used legitimately (CDNs, hosting platforms, SaaS). This tool reveals DNS structure — it does not judge, block, or definitively identify trackers.
- Results reflect public DNS at query time; split-horizon / private DNS won't be visible.
- Some resolvers cap or filter responses; if one provider fails, try the other.

## Publishing notes

- Manifest V3; Chrome/Edge native. Firefox supports DoH fetches and `activeTab` the same way.
- Suggested store category: Developer Tools / Privacy.
- No remote code, no obfuscation — review-friendly.
