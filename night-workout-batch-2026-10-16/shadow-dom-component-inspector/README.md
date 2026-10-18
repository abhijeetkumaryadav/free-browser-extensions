# Shadow DOM Component Inspector

Dev tool that walks **open** shadow DOM trees on the current tab and lists components in a tree view. Click a node to highlight it on the page.

## What it does

- **Scan this page** — explicit-click scan of the active tab. Walks the DOM, descending into **open shadow roots only**, and records each shadow host's tag name, nesting depth, and `<slot>` count.
- **Tree view** — flat list with depth indentation; each host shows its tag, depth, slot count, and a HOST badge.
- **Click to highlight** — draws a temporary overlay box around the element on the page and scrolls it into view.
- **Clear highlight** — removes the overlay box.

## Honest scope (labeled in the popup)

- **Open shadow roots only.** Closed shadow roots are not inspectable by design — this is a platform limitation, not a bug.
- **Read-only.** The scan never modifies page content; the highlight is a single removable overlay `<div>` (removed by "Clear highlight", or by any page reload).
- **100% local, zero network.** Nothing leaves the popup.
- Injection happens only when you click **Scan this page** (`activeTab` + `scripting`).

## Permissions

- `activeTab` — scan and highlight on the tab you explicitly choose.
- `scripting` — run the read-only collector function.
- `storage` — (reserved for future settings; currently minimal use).

## Files

- `manifest.json` — MV3 manifest.
- `popup.html` / `popup.css` / `popup.js` — UI and logic. `popup.js` contains the three page-side functions (`collectShadowTree`, `highlightNode`, `clearHighlight`) injected via `chrome.scripting.executeScript`.
- `icons/` — generated 16/48/128 PNG icons.
- `README.md` — this file.

## Validation

- `node --check` on `popup.js`.
- `manifest.json` parses, MV3, permissions minimal.
- Not tested in a live browser (development build).
