# Clickbait & Bias Meter

On-demand heuristic scan of page headlines for clickbait and bias signals. A media-literacy aid — **not a truth verdict**.

## What it does

Click **Scan this page** and the extension extracts headlines (h1–h3, article titles) from the active tab and scores each 0–100 against local heuristic signal lists:

- **ALL-CAPS shouting** — >70% uppercase letters
- **Excessive punctuation** — multiple `!` / `?`, suspense ellipses
- **Sensationalist phrasing** — "you won't believe", "shocking", "exposed", "leaked", …
- **Loaded language** — emotionally charged words ("outrageous", "corrupt", "destroyed", …)
- **Urgency pressure** — "act now", "last chance", "breaking news", …
- **Number-bait listicles** — "7 things…"
- **Curiosity gaps** — "you" + question words teasing withheld info

Each headline gets a score bar, severity tag (LOW / MODERATE / HIGH), and a per-signal explanation. A page-level average with a plain-language verdict is shown at the top.

## Honest scope

This is **pattern matching, not analysis**. It cannot tell you whether a claim is true or false, it does not understand context or satire, and its word lists are general English heuristics that can miss and misfire. Treat every score as a prompt to read critically, never as a verdict.

## Permissions

- `storage` — remembers your last scan
- `activeTab` + `scripting` — injects the headline scanner only when you click **Scan this page**

No network calls. Nothing leaves your device.

## Install

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder (or drag in the `.zip`)
3. Pin the extension, open any news/article page, click **Scan this page**

## Publishing notes

- Manifest V3, no remote code, no data collection — store-friendly
- Screenshots: popup on a news homepage showing scored headlines
