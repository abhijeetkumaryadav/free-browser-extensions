# Sentiment Signal Gauge — Emotional Tone Scanner

Paste any text and get two things:

1. **Sentiment score (−100…+100)** — weighted positive/negative word hits per 100 words, shown on an arc gauge with a verdict (Strongly positive → Strongly negative).
2. **Manipulation signals** — counts of loaded language, false urgency, fear/threat cues, flattery/in-group praise, and shouting style (exclamation density, ALL-CAPS), each with a plain-language note.

A signal guide tab explains what each metric counts. A notes tab stores your own observations locally.

## Honest limits

**Heuristic signals — not psychological analysis.** This is weighted word counting, nothing more. It cannot see context, sarcasm, irony, cultural meaning, or intent. A high "loaded language" count is rhetorical heat, not proof of manipulation. A positive sentiment score does not mean something is true or trustworthy.

## Privacy

Fully local. `storage` permission only, for your notes and last pasted text. No network calls, no uploads.

## Install

Chrome/Edge/Firefox: `chrome://extensions` → Developer mode → Load unpacked → select this folder.
