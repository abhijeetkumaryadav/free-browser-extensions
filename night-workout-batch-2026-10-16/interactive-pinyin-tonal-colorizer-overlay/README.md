# Tone Colorizer — Pinyin Pair Highlighter

Color your own hanzi→pinyin pairs by tone on any web page. 100% local — nothing leaves your browser.

## What it does
- **Add pairs:** enter hanzi and pinyin (use tone numbers, e.g. `ni3 hao3`). Pairs persist locally.
- **Color on this tab:** injects once and wraps every match in a colored span — 1st tone red, 2nd orange, 3rd green, 4th blue, neutral gray. Hover a colored word to see your pinyin. Longest-match wins.
- **Remove coloring:** unwraps everything, restoring the original text.

## Honest scope
**Your pairs — not automatic pinyin.** The extension cannot parse Chinese and guesses nothing — it only highlights the exact hanzi you entered. Tone comes from the tone number in *your* pinyin.

## Privacy
- Pairs live in `chrome.storage.local` only. Injection happens only when you press the button. Zero network requests.

## Files
- `manifest.json` — Manifest V3 (permissions: `storage`, `activeTab`, `scripting`)
- `popup.html` / `popup.css` / `popup.js` — UI (engine between `// ENGINE-START` … `// ENGINE-END`)
- `content.js` — matcher + injector (pure engine between `// ENGINE-START` … `// ENGINE-END`); auto-runs on injection
- `icons/` — 16/48/128 PNG icons
