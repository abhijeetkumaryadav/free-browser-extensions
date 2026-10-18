# ReadGauge — Reading Time & Difficulty Estimator

Analyzes the current page's text (or selected text) into:

- **Estimated reading time** — word count ÷ 225 words/min.
- **Difficulty index** — a Flesch-style Reading Ease score (0–100) from average
  sentence length and syllables per word, with a plain-language band verdict
  ("Standard — plain adult reading", "Difficult — academic style", …).

> Heuristic estimates — not exact. Syllable counting is approximate and
> reading speed varies by person and text.

## Features

- **Analyze this page** — extracts the article/main content (falls back to
  cleaned body text) on explicit click only.
- **Context menu** — right-click selected text → *Analyze reading time of selection*.
- Animated ease gauge, reading time, word/sentence counts, avg sentence length.
- 100% local — extracted text never leaves the device; no network calls.

## Scope limits

- Cannot analyze browser-internal pages (`chrome://…`) — guarded.
- Scores are educational heuristics, not literacy assessments.

## Permissions

- `activeTab` + `scripting`: extract page text on explicit click.
- `storage`: pass the context-menu result to the popup.
- `contextMenus`: right-click analysis of selections.
