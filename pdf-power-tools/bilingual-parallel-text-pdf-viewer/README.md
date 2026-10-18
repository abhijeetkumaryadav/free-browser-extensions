# Parallelo — Bilingual Parallel Text Reader

Read two texts side by side with synchronized scrolling and paragraph-by-paragraph alignment. Ideal for bilingual reading (original + translation), language learners, and translators comparing drafts.

> **Honest scope:** this is a text comparer, not a PDF viewer — it does not extract text from PDFs. Paste or type your two texts (or load a saved pair).

## Features

- **Side-by-side panes** with paragraph alignment by index (separate paragraphs with a blank line)
- **Synced scrolling** (proportional, toggleable) — both panes move together
- **Click a paragraph** to highlight its pair on both sides
- **Adjustable split** (30–70%) and font size (12–20px)
- **Saved text pairs** stored on-device with custom language labels
- 100% offline — no network calls, nothing leaves your device

## Install

1. Download/unzip, then open `chrome://extensions` (Edge: `edge://extensions`; Firefox: `about:debugging#/runtime/this-firefox`)
2. Enable **Developer mode** → **Load unpacked** → select this folder

## Permissions

- `storage` — saves your named text pairs on-device. Nothing else.

## Publishing notes

- Manifest V3, no remote code, no data collection — straightforward for Chrome Web Store / Edge Add-ons review.
- Firefox: MV3 supported in Firefox 109+; `chrome.storage.local` works via the `chrome` namespace.
