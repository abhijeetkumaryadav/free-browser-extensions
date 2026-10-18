# RenderLens — Render-Blocking Audit (v1.0.0)

Audit any web page for render-blocking scripts and stylesheets, with plain-language fix suggestions the site owner could apply. **Read-only** — the extension never modifies pages and never sends data anywhere.

## What it does

- Click **Scan this page** — the extension inspects the active tab's `<script src>` and `<link rel="stylesheet">` elements plus the Resource Timing API.
- Synchronous scripts in `<head>` and non-`media`-switched stylesheets are flagged **blocking**; async/defer/module scripts are marked **ok**.
- Each resource shows transfer size and network duration, with suggestions like "Add defer or async" or "Inline critical CSS".
- A **Clean / Fair / Heavy** grade summarizes the page, plus first-byte, DOMContentLoaded and load timings.
- Filters: All · Blocking · Scripts · Styles. The last scan is remembered for convenience.

## Honest scope

An extension cannot reorder a site's scripts or change how it loads — this is a **diagnostic audit**, not an optimizer. Only the site owner can apply the fixes.

## Install

1. Unzip `critical-path-script-preemptor.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read the active tab's URL and run the scanner only on the tab you click on |
| `scripting` | Inject the read-only scanner into the active tab on user click |
| `storage` | Remember your last scan result locally |

No host permissions, no background page, no network calls, no analytics.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Store listing: Performance / developer-tools category. Privacy: "No data collected."
