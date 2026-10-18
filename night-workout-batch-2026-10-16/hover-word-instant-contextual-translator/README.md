# My Word Hover — Personal Vocabulary Dictionary

Build your own word → translation dictionary and look words up by hovering
over them on any web page.

## What it is

A personal vocabulary trainer. You save the words you are learning together
with *your* translations and notes; the content script then shows a tooltip
with your translation whenever you hover over one of your saved words.

## What it is NOT

**This is not machine translation.** It cannot translate unknown words —
only the words you saved yourself will ever show a tooltip. There is no
translation API, no cloud call, nothing leaves your browser.

## Use

1. Open the popup, add a word, your translation, and an optional note.
2. Browse any page — hover a saved word and the tooltip appears.
3. Toggle the switch to pause hover lookup without losing your dictionary.
4. Export/import your dictionary as JSON for backup.

## Privacy

Everything is stored in `chrome.storage.local` on your device. No network
requests, no analytics, no accounts.

## Files

- `manifest.json` — MV3 manifest (`storage`, `activeTab`, `scripting`)
- `popup.html` / `popup.css` / `popup.js` — dictionary manager UI
- `content.js` — hover word detection + tooltip (read-only; never modifies page content)
- `icons/` — generated PNG icons
