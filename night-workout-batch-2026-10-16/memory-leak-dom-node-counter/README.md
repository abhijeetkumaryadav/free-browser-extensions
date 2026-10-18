# DOM Node Counter — Memory Leak Hint

**Honest scope:** Counts DOM nodes on the current tab and tracks growth across
samples. Node growth **suggests** something is adding elements — it does **not**
diagnose memory leaks. Detached (leaked) DOM trees are invisible to a page-side
counter; real leak diagnosis needs DevTools heap snapshots.

## What it does

- **Sample this tab** (click-only injection): counts every element, records the
  total, timestamp, and top 10 tags by count
- Per-tab sample history (last 30), with a growth delta since the first sample
- Top-tag bar chart to see which elements dominate the page
- Clear history per tab

## How to read it

- Steady upward growth while the page sits idle may hint at a leak — or just
  dynamic content (ads, feeds, live widgets).
- To confirm a leak, use Chrome DevTools → Memory → heap snapshots.

## Files

- `manifest.json` — MV3, permissions: `storage`, `activeTab`, `scripting`
- `content.js` — boot-once node counter (message-driven)
- `popup.html` / `popup.css` / `popup.js` — dashboard UI
- `icons/` — generated PNG icons

## Load it

1. `chrome://extensions` → Developer mode → Load unpacked → select this folder.
2. Open any page, click the toolbar icon, hit **Sample this tab**.
