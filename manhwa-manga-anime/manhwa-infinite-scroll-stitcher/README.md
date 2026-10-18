# StripFlow — Auto-Scroll Reading Helper

Hands-free auto-scroll for vertical-strip reading (manhwa, webtoons, long articles, documentation). Adjustable speed, pauses when you scroll yourself, jump-to-top/bottom buttons.

## Install

**Chrome / Edge:**
1. Unzip the package.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:** load via `about:debugging` → This Firefox → Load Temporary Add-on (`scripting.executeScript` works in Firefox 102+).

## Use

1. Open any long page and click the toolbar icon.
2. Press **Start auto-scroll**. The page scrolls smoothly at your set speed.
3. Adjust speed with the slider (10–400 px/s) or the presets: Slow / Casual / Fast / Speed-read.
4. **Pause when I scroll** (on by default): your wheel or touch input takes over; auto-scroll resumes after 2s idle.
5. **Stop at page bottom** (on by default): stops automatically at the end.
6. **Top / Bottom** buttons jump instantly.

## Permissions (justified)

- `storage` — persist your speed and behaviour preferences on-device.
- `activeTab` + `scripting` — inject the scroll helper into the current tab only when you press a button. No page content is read, stored, or transmitted.

## Honest scope

- Non-destructive: the script only calls `window.scrollBy` — it never modifies page content.
- Does not work on `chrome://`, `edge://`, or Web Store pages (browsers block injection there); the status pill shows "Unsupported page".
- Auto-scroll stops if you navigate away or close the tab.

## Publishing notes

- Chrome Web Store: single-purpose utility, minimal permissions, no remote code, no analytics, no network calls.
