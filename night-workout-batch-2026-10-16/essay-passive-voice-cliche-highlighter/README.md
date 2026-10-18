# Essay Clarity Checker

> Scope, stated plainly: **all checks are heuristics** — pattern matching on text, not grammar understanding. Every flag should be reviewed by a human. This is a writing assistant, not a proofreader.

## What it does

Two ways to analyze text:

1. **Analyze this page** — injects a reader into the active tab (only when you click), extracts the main article text, and checks it.
2. **Paste text** — paste essay text directly; analysis runs as you type.

Checks:

- **Passive voice** — "be"-verb + past participle constructions (covers -ed verbs *and* a bundled list of irregular participles like "written", "shown", "taken").
- **Clichés & weak phrases** — bundled ~40-item list ("at the end of the day", "could of", "irregardless"…), matched with word boundaries so punctuation doesn't hide them.
- **Long sentences** — sentences ≥ 30 words.
- **Heavy hedging** — sentences with 2+ stacked hedge words ("very", "quite", "rather"…).

Each flagged category includes a plain-language tip. Summary counts up top.

## What it does NOT do

- It does **not** understand grammar — it can miss real issues and flag false positives (e.g. "was tired" is not passive voice).
- It does **not** fix anything automatically — nothing is ever written to your document.
- It does **not** send your text anywhere. All analysis runs in the popup, locally.

## Privacy

No network calls, no accounts. Pasted text never leaves the popup; page text is read only after your explicit click.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`storage`, `activeTab`, `scripting`) |
| `popup.html` / `popup.css` / `popup.js` | UI + wiring |
| `analyzer.js` | Dependency-free analysis logic (unit-tested with node) |
| `content.js` | Read-only text extractor, injected on click only |
| `icons/` | 16/48/128 PNG icons |

## Build / validation

- `node --check` on all JS files — passes
- Analyzer unit tests (node): passive ×2, clichés ×2, long sentence, hedge stack — **passed**
- `manifest.json` parses as JSON, Manifest V3
- ZIP built with `manifest.json` at root

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder, or drag in the `.zip` release.
