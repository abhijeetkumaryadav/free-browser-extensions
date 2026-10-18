# Vocab Quiz Generator

Generates vocabulary-in-context quizzes from **your own pasted text** — no AI, no network, fully local.

## What it does
- Paste any reading passage (needs at least 3 sentences).
- **Fill-in-the-blank** questions: a content word (longest non-stopword) is blanked out of a sentence; type the missing word.
- **Word-match** questions: given a word, pick which of 3 sentences it appears in.
- Deterministic, seeded question generation; **Check score** grades everything instantly.
- Caches your last pasted text locally for convenience.

## Honest scope
This is a **heuristic tool, not AI comprehension**. It blanks and matches words mechanically — it makes no grammar or meaning judgments, and a generated quiz is only as good as the text you paste. Nothing is uploaded anywhere.

## Files
`manifest.json`, `popup.html`, `popup.css`, `popup.js` (quiz engine between `ENGINE-START`/`ENGINE-END` markers — headless-testable), `README.md`, `icons/`.
