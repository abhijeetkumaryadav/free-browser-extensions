# Transcript Paragrapher — YouTube Paste Formatter

Paste a YouTube transcript (from the video's "Open transcript" panel) and get it back as clean,
timestamped paragraphs with per-paragraph notes, copy, and `.txt` export.

## What it is

A manual transcript **formatter** for pasted text. You copy the raw transcript from YouTube
yourself, paste it in, and the extension splits it into timestamped paragraphs you can annotate.

## What it is NOT (labeled honestly in the popup)

- **No transcript fetching** — it cannot pull a transcript from YouTube for you.
- **No translation** — it does not translate anything. There is no machine-translation API
  available to extensions in this environment.

## Usage

1. Open a YouTube video → "..." → **Open transcript**.
2. Copy the transcript text.
3. Paste it into the extension's textbox.
4. Click **Format into paragraphs**.
5. Add optional notes per paragraph, then **Copy** or **Export .txt**.

## Privacy

- 100% local. No network calls, no accounts.
- Your pasted draft and notes stay in `chrome.storage.local`.

## Development

- `formatter.js` is dependency-free and unit-testable (`module.exports` included).
- Manifest V3, `storage` permission only.
