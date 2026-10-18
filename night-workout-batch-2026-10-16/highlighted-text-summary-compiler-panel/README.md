# Highlight Compiler — Heuristic Summary Panel

Save text highlights and compile a **heuristic** summary: the top sentences
ranked by word-frequency scoring. Fully local, zero network.

## Honest scope

- The summary is a simple word-frequency ranking — **not AI summarization**.
  It cannot understand meaning, sarcasm, or context.
- Everything is stored in `chrome.storage.local`. Nothing leaves your device.

## Use

1. **Add** — paste a highlight, optionally name its source, save it.
2. **Highlights** — search your saved highlights, delete one, export as
   Markdown, or clear all.
3. **Summary** — pick how many top sentences you want, hit "Compile summary".
   Top-ranked sentences are shown in their original order so they read
   naturally.

## Files

- `manifest.json` — MV3 manifest, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — UI + heuristic engine
- `icons/` — generated PNG icons

## Permissions

- `storage` — saves your highlights locally.
