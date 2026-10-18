# PixelHunt — Tracking Pixel Highlighter

Finds likely tracking pixels on the current page and replaces them with colorful
pixel-art placeholders so you can *see* the invisible trackers.

## How it works

Click **Scan this page**. A content script (injected on demand, never runs uninvited)
checks every `<img>` against simple heuristics:

- rendered at ≤ 2px (the classic 1×1 tracker),
- natural size of 1–2px,
- hidden via CSS (`display:none`, `visibility:hidden`, `opacity:0`) or the `hidden` attribute,
- suspicious URL tokens (`track`, `pixel`, `beacon`, `1x1`, `analytics`, …).

Matches are swapped for generated pixel-art placeholders with a dashed rose outline,
and listed in the popup with host, size, URL, and the reasons they were flagged.
**Restore images** puts every original back — the swap is fully reversible.

## Honest scope

- **Heuristic only.** This is pattern matching, not AI vision and not proof of tracking.
  Some flagged images may be legitimate spacers; some real trackers may be missed.
- **CSP caveat:** pages with a strict `img-src` Content Security Policy may refuse the
  `data:` placeholder URLs; suspects are still listed in the popup in that case.
- 100% local — no network calls, no analytics, no data leaves your device.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Scan only the tab you click on |
| `scripting` | Inject the scanner on demand |
| `storage` | Remember UI preferences |

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Pin PixelHunt, open any page, click the icon → **Scan this page**.

## Publishing notes

- Manifest V3, no remote code, no broad host permissions.
- Icons are generated locally (PIL); no third-party assets.
