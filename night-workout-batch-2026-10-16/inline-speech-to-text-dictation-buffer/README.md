# Dictation Pad — Speech to Text

**Honest scope: uses your BROWSER's built-in speech recognition (Chrome's `webkitSpeechRecognition` — no API key needed). Audio goes to your browser's own speech service, so it needs mic permission and (for Chrome's recognizer) internet. This is NOT a private local engine.**

## What it does

- **Start dictating** — live transcription into an editable text buffer.
- Interim (partial) results shown in italics; final results appended to the buffer.
- Optional spoken punctuation commands: "period", "comma", "question mark", "new paragraph", "new line", quotes, etc.
- Language selector (11 locales), draft auto-save, **Copy**, **Export .txt**, **Save draft**.

## Privacy

- Drafts live in `chrome.storage.local` — 100% local.
- The only thing that leaves your machine is the audio your *browser* sends to *its own* speech service during dictation.

## Files

- `manifest.json` — MV3, permission: `storage` only
- `popup.html` / `popup.css` / `popup.js` — UI + Web Speech integration
- `icons/` — 16/48/128 PNG icons

## Development

Load `chrome://extensions` → Developer mode → "Load unpacked" → select this folder. Works best in Chrome/Edge (Firefox lacks the Web Speech recognition API).
