# Furigana Inserter — Your Kanji Pairs

Adds furigana (reading) annotations to kanji on any web page — **only for the kanji → reading pairs you add yourself**.

1. Add pairs like `日本語` → `にほんご`.
2. Click **Insert on this tab** — matching text is wrapped in `<ruby>` tags with your readings.
3. Click **Remove** to unwrap everything and restore the page.

## Honest scope

This is **not automatic furigana**: it cannot parse Japanese or guess readings. It only annotates the exact pairs you supply. The page DOM is never destructively modified — insertion wraps text nodes, removal unwraps them.

## Privacy

Pairs are stored in the extension's own local storage. Nothing is sent anywhere.

## Files

- `manifest.json` — MV3, `storage` + `activeTab` + `scripting` (click-only injection)
- `popup.html` / `popup.css` / `popup.js` — pair manager UI
- `content.js` — page-side wrapper (idempotent, message-driven)
- `icons/` — generated PNG icons (16/48/128)
