# Recipe Clutter Remover v1.0.0

Open any recipe page and hit **Extract recipe**. The extension reads
the page's recipe markup (JSON-LD or microdata) and shows the recipe
— title, photo, prep/cook/total times, servings, ingredients, method,
nutrition when available — in one clean, clutter-free card.

Includes a **Copy ingredients** button and a **print-friendly view**
that opens in a new tab and triggers printing. Extraction is
best-effort and labeled as such; always sanity-check against the
original page.

## Try it
1. Unzip `recipe-clutter-remover.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Open a recipe page (e.g. any major food blog) → click the icon → **Extract recipe**.

## Permissions
- `activeTab` + `scripting` — read the recipe markup from the page you are viewing.
- `storage` — remembers your last extraction locally.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee.
- Firefox: same MV3 build works via `about:debugging` → Load Temporary Add-on.
