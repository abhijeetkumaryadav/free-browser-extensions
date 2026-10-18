# Multi-Search Launcher — One Query, Many Engines

**Launcher only — does NOT aggregate or scrape results.**

Type your query once, tick the search engines you want, and hit **Launch** (or press
Enter). The extension opens your query on each selected engine in **background tabs**
— 10 engines supported: Google, Bing, DuckDuckGo, Brave, Ecosia, Startpage, Yandex,
Yahoo, Mojeek, Qwant.

**Important limits (read me):**
- This only **opens search pages**. It does not fetch, aggregate, rank, or summarize
  results — doing that would violate search engines' terms of service.
- No network calls made by the extension itself. Tabs are opened by Chrome from your click.

## Permissions

- `storage` — remember which engines you picked. That's it. (`chrome.tabs.create`
  needs no extra permission for opening tabs.)

## Files

`manifest.json` · `popup.html` · `popup.css` · `popup.js` · `README.md` · icons

## Install (developer mode)

1. `chrome://extensions` → enable Developer mode → Load unpacked → this folder.
2. Click the extension, type a query, pick engines, press Enter.
