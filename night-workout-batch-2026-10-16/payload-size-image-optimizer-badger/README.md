# Payload Badger — Image Weight Auditor

On-demand image payload audit for the page you're viewing. Lists every image with its
transfer size, natural dimensions, format, and flags oversized or unoptimized images
with **approximate** savings estimates and format suggestions (WebP/AVIF).

## Honest scope

- **Read-only.** The page is never modified; only measured.
- **Sizes:** transfer size comes from the Resource Timing API when the browser
  recorded it; otherwise a decoded-bytes estimate is used and labeled **(estimated)**.
- **Savings estimates are approximate** — real WebP/AVIF savings depend on image
  content. Treat the "≈" figures as guidance, not guarantees.
- 100% local — no network requests beyond what the page itself already made.

## Features

- 0–100 page weight score with a verdict (Lean & mean → Payload heavy)
- Per-image cards: dimensions, format, measured/estimated bytes, issue flags
- Flags: **Oversized** (served much larger than displayed) and **Old format** (JPEG/PNG/GIF → WebP)
- Filters (All / Oversized / Old format) and JSON export
- Last scan persists locally

## Permissions (minimal)

- `activeTab` + `scripting` — inject the measuring script on click only
- `storage` — persist the last scan locally

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI and audit logic
- `content.js` — on-demand page measurement script
- `icons/` — 16/48/128 PNG icons
