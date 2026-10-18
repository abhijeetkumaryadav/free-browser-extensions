# LazyLoad Validator

An on-demand audit of lazy-loading hygiene on the current page.

## What it does

- Click **Scan this page** to audit every `<img>` and `<iframe>` on the active tab
- Detects:
  - **Below-the-fold elements missing `loading="lazy"`** (error)
  - **Eager-loaded huge images** > ~2MP (warning)
  - **Missing `loading`/`decoding` attributes** (warning)
- 0–100 score, stat tiles, severity-filtered findings list, and plain-language fix guidance per finding
- Last scan persists locally; results cleared with one click

## Honest scope

- **Read-only analysis** of the current page only — the extension never modifies pages
- **Heuristic checks**: fold position is estimated from viewport + element geometry at scan time; "huge" is a rough pixel estimate; images that haven't loaded yet may be under-measured
- Can miss (lazy-loaded via JS frameworks) and misfire (intentional hero images)
- 100% local — zero network requests, no data leaves this device

## Permissions

- `activeTab` + `scripting` — inject the audit script only when you click Scan
- `storage` — remember your last scan

## Install

1. Open `chrome://extensions`, enable **Developer mode**
2. **Load unpacked** → select this folder (or drag in the `.zip`)
