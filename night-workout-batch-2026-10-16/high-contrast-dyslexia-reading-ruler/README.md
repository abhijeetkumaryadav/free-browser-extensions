# ReadRuler — Dyslexia-Friendly Reading Aid

An accessibility reading aid: a follow-the-mouse **reading ruler** plus **dyslexia-friendly text adjustments** (letter/word spacing, line height, readable system-font stack). Everything is user-triggered, per tab, and fully reversible.

## Features

- **Reading ruler** — a translucent band that follows your cursor's vertical position, with adjustable height (20–120px), opacity (10–80%), and 5 color presets.
- **Dyslexia-friendly text** — adjustable letter spacing, word spacing, and line height, plus an optional readable system-font stack. **No font files are bundled or downloaded** — system fonts only.
- **On-demand** — click "Apply to this page"; "Remove" restores the page exactly. Nothing runs uninvited.

## Install

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder (or install the `.zip` via your browser's extension installer).

## Permissions

- `storage` — save your ruler/text preferences locally.
- `activeTab` + `scripting` — inject the ruler and text adjustments into the page you explicitly click "Apply" on. No host permissions, no background page.

## Honest scope

- The ruler is a visual overlay; it does not change page content.
- Text adjustments are heuristic CSS changes (spacing/line-height/font stack). They are a comfort aid, **not a medical device** and not a substitute for professional dyslexia assessment or tools.
- 100% local. No network calls, no analytics, no data leaves the device.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — settings popup
- `content.js` — on-demand ruler + text-adjustment injector
- `icons/` — 16/48/128 PNG icons
