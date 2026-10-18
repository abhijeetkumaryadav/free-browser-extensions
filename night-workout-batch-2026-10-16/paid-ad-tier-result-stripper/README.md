# Paid Ad Tier Result Stripper

A user-triggered, fully reversible tool that flags **paid-ad result cards** on
search pages and collapses them — with per-item reasons and one-click restore.

## What it does

- Click **Scan & collapse ads** → a read-only heuristic scanner runs in the
  active tab and flags result cards with ad-tier signals:
  - visible `Ad` / `Sponsored` / `Promoted` labels (short text, ≤ 40 chars)
  - ad-labeled attributes (`aria-label`, `data-ad`, `data-sponsored`, sponsored classes)
  - ad/tracking URLs (`aclk`, `doubleclick`, `gclid=`…)
  - sponsored phrasing patterns
- Flagged cards are **collapsed (hidden), never deleted** — original `display`
  values are stashed per node.
- The popup lists every flagged item with a per-item **"why"** reason.
- **Restore all** puts every hidden card back exactly.
- A lifetime stripped counter is kept in `chrome.storage.local`.

## Honest scope

> **Heuristic, your choice, reversible.** The scanner uses bundled heuristics and
> can miss real ads and misfire on organic results — review the flagged list.
> Nothing runs until you click. No network calls. 100% local.

## Files

- `manifest.json` — Manifest V3; permissions: `storage`, `activeTab`, `scripting`
  (click-only injection, no host permissions).
- `content.js` — read-only scanner + collapse/restore engine (boot-once guard).
- `popup.html` / `popup.css` / `popup.js` — 380px deep-dark glassmorphism popup,
  single coral-red accent, Lucide-style outline icons.
- `icons/icon{16,48,128}.png` — generated icons.
- `paid-ad-tier-result-stripper.zip` — packaged build with `manifest.json` at
  ZIP root.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open any search page, click the extension icon, then **Scan & collapse ads**.
