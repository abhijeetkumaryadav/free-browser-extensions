# Network Throttling Profiles v1.0.0

**Measurement only — this extension never throttles or alters your
network.** Hit "Measure this page" and it reads the page's real
Performance API resource timings: request count, total transferred
size, DOM-ready and full-load times, an average timing breakdown
(DNS / connect / TTFB / download), and a ranked table of the 10
slowest resources with per-resource bars. Last report is remembered
on-device.

Note: cross-origin resources that don't send a
`Timing-Allow-Origin` header report 0 size — the popup explains this
instead of showing fake numbers.

## Try it
1. Unzip `network-throttling-profiles.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Open any page, click the icon → **Measure this page**.

## Permissions
- `activeTab` + `scripting` — read the Performance API of the tab you measure, only when you click.
- `storage` — remembers the last report. Nothing uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee. Justify `activeTab`/`scripting` as page measurement on user action.
- No debugger API, no traffic modification — store-safe by design.
