# Origami Mesh Folder

A harmless visual toy for Chrome, Edge, Firefox, and Opera (Manifest V3).

## What it does

Folds the current page's blocks like origami paper with 3D CSS transforms.
Three fold styles — **Crane** (fold-up), **Accordion** (alternating zebra
folds), and **Spiral** (twist-and-shrink) — plus fold-depth and stagger-delay
controls. Folded blocks get a violet "crease" highlight for the paper look.

## Honest scope

- **Toy only, fully reversible.** Only *inline styles* on existing elements are
  changed (transforms + a crease highlight). The DOM structure is never touched.
- **Unfold** (or a page refresh) restores every saved style exactly — the page
  is precisely as it was.
- Runs only when you click **Fold this page**. Nothing runs in the background,
  nothing is transmitted anywhere, and nothing persists except your style /
  depth / delay settings (stored locally).

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — settings popup
- `content.js` — fold/unfold toy (guarded against double injection)

## Permissions

`storage` (settings), `activeTab` + `scripting` (inject the toy only on the tab
you explicitly click for — never automatically).
