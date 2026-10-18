# Text Cleaner → Markdown

Paste messy text (or load a `.txt` file) and convert it to clean Markdown.

## What it does

- **Cleanup**: converts smart quotes/dashes to plain ASCII, normalizes line endings, strips trailing whitespace, collapses excess blank lines.
- **Heading detection**: short, title-case standalone lines become `#` headings (heuristic — not always right).
- **Preview + copy + download**: preview the Markdown, copy it, or download a `.md` file.
- **Notes tab**: local scratch notes (stored in `chrome.storage.local`).

## What it does NOT do

**It does not parse PDF or MOBI files.** PDF/MOBI extraction needs a dedicated converter
with a real document parser; this tool is text-only cleanup.

## Privacy

Everything runs locally. No network requests. Notes and last input stay in your browser.
