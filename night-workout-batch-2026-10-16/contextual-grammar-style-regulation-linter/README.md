# Style Lint — Rule-Based Writing Checker

A heuristic writing-style checker. Paste text (or grab the focused input on the
active tab) and it flags surface patterns with plain-language explanations.

## Honest scope

- **Rule-based only — not AI.** There is no grammar engine and no language model.
  It matches bundled patterns and explains each one; **you** decide what to change.
- Flags are suggestions, not corrections. A clean pass doesn't mean perfect prose.
- The page is never modified. "Grab active input" only *reads* the focused field.
- 100% local — no network calls, no text leaves your machine.

## Bundled rules

1. **Double spaces** — two or more spaces in a row.
2. **Repeated words** — "the the" and similar slips.
3. **Common homophone slips** — their/there/they're, your/you're, its/it's, to/too/two, then/than, affect/effect, principal/principle, compliment/complement.
4. **Passive-voice patterns** — "was written", "is being done" (may be fine; review in context).
5. **Weasel / filler words** — very, really, just, actually, basically, literally…
6. **Very long sentences** — over ~35 words.

## Permissions

- `storage` — remembers the last check summary only.
- `activeTab` + `scripting` — reads the focused input on click only.

## Files

`manifest.json` · `popup.html` · `popup.css` · `popup.js` (rule engine) ·
`content.js` (read-only active-input grabber) · `icons/`
