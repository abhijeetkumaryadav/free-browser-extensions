# Phonetic Speller — Text to Speech Reader

Read any text aloud and spell words phonetically using 100% on-device
text-to-speech. Nothing you type ever leaves your browser.

## Features

- **Read aloud** — speaks typed, pasted, or grabbed text with a chosen system voice
- **Spell · NATO** — spells letter-by-letter using the NATO phonetic alphabet
  (Alfa, Bravo, Charlie…), ideal for dictating spellings over calls
- **Spell · A-B-C** — classic letter-by-letter spelling with punctuation spoken
  as words ("comma", "period", "question mark")
- **Grab selection** — pulls the currently selected text from the active tab
- Voice picker (prefers local on-device voices), rate / pitch / volume sliders
- Settings persist locally; **Stop** halts speech instantly

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `storage` | Remember voice + slider settings locally |
| `activeTab` + `scripting` | "Grab selection" reads `window.getSelection()` from the tab you click it on — only on click, nothing in the background |

No host permissions, no background page, no network calls. The Web Speech API
synthesizes audio on-device via the OS speech engine.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — UI + logic
- `icons/icon-{16,48,128}.png` — generated icons

## Notes

- Voices depend on the OS/browser speech engine; quality varies by system.
- `chrome://`, `edge://` and the web store pages are protected — "Grab
  selection" will show a hint there instead of failing silently.
