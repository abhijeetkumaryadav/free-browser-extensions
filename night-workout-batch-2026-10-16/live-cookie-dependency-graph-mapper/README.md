# Cookie Dependency Graph Mapper

A **read-only developer/privacy visualization** of the cookie graph on the current page.

## How it works

1. Click **Scan this page** — a data collector is injected into the active tab (explicit click only).
2. The collector reads `document.cookie` **names only** (values are never touched) and the hostnames of scripts, iframes, images and stylesheets on the page.
3. The popup filters the browser's cookie jar down to cookies relevant to this page and renders a radial dependency graph: page → domains → cookies.
4. Click any cookie node for details (domain, path, httpOnly, Secure, SameSite, expiry). Click a domain node for context.

## Honest scope

- **Values are never read.** Only cookie names, flags, domains and expiries are used.
- **Script→cookie attribution isn't reliably available** to extensions, so the graph does not claim which script set which cookie. Scripts present on the page are listed for context.
- Third-party cookies are detected heuristically: a cookie whose domain appears among the page's subresource hosts but outside the page's own domain tree.
- Read-only: the page is never modified. 100% local, zero network.

## Permissions (justified)

- `cookies` + `<all_urls>` host permission — required to read the cookie jar across domains for the graph.
- `activeTab` + `scripting` — inject the collector into the tab you explicitly scan.
- `storage` — remember the last scanned host label.

## Files

- `manifest.json` — Manifest V3
- `graph.js` — pure grouping/layout logic (unit-testable, no DOM)
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup, SVG graph
- `icons/` — generated PNG icons
