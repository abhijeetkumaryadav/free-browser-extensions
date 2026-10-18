# Jargon Highlighter — My Glossary Simplifier

Paste text and see your own glossary terms highlighted inside it, with your plain-language definitions shown below. A personal jargon notebook for methodology-heavy reading.

## Honest scope

**Your glossary — not AI.** There is no AI here and nothing is "simplified" for you:

- You define every term and every definition yourself (or load the editable starter set).
- Matching is a plain case-insensitive word-boundary scan — it cannot understand context, sarcasm, or polysemy.
- The extension makes **zero network calls**; everything lives in `chrome.storage.local`.

## Features

- Scan tab: paste up to 20,000 chars, get highlighted terms plus per-term definition cards.
- Glossary tab: add/edit-free term list, search across term/definition/note, per-term delete.
- Add tab: term + plain-language definition + your note; duplicate-term guard; 500-term cap.
- Load starter glossary (5 methodology terms you can edit/delete freely).
- Export / import JSON backup; clear-all with confirm.

## Files

- `manifest.json` — MV3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js`
- `icons/` — generated PNG icons (16/48/128)
- `README.md`

## Test

Headless engine tests cover term creation, regex escaping, word-boundary and
overlap-resolution matching, HTML escaping, filtering, import validation, and
the starter glossary. Extract the code between `// ENGINE-START` and
`// ENGINE-END` in `popup.js` and run with node.
