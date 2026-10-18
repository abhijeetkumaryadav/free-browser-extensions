# Dropship Spam Blocker

A one-click heuristic filter for product-listing pages: scans product cards
for **dropship-spam text signals** — countdown timers, “free worldwide
shipping”, inflated ≥70% discounts, was/now strikethrough pricing, urgency
wording (“only 3 left”, “sale ends”) — and dims or hides cards scoring
**3+ points**. Shows the top reasons per flagged card. One click restores
everything exactly.

## Honest scope

- **Heuristic text signals only.** It cannot detect stock-photo reuse or verify
  any seller's claims — it matches wording patterns, so it can miss real spam
  and misfire on legitimate stores. Review every flagged card.
- **Your choice, fully reversible.** Nothing runs automatically; “Restore page”
  undoes everything.
- **100% local.** No network calls, no analytics, no data leaves your browser.

## How to use

1. Open a product-listing page.
2. Click the extension icon → **Scan & flag**.
3. Flagged cards are dimmed (or hidden, per your setting) with a count and top
   reasons in the popup.
4. Click **Restore page** to undo.

## Permissions

- `storage` — remembers your dim/hide mode.
- `activeTab` + `scripting` — injects the scanner only when you click the
  button. No host permissions, no always-on content script.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — the popup UI
- `content.js` — page-side scan/score/dim/restore engine (boot-once, message-driven)
- `icons/` — generated PNG icons (16/48/128)
