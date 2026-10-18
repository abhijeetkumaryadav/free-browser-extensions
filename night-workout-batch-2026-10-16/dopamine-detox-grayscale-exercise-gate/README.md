# Focus Gate — Grayscale Detox

**Honestly labeled: a self-imposed focus aid.** It cannot diagnose or change your habits — it simply puts a grayscale gate on the websites *you* choose, asking for a short movement break before you continue. Everything is local; nothing leaves the browser.

## What it does

- Maintain a **list of gated sites** (e.g. `reddit.com`) in the popup.
- Visiting a gated site shows a **grayscale overlay** with your movement prompt ("do 2 minutes of movement — 10 squats — then tap below to continue").
- Tap **"I've moved — let me in"** to dismiss (self-declared — it's your rule).
- Toggle the gate on/off; edit the site list any time. Fully reversible.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (permissions: `storage` only) |
| `content.js` | Host matching + grayscale gate overlay |
| `popup.html` / `popup.css` / `popup.js` | Gated-site list + prompt settings |
| `README.md` | This file |
| `icons/` | 16/48/128 PNG icons |

## Permissions

- `storage` — your site list and prompt settings, stored locally.

## Notes

- The gate only engages on sites **you** list; it never blocks anything on its own.
- `chrome://` and extension pages are off-limits to content scripts by design.
