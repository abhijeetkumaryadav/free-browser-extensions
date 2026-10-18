# Ingredient Allergen Highlighter

Highlight your watched allergens inside ingredient lists on any page — on your click only, fully reversible.

## What it does

- **Scan this page** — injects a read-only scan engine on the active tab and highlights keyword matches
  **only inside ingredient-like text** (blocks mentioning "ingredients", or comma-separated lists with 3+ commas).
- **Watched allergens** — ships with 17 common allergens (milk, eggs, peanuts, tree nuts, soy, wheat, fish,
  shellfish, sesame, mustard, celery, lupin, sulfites, gluten, almonds, walnuts, cashews). Toggle each on/off,
  add your own custom allergens (removable).
- **Clear** — one click unwraps every highlight mark, restoring the page exactly.

## Honest scope

- **Heuristic keyword matching only.** It cannot detect ingredients by chemistry, image, or menu descriptions.
  It can miss allergens and it can misfire (e.g. "milk" inside "milkweed").
- **Always read the label yourself.** This tool is a convenience highlighter, **not medical advice**.
  If you have allergies, follow your doctor's guidance.
- Nothing runs until you click. Everything is local — no network calls, no analytics.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open a page with an ingredient list, click the toolbar icon, and hit **Scan this page**.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest (permissions: `storage`, `activeTab`, `scripting`) |
| `popup.html` / `popup.css` / `popup.js` | 380px deep-dark glassmorphism UI + allergen list manager |
| `content.js` | Page-side scan/highlight engine (boot-once, message-driven) |
| `icons/` | Generated PNG icons (16/48/128) |
| `README.md` | This file |

## Privacy

All allergen preferences stay in `chrome.storage.local` on your device. The extension never contacts the network.
