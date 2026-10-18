# Promotional SEO Farm Domain Blocker

A user-triggered, fully reversible tool that blocks search results coming from
domains **you** blacklist — dimming or collapsing the cards, with one-click
restore.

## What it does

- **Blacklist manager** — add domains one at a time (normalized: strips
  `http://`, `www.`, paths, ports; deduped, case-insensitive), persisted in
  `chrome.storage.local`. **No bundled starter list** — only domains you add are
  ever blocked.
- Click **Block on this page** → the engine scans result cards on the active
  tab, unwraps tracker redirects, matches link hosts against your list (exact
  host or subdomain suffix), and dims (22% opacity + violet dashed outline) or
  collapses matching cards — your choice, remembered.
- The popup lists every blocked item with the matched domain as evidence.
- **Restore all** puts every hidden card back exactly (original inline styles
  stashed per element).
- A lifetime blocked counter is kept in `chrome.storage.local`.

## Honest scope

> **YOUR list — not a farm database.** This extension judges link domains
> against a list you maintain. It cannot know whether a site is a "content
> farm". Nothing runs until you click. No network calls. 100% local.

## Files

- `manifest.json` — Manifest V3; permissions: `storage`, `activeTab`, `scripting`
  (click-only injection, no host permissions).
- `content.js` — message-driven scan/block/restore engine (boot-once guard).
- `popup.html` / `popup.css` / `popup.js` — 380px deep-dark glassmorphism popup,
  single violet accent, Lucide-style outline icons.
- `icons/icon{16,48,128}.png` — generated icons.
- `promotional-seo-farm-domain-blocker.zip` — packaged build with
  `manifest.json` at ZIP root.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Add domains to your blacklist, open any search page, click the icon, then
   **Block on this page**.
