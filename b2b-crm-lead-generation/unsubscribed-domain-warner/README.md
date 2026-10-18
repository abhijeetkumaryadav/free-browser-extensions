# Unsubscribed Domain Warner v1.0.0

Keep a personal blocklist of domains. Whenever you visit a page on a
listed domain, a dismissible warning banner slides in at the top of
the page and the toolbar icon gets a red **!** badge. The banner never
blocks or alters the page — it only warns; you can continue, dismiss
for the session, or remove the domain from the blocklist right from
the banner.

## Try it
1. Unzip `unsubscribed-domain-warner.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon → **Block this site**, then visit the site to see the banner.
4. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json`.

## Permissions
- `storage` — the blocklist lives on-device; nothing is uploaded.
- `activeTab` — read the current tab's hostname so "Block this site" works.
- Content script on all URLs — required to check each visited domain
  against your blocklist. It reads only `location.hostname`, injects
  nothing unless there's a match, and never sends data anywhere.

## Publishing notes
- Chrome Web Store: $5 one-time dev fee. The all-URLs content script
  triggers the broad host warning in review — the listing description
  must clearly explain why it is needed (per-domain warnings).
