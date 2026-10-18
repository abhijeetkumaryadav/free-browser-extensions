# ImgAudit — Broken Image & Alt Text SEO Audit

On-demand SEO audit of images on any page: **broken images**, **missing/empty/non-descriptive alt text**, **oversized images**, and **missing width/height attributes** (layout-shift risk).

## How it works

1. Click **Scan this page** — a content script is injected on demand (`activeTab` + `scripting`).
2. Every `<img>` is inspected read-only; the popup shows a 0–100 score, stat tiles, and per-image findings with fix guidance.
3. **Export JSON** downloads the full report.

Findings are heuristic: e.g. decorative images legitimately use `alt=""` — review before changing anything.

## Scoring

Start at 100; −8 per error, −3 per warning, floored at 0.

## Permissions

- `activeTab` + `scripting` — inspect images on the page you're viewing, only when you scan
- `storage` — remember the last report

Read-only: the page is never modified.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open any page, click ImgAudit, and scan.

## Honest scope

- Cannot measure actual file bytes without downloading; "oversized" is based on natural pixel dimensions.
- Broken detection relies on the browser's load state at scan time.
- Not tested in a live browser; validation covered manifest parsing, JS syntax, icon generation, and packaging.
