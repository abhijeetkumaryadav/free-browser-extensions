# CreditCheck — Post-Credits Scene Guide

**Does this movie have scenes during or after the credits?** Search 19 popular titles from a built-in static dataset, get an instant verdict card (mid-credits / post-credits), and add your own titles with custom notes.

## What it does

- **Instant verdict card** — search a movie, click it, and see at a glance whether to stay in your seat or head for the exit
- **19 built-in titles** (compiled Oct 2026) with mid-credits / post-credits flags and notes
- **Add your own titles** — save custom entries with year, scene flags, and notes; edit/delete anytime
- **100% offline** — the dataset ships with the extension; no network calls, no accounts, nothing leaves your device

## Honest scope

This is a **static guide, not a live movie database**. New releases after Oct 2026 won't be in the built-in list — add them yourself after checking, and your note helps next time you search.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persists your custom titles on-device. That's it. No host access, no network, no background page. |

## Install

1. Download/unzip this folder
2. Open `chrome://extensions` (Edge: `edge://extensions`; Firefox: `about:addons` → gear → "Install Add-on From File")
3. Enable **Developer mode** (Chrome/Edge)
4. **Load unpacked** → select this folder

## Publishing notes

- Manifest V3, `storage`-only permission — minimal disclosure surface
- No remote code, no analytics, no external requests: privacy policy is one line
- Firefox: fully compatible (no Chromium-only APIs used)

## File layout

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI + logic
- `data.js` — static built-in credits dataset (clearly dated)
- `icons/` — generated PNG icons (16/48/128)
