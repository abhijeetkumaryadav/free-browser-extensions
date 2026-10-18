# CardForge — Flashcards & Anki Export

Create flashcard decks, study with a flip-card mode and self-grading, and let a simple SM-2-style spaced-repetition scheduler decide when each card is due next. Export any deck as Anki-compatible TSV.

## Features

- **Decks** — create, rename, delete; per-deck card counts and "due" badges
- **Cards** — front/back editor, per-card delete, next-due labels
- **Study mode** — 3D flip animation, click or "Show answer", then self-grade:
  - **Again** — card re-queues later in the same session, ease decreases
  - **Hard / Good / Easy** — SM-2-style intervals (ease ±, interval × ease)
- **Due scheduling** — cards due now appear first; new cards are always available
- **Anki TSV export** — one click downloads `front<TAB>back` per line; import into Anki via **File → Import**, set field separator to **Tab**
- 100% offline — everything lives in `chrome.storage.local` on your device

## Install (Chrome / Edge / Opera)

1. Unzip `flashcard-anki-deck-creator.zip` anywhere
2. Go to `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the unzipped folder
5. Pin the CardForge icon to your toolbar

## Firefox

Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`. Temporary add-ons are removed on browser restart; permanent install requires signing via addons.mozilla.org.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist your decks and scheduling data on-device. No network access is requested or used. |

## Privacy

No accounts, no analytics, no network calls. Your cards never leave your browser.

## Publishing notes

- Manifest V3, no remote code, no external assets
- Minimal single permission (`storage`) — straightforward privacy review
- Screenshots: capture the Decks list, the card editor, and Study mode at 1280×800
