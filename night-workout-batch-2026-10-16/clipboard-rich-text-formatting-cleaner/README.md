# Paste Clean — Clipboard Formatting Cleaner

Strip formatting from pasted text. Click **Clean clipboard now**: the extension
reads your clipboard, strips all formatting (tags, entities, excess whitespace),
and copies the clean text back — ready to paste anywhere without weird fonts or
styles.

## Honest scope

- **Local only.** Nothing leaves your machine; there is no network and no
  server. Clipboard access stays inside the extension popup.
- Three cleaning modes:
  - **Plain text** — keep paragraphs, collapse excess blank lines
  - **Single line** — collapse everything to one line
  - **Tight lines** — collapse 2+ blank lines, drop leading blanks
- History of the last 50 cleaned clips (truncated to 2,000 chars), with
  re-copy and delete, stored in `chrome.storage.local`.
- Note: the browser/OS can deny clipboard access; the extension reports the
  error instead of failing silently.

## Permissions

- `clipboardRead` / `clipboardWrite` — read and rewrite clipboard text.
- `storage` — clip history.

## Files

`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `README.md`, icons.
