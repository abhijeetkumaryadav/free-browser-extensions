# Click-to-Pronounce — Sentence Pronunciation Player

**Honest scope:** hover any sentence on the page to highlight it, click to hear it
spoken by the browser's built-in speech synthesis. It **plays pronunciation only** —
no phonetic transcription or phonetic spelling is produced (no such offline engine exists).

## What it does

- **Arm on this tab** (explicit click) → splits visible paragraph-like text into sentence spans
- Hover a sentence → violet highlight; click → spoken via `speechSynthesis`
- Voice picker + rate slider; **Esc** or "Clear" removes every highlight and stops speech
- Page text is never modified permanently — spans unwrap on clear
- 100% local, zero network

## Permissions

- `storage` — remember voice/rate preferences
- `activeTab` + `scripting` — inject the highlighter on click only

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`, icons.

## Install

1. Open `chrome://extensions`, enable Developer mode
2. Load unpacked → select this folder (or install the `.zip`)
