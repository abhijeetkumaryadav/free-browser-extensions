# Feed Diversity Ticker — Source Variety Counter

Counts distinct domains, sources and authors in the current page's links and embeds, and shows a diversity score.

## Honest scope

- **Counts source diversity — NOT a measure of algorithmic bias.** It cannot see recommendation algorithms, personalization, or ranking. It counts what is on the page.
- The diversity score is a heuristic: the effective number of outbound domains (inverse Simpson index), normalized to 0–100 against a 10-domain ceiling.
- Domain grouping uses a naive last-two-labels rule — approximate for country-code and multi-level TLDs.
- **Click-only.** Nothing runs until you press "Scan this page". Fully local, zero network.

## Features

- Diversity score ring with plain-language verdict (broad / moderate / narrow)
- Link, domain and author counts
- Top-15 source list with per-source share bars
- Author signals: `rel=author` links, meta author, byline-ish elements

## Permissions

- `storage` — reserved for future preferences
- `activeTab` + `scripting` — inject the scanner into the current tab only when you click

## Files

`manifest.json` · `popup.html` · `popup.css` · `popup.js` · `content.js` (scan engine) · `README.md` · `icons/`

## Build

```bash
cd real-time-algorithmic-recommendation-bias-ticker
zip -r real-time-algorithmic-recommendation-bias-ticker.zip manifest.json popup.html popup.css popup.js content.js README.md icons/
```
