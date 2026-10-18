# Warp — Instant Speed-Dial New Tab (v1.0.0)

A fast, fully local new tab page: customizable shortcut tiles, a search box using the engine you choose, a live clock, and dark/light themes. Nothing on this page phones home.

## What it does

- **Shortcut tiles** — click to open; add, remove, and reorder via the gear (Settings) menu. Only `http(s)` URLs are accepted.
- **Search box** — type a query to search with your chosen engine (Google, Bing, DuckDuckGo, Brave, Ecosia), or type a bare domain to navigate straight to it.
- **Clock & date** — live, with a toggle in Settings.
- **Themes** — dark and light, one click in the top bar.
- **Reset** — one click restores the default shortcuts.

## Honest scope

There is no such thing as zero network latency — this page is simply **fully local** (no remote scripts, fonts, or analytics), so it renders instantly. The only network activity is the search you submit or the shortcut you click.

## Install

1. Unzip `zero-latency-tab-initializer.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder. New tabs will use Warp.

Note: Chrome shows a one-time "an extension changed your New Tab page" notice — expected behavior for any new-tab extension.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist your theme, shortcuts, and search-engine choice locally |

No host permissions, no background page, no analytics, no remote code.

## Publishing notes

- Manifest V3, no deprecated APIs.
- `chrome_url_overrides` newtab requires the standard "Replace the page you see when opening a new tab" disclosure in store listings.
- Category: Productivity. Privacy: "No data collected."
