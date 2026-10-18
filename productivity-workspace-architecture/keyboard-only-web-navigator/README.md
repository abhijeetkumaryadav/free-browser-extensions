# Keyboard-Only Web Navigator v1.0.0

Browse the web without touching the mouse. Vim-style shortcuts work on
every page:

| Key | Action |
|-----|--------|
| `j` / `k` | Scroll down / up |
| `d` / `u` | Half-page down / up |
| `g g` | Top of page |
| `G` | Bottom of page |
| `r` | Reload page |
| `x` | Close tab |
| `[` / `]` | Previous / next tab |
| `?` | Toggle shortcut cheatsheet overlay |

Shortcuts are automatically ignored while you type in inputs, text
areas, or editors (including password fields) — nothing is ever
recorded. The popup lets you enable/disable navigation and tune the
scroll step.

## Try it
1. Unzip `keyboard-only-web-navigator.zip`.
2. **Chrome / Edge:** open `chrome://extensions`, enable **Developer mode**,
   click **Load unpacked**, and select the folder.
3. **Firefox:** open `about:debugging#/runtime/this-firefox`, click
   **Load Temporary Add-on**, and select `manifest.json` (temporary until
   signed via AMO for permanent installs).
4. Press `?` on any page to see the cheatsheet.

## Permissions
- `storage` — saves your enable toggle and scroll-step preference on-device.
- Host access (`<all_urls>` content script) — required so shortcuts work on
  every page you visit. No page content is read, stored, or transmitted.

## Publishing notes
- Manifest V3, zero network calls, zero analytics.
- Chrome Web Store: $5 one-time developer registration.
