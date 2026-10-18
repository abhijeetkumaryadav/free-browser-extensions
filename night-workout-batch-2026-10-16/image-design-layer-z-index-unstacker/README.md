# Z-Index Unstacker

Inspect the stacking order of the current page: which elements are positioned,
what their `z-index` values are, which ones create **stacking contexts**, and
their on-screen boxes. Click any row to highlight and jump to that element.

## What it does

- **Scan this page** — on-demand, click-only scan of positioned elements.
- List sorted by explicit z-index (descending), then `auto`.
- Stats: positioned count, explicit-z count, stacking-context count.
- Filter by tag/class/id; "positioned only" toggle.
- Click a row → element is outlined and scrolled into view.
- **Clear highlight** removes the outline. Last scan persists locally.

## Honest scope

- **Read-only dev analysis.** The page is never modified except the temporary
  highlight outline, which is fully reversible.
- Stacking-context detection uses a well-known heuristic subset
  (positioned + z-index ≠ auto, opacity < 1, transforms, filters, isolation);
  edge cases of the full CSS spec are approximations.
- 100% local — zero network.

## Permissions

- `storage` — persist the last scan.
- `activeTab` + `scripting` — inject the scanner into the current tab only,
  and only when you click Scan.

## Privacy

Nothing leaves your browser.
