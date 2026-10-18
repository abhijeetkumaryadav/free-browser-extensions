# Grandpa Mode — Simple Senior Browsing

A comfort-first browsing mode for seniors (and anyone who likes big, calm pages). Enable it per site — everything is fully reversible.

## Features (each toggleable)

- **Larger text** — 25% bigger type with roomier line spacing
- **High contrast** — warm paper background, dark text, clearer links
- **Simplify layout** — hides sidebars and ad-like elements, narrows the page column
- **Bigger buttons** — 44px touch-friendly links and buttons

Settings are remembered per site. Turn the master switch off and the page is restored exactly.

> Comfort aid, not a medical device. It adjusts styling only — it cannot fix broken websites.

## Permissions (minimal, justified)

- `storage` — remember per-site settings on this device
- `activeTab` + `scripting` — apply the mode when you toggle it
- `<all_urls>` content script — re-apply your saved settings when a remembered site loads

## Privacy

100% local. No network requests, no accounts, no analytics, no tracking.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the toolbar icon on any site and flip **Simplify this site**
