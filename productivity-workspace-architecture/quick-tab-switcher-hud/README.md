# Quick Tab Switcher HUD v1.0.0

Fuzzy-find your open tabs. A 380px glassmorphism popup with instant search
across tab titles and URLs, keyboard-first navigation, favicons, and
close-from-list. All on-device — nothing leaves your browser.

## Features

- **Instant fuzzy search** — type to filter across tab titles and URLs
  (substring matches rank first, then subsequence matches)
- **Keyboard-first** — `↑`/`↓` move, `Enter` jumps, `Backspace` (empty
  search) closes the selected tab, `Esc` dismisses
- **Favicons + host labels** so you can spot the right tab at a glance
- **Close from the list** with the hover × button (pinned tabs are protected
  from the Backspace shortcut)
- Active tab highlighted in the accent color

## Install (development)

**Chrome / Edge**
1. Unzip `quick-tab-switcher-hud.zip`
2. Go to `chrome://extensions` (Edge: `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select the folder's `manifest.json`
   (temporary installs unload on browser restart)

## Permissions (minimal, justified)

| Permission | Why |
|------------|-----|
| `tabs` | Read tab titles/URLs for search, switch to the chosen tab, and close tabs from the list. Only tabs in the current window are queried. |

No network requests, no storage of tab data, no remote code.

## Publishing notes

- Chrome Web Store: $5 one-time developer registration, MV3 compliant,
  disclose the single `tabs` permission in the privacy tab
- Edge Add-ons: free account, same package
- Firefox Add-ons: free, requires Mozilla signing (`about:debugging` works
  for sideload testing)
- Opera: same Chromium package via Opera's developer portal
