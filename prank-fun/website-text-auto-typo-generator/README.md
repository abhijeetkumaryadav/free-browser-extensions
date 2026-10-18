# TypoStorm — Website Text Auto Typo Generator

A harmless joke extension. A typo-intensity slider (1–100%) rewrites the
visible text on the current tab with realistic typos: swapped letters,
doubled letters, dropped letters, and fat-fingered neighboring QWERTY keys.
One click restores every word exactly. Fully reversible, on-device.

## Install

**Chrome / Edge / Opera**
1. Unzip `website-text-auto-typo-generator.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select `manifest.json`

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Access the current tab only when you click the popup button |
| `scripting` | Inject the typofy/restore logic into the active tab on demand |
| `storage` | Remember your slider position between popup opens |

No host permissions, no background service worker, no network calls.

## How it works

- Move the slider to set typo intensity, then click **Typofy this page**.
- Each eligible word (4+ letters, no digits) gets at most one typo per click:
  letter swap (`receive` → `recieve`), doubling, dropping, or a neighboring-key
  substitution that preserves casing. The first letter is never touched, so
  text stays readable and layout is preserved.
- Originals are stored per text node on first touch; **Restore original text**
  (or toggling off) puts every word back exactly.
- Clicking Typofy again while active layers on more typos — restore still
  returns to the true original.

## Limits (honest scope)

- Skips form fields (`input`, `textarea`, `select`), `contenteditable`
  regions, scripts/styles, and code blocks (`code`, `pre`, `kbd`, `samp`).
- Applies once per click to the text currently in the DOM; content that loads
  afterwards needs another click.
- Cannot run on `chrome://`, `edge://`, `about:` or Chrome Web Store pages —
  the browser blocks injection there.

## Publishing notes

- Manifest V3, no remote code, no analytics.
- Chrome Web Store "single purpose" policy: describe it clearly as a joke /
  prank utility in the listing.
