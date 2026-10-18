# Page Latency Tester — Load Latency

Type any URL and measure its **page load latency** (fetch round-trip time),
with a small history chart of your recent tests.

**Honest scope:** this extension **does not test DNS propagation**.
Browsers expose no DNS API to extensions, so per-nameserver propagation
checking is impossible. What you get instead:

- **Total round-trip** for a fresh `fetch` to your URL (timed with
  `performance.now()`), made with `no-cors` so no page content is ever read.
- **Per-phase detail** (DNS / connect / TTFB) *only* when the server sends
  `Timing-Allow-Origin` and the browser exposes Resource Timing data —
  otherwise the popup says so plainly instead of guessing.
- Reachability status and a local-only history (last 24 tests).

Everything is user-triggered and 100% local — no analytics, no remote code.

## Files

- `manifest.json` — Manifest V3, permissions: `storage`, `tabs` (pre-fill the
  active tab's URL); host permissions only so the URLs *you enter* can be fetched.
- `popup.html` / `popup.css` / `popup.js` — timing logic and history chart.
- `icons/` — 16/48/128 PNG icons generated with PIL.
