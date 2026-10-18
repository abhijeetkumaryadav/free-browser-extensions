# Foreign Word Substituter

Language-learning word swapper. 100% local — no network, no analytics.

## What it does

1. Add your own **word → translation** pairs (e.g. `Haus` → `house`).
2. Click **Apply to this tab** — every occurrence on the active page becomes an
   inline `word (translation)` span with a dotted underline.
3. Click **Restore page** to return the original text exactly.

> **Your pairs — page view only.** The page's source is never changed; only your
> view is altered, and restore puts the original text back. Script/style blocks,
> form fields, and editable regions are never touched.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest (`storage`, `activeTab`, `scripting`) |
| `popup.html` / `popup.css` / `popup.js` | Pair manager UI + click-only injection driver |
| `content.js` | Page engine: `apply(pairs)` / `remove()` |
| `icons/` | Generated 16/48/128 PNG icons |

## Permissions

- `storage` — saves your word pairs locally.
- `activeTab` + `scripting` — injects the engine only when you click Apply/Restore.

## Privacy

Pairs stay in `chrome.storage.local`. Nothing is collected, stored remotely, or transmitted.
