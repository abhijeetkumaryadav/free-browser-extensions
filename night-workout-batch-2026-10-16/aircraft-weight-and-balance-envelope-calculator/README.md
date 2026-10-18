# W&B Envelope — Aircraft Weight & Balance

Local weight & balance calculator with CG-envelope plotting.

## What it does
- **Aircraft profile** — enter empty weight/CG and your envelope as ordered
  `weight,cg` corners (a sample 4-seat envelope is built in as a template).
- **Loads** — enter pilot/front pax, rear pax, fuel, baggage weights and arms.
- **Calculate** — computes gross weight, CG, total moment, and whether the
  CG point falls inside the envelope (ray-casting check), with a canvas
  envelope plot and the CG point marked.

## Honest scope
- Estimates only. Always verify against the aircraft's official POH / weight
  & balance documents. Not for flight planning alone.
- Fully local — no network, no accounts. Profile persists in `chrome.storage.local`.

## Permissions
- `storage` — remember your aircraft profile and loads.

## Files
- `manifest.json`, `popup.html`, `popup.css`, `popup.js`, `README.md`, `icons/`
