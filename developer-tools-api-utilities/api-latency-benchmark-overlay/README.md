# API Latency Benchmark Overlay v1.0.0

Paste API endpoint URLs (one per line), pick how many runs per
endpoint, and hit **Run benchmark**. Each endpoint is timed from
your browser; results are ranked fastest → slowest with a bar
chart, average / min / max timings, and HTTP status. Endpoints that
refuse cross-origin access are clearly labeled **Blocked (CORS)**;
timeouts are labeled too.

Only URLs you type are ever requested. Nothing leaves your device
except those requests themselves.

## Try it
1. Unzip `api-latency-benchmark-overlay.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon, paste endpoints, run.

## Publishing notes
- Permissions: `storage` only (remembers your last URL list).
  No host permissions — cross-origin requests intentionally obey
  the page's CORS policy, and blocked endpoints are reported as
  such rather than bypassed.
- Chrome Web Store: $5 one-time dev fee. Edge and Firefox accounts
  are free; Firefox builds need signing via AMO.
