# FontForce — Global Font Family Override

Accessibility tool: force a readable font family across the current page, with
adjustable strength and one-click restore.

## What it does

- Pick a font from a curated list:
  - **Sans-serif (system)** — clean modern sans
  - **Serif (Georgia)** — book-style, easy for long reads
  - **Monospace** — fixed-width, every character distinct
  - **Dyslexia-friendly** — Verdana + wider letter/word spacing (an honest
    approximation; no webfont is bundled)
- **Strength slider:** "body + text" (safer, keeps page layout) vs "everything"
  (`*` selector for stubborn sites)
- **Apply to page** injects a single `<style>` tag into the active tab;
  **Restore** removes it exactly. Code blocks always keep a monospace font.
- The popup probes the tab on open and shows whether an override is active.

## Install

1. Unzip this package anywhere.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**, click **Load unpacked**, and select the unzipped folder.

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → pick
`manifest.json`.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Touch the page you're looking at, only when you click Apply/Restore |
| `scripting` | Inject the font stylesheet on your explicit click |
| `storage` | Remember your font + strength preference on-device |

No network calls. No data leaves your device. Injection is user-gesture-only.

## Honest limits

- Cannot run on `chrome://`, `edge://`, or the Web Store pages (browser restriction).
- "Dyslexia-friendly" uses system fonts + spacing — it is not the OpenDyslexic
  typeface (bundling it would add megabytes to the package).
- Some pages with aggressive `!important` rules may need the "everything" strength.

## Publishing notes

- Manifest V3, no remote code, minimal permissions — store-safe.
- Single purpose, clearly labeled accessibility helper.
