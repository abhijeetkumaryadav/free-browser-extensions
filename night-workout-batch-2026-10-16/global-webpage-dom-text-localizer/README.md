# Localize This Page — Your Translations

**Honest scope: applies only the find→replace text pairs YOU define. There is no machine translation in this extension — nothing is translated automatically.**

## What it does

1. Add find→replace pairs in the popup (e.g. `Add to cart` → `In den Warenkorb`).
2. Click **Apply to this page** — the extension rewrites the page's visible text nodes using your pairs (longest matches first).
3. Click **Restore page** to revert every change exactly, or just reload the tab.

## Notes

- Your pairs are stored in `chrome.storage.local` — 100% local, zero network.
- Only runs when you click a button; it never touches pages on its own.
- Cannot run on internal pages (`chrome://`, Web Store, etc.) — Chrome forbids script injection there.
- Literal string matching only (no regex), so special characters are safe.
- Original text is stashed per element and restored node-by-node.

## Files

- `manifest.json` — MV3, permissions: `storage`, `activeTab`, `scripting`
- `popup.html` / `popup.css` / `popup.js` — pair manager + injector
- `icons/` — 16/48/128 PNG icons

## Development

Load `chrome://extensions` → Developer mode → "Load unpacked" → select this folder.
