# Canvas Pixel Locator

Defensive privacy scanner (v1.0.0). On demand, it scans the active page for
tracking indicators:

- **Canvas fingerprinting signs** — hidden/tiny canvases (≤32px, off-screen, or
  `display:none`), plus live hooks on `getImageData`/`toDataURL` during the scan
  window that flag pixel reads from small canvases.
- **Hidden tracking pixels** — 1×1 / tiny / hidden images and images with
  pixel/beacon/track-style filenames.
- **Known tracker endpoints** — third-party resource requests matched against a
  bundled **sample** list of well-known tracker domains.

Results are a 0–100 privacy score with severity-tagged findings and
plain-language explanations, plus practical next steps (content blockers,
third-party cookie settings).

## Honest scope

This is a **heuristic, defensive** tool:

- Findings are *indicators*, not proof. Hidden canvases can be legitimate
  (thumbnails, offscreen rendering); pixel reads can be fraud prevention.
- The tracker-domain list is a sample — the real ecosystem is far larger, so
  misses are expected.
- Live pixel-read hooks only catch calls made during/after the scan; reads that
  happened at page load are not observable after the fact.
- It never blocks anything and never contacts any server. 100% local.

## Permissions

- `storage` — remember the last scan summary.
- `activeTab` + `scripting` — inject the scanner into the page you explicitly
  ask to scan (MAIN world, so canvas hooks observe the page's own scripts).

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup UI
- `content.js` — the on-demand scanner (runs in page MAIN world)
- `icons/` — generated PNG icons (16/48/128)

## Development build

Not tested in a live browser. Validated: manifest parses, `node --check` on all
JS, icons generated, `manifest.json` at ZIP root.
