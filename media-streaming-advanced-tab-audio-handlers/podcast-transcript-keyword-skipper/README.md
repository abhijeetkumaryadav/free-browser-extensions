# Transcript Keyword Skipper v1.0.0

Find keywords inside on-page transcripts — podcast show notes, episode transcripts, long articles — and jump between every match.

## What it does

- Enter comma-separated keywords in the popup and press **Find**.
- Every match in transcript-like regions (`<article>`, `<main>`, `.transcript`, …) is highlighted read-only, with a match count and keyword chips.
- **Prev / Next** arrows scroll smoothly to each match; the active match glows.
- **Match case** and **Whole words** toggles; preferences are remembered on-device.
- **Clear highlights** restores the page exactly — nothing is modified, saved, or sent anywhere.

## Install

**Chrome / Edge**
1. Unzip `podcast-transcript-keyword-skipper.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `activeTab` | Read the title/URL context and message the current tab |
| `scripting` | Inject the highlighter **only when you press Find** — never automatically |
| `storage` | Remember your Match case / Whole words preferences on-device |

No network calls. No data leaves your device. Page text is scanned in-memory and never stored.

## Publishing notes

- Manifest V3, no deprecated APIs.
- No remote code, no analytics, no external requests — store-review friendly.
- `content.js` is injected on demand (user gesture), not declared as a persistent content script.
