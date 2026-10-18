# Thesis Structure Checker — Heuristic Argument Linter

**Heuristic checks — not logical analysis.** Paste a thesis statement and get
four plain-language structure checks:

- **Claim signal** — does the text carry a position (should, because, argue…)?
- **Evidence markers** — does it promise support (data, studies show…)?
- **Hedge-word density** — how much of it is softened by might/perhaps/possibly?
- **Length check** — under ~12 words or over ~60 words is flagged.

A 0–100 structure score is shown. All checks are simple word-list heuristics
in `popup.js` between `// ENGINE-START` and `// ENGINE-END`. They count
patterns; they judge nothing and cannot detect real logical flaws. Use your own
reasoning.

Includes an explainer guide tab and autosaved private notes. Everything is
local (`storage` permission only); no network calls.
