# Zen Mode Page Cleaner v1.0.0

One-click reader mode for article pages. Strips navigation, sidebars, ads, popups, and comment sections, then presents the article in clean, adjustable typography. Fully reversible — your original page is restored untouched when you exit.

## Features

- **Smart article extraction** — prefers `<article>` / `<main>` landmarks, falls back to scoring content blocks by paragraph volume.
- **Aggressive decluttering** — removes nav, headers, footers, sidebars, ads, share buttons, newsletters, comments, and popups; sanitizes markup to safe text tags only.
- **Three themes** — Light, Sepia, Dark.
- **Adjustable typography** — font size (14–24px) and line width (560–880px) sliders, applied live.
- **Reading meta** — site name, title, author (when available), and estimated reading time.
- Settings persist across sessions.

## Install

**Chrome / Edge**
1. Download and unzip `zen-mode-page-cleaner.zip`.
2. Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`.

**Opera** — same steps as Chrome via `opera://extensions`.

## How it works

1. Open any article page and click the extension icon.
2. Click **Enter Zen Mode** — the original HTML is saved in memory and the page is swapped for the reader view.
3. Adjust theme, font size, and width — changes apply instantly.
4. Click **Exit Zen Mode** — the original page HTML is restored exactly.

## Honest limitations

- Works best on article-style pages. On homepages, apps, or video pages the extractor picks the largest text block, which may not be what you want.
- Cannot run on browser-internal pages (`chrome://`, `edge://`, `about:`) or the web stores — the popup explains this.
- Page scripts don't run while Zen Mode is active (the reader is static HTML); exiting restores full interactivity.

## Permissions (all justified, minimal)

| Permission | Why |
|---|---|
| `activeTab` | Confirm the current tab is a regular web page and message the content script there. |
| `scripting` | Inject the content script only when you open the popup on a page. |
| `storage` | Remember your theme / font-size / width preferences on-device. |

No remote code, no analytics, no data leaves your device.

## Publishing notes

- Chrome Web Store: single-purpose reader-mode tool, minimal permissions; the `activeTab` + `scripting` pattern (inject on user click) is the store-preferred approach.
- Privacy disclosure: "reads the visible article text of pages you open to render a reader view; nothing is transmitted."
