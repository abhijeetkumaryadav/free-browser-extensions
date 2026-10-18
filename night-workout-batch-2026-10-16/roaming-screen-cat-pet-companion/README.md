# Screen Cat — Roaming Pet Companion

A cute animated cat that roams around your web pages. It walks along the bottom of the page, sits, grooms itself, naps (with floating Zzz), pounces playfully, and chases your cursor if you let it.

## Features

- **SVG-animated cat** — walking legs, wagging tail, blinking eyes, grooming head-tilt, sleeping breathing animation
- **Behaviour state machine** — walk / sit / groom / sleep / chase-the-cursor, with random transitions and occasional pounces
- **Customizable** — 6 fur colors, size slider, cursor-chasing toggle
- **Isolated rendering** — the cat lives in a Shadow DOM, so page CSS can never break it
- **Respects `prefers-reduced-motion`**

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder
3. Click the extension icon → **Summon cat on this tab**

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your fur color / size / chase preferences |
| `activeTab` + `scripting` | Inject the cat into the tab only when you click Summon |

No network requests. No tracking. The cat never phones home — it just naps.

## Honest scope

This is a purely cosmetic companion toy. It does not interact with page content, read your data, or affect the sites you visit. It cannot run on `chrome://` pages or the Chrome Web Store (browser restriction).

## Publishing notes

- Manifest V3, no remote code — store-policy friendly
- Screenshots: summon the cat on a docs page and capture it mid-walk
