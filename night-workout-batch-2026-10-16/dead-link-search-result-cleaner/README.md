# Dead Link Checker

Badge the links on any page that fail to connect — on your click, fully reversible.

## What it does

1. Choose how many links to check (10 / 30 / 50).
2. Click **Check this page** → the extension probes each visible link with a lightweight
   network request (4 at a time, 8s timeout each).
3. Links that never connect get an amber **"⚠ may be dead"** badge next to them.
4. Click **Clear badges** → every badge is removed; the page is untouched.

## Honest scope

- **Connection check only.** Because of browser CORS rules, the extension can only tell
  whether a host *connects at all* — it **cannot read HTTP status codes**, so it
  **cannot detect 404s**. This is stated in the popup and in every badge tooltip.
- Bot-protected sites (Cloudflare, some CDNs) may reject probes and show false positives.
  Treat badges as "worth a click to verify", not as proof.
- No links are modified or removed — badges are small removable overlays next to the link.
- Nothing runs automatically; nothing runs until you click.

## Permissions

- `storage` — your max-links setting.
- `activeTab` + `scripting` — injects the checker only when you click, only on the active tab.

No host permissions needed: probes use `no-cors` requests, which reveal only
reachability, never page content.

## Privacy

No analytics, no data collection. Probes go directly from your browser to the linked
sites — the same as clicking them, minus the navigation.
