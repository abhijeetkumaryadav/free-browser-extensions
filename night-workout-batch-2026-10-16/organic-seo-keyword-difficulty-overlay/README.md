# On-Page SEO Checklist

An educational on-page SEO checklist for the keyword **you** type.

**Honest scope — read first:**
- There is **no keyword database, no search-volume API, and no ranking data** in this extension.
- "Analyze this page" runs nine **heuristic pattern checks** (title, meta description, H1, subheadings, URL slug, body mentions, content length, image alt text, readability) against your keyword.
- The score is a learning aid about on-page basics — **NOT keyword difficulty, NOT a ranking prediction**.

## How it works

1. Type your target keyword.
2. Click **Analyze this page** — a read-only extractor runs on the current tab (click-only, `activeTab`).
3. Each check passes/fails with plain-language tips for the failures.
4. Weights: title 20 · H1 15 · meta/subheads/URL/mentions/length/readability 10 each · images 5.

## Privacy

- 100% local. No network requests, no analytics.
- Only permission storage: remembers your last keyword.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI
- `analyzer.js` — dependency-free scoring logic (unit-testable in Node)
- `content.js` — read-only page data extractor (injected on explicit click)

## Permissions

- `storage` — remember last keyword
- `activeTab`, `scripting` — read the current tab's headings/text on explicit click
