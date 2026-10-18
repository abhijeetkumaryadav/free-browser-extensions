# Domain Blacklist Filter

Your own domain blacklist for search-style result pages — nothing more.

## What it does

1. Type the domains you don't want to see (one per line) — saved in `chrome.storage.local`.
2. Pick **Dim** or **Collapse**.
3. Click **Filter this page** → result cards linking to your blacklisted domains are dimmed or collapsed.
4. Click **Restore** → the page goes back to exactly how it was.

## Honest scope

- **YOUR blacklist only** — this extension has no reputation database, no ratings service, no network calls. It matches link domains against the list you typed.
- Subdomains count (blacklisting `example.com` also hides `blog.example.com`).
- Nothing runs automatically; nothing is deleted — collapse only hides, restore unhides.
- Matches are heuristic: if a page uses an unusual layout, some cards may be missed.

## Permissions

- `storage` — your blacklist and mode.
- `activeTab` + `scripting` — injects the filter only when you click a button, only on the active tab.

## Privacy

100% local. No network requests, no analytics, no data leaves the machine.
