# Bionic Formatter — Bold-First-Half Text

**Heuristic formatting — not a font.** Pastes your text and bolds the first portion of each word (bionic-reading style) using plain HTML `<b>` tags. Preview it, copy the HTML, or download a standalone `.html` file.

## What it does

- **Three fixation modes** — Auto (1–4 bold chars scaled by word length), Fixed half (`ceil(len/2)`), Fixed third (`ceil(len/3)`).
- **Safe by construction** — all input is HTML-escaped before bolding; punctuation, whitespace, and line breaks are preserved verbatim.
- **Copy HTML** to paste into any editor, or **download** a styled standalone `.html` page.
- **Remembers** your last text and mode locally via `chrome.storage.local`.

## Honest limits

- This is a formatting trick, not a font and not a reading intervention. It makes no claims about reading speed or comprehension.
- One-letter words and pure numbers are left untouched.

## Privacy

Everything runs locally in the popup. Nothing is uploaded or transmitted.

## Permissions

- `storage` — remember your last text and fixation mode.
