# XML Log Anomaly Detector v1.0.0

Paste XML log lines (one entry per line, e.g.
`<log ts="2026-10-16T10:00:01Z" level="INFO" rt="42">request ok</log>`)
and get automatic anomaly detection:

- **Traffic spikes** — per-minute volume far above the median
- **Error clusters** — 3+ errors inside any 5-minute window
- **Slow responses** — response times above mean + 2σ

Renders a per-minute timeline chart (gray volume, red error overlay,
amber markers on anomalous minutes) plus a flagged-anomalies list with
a one-click text report. Attribute names are fuzzy-matched
(`ts`/`timestamp`/`time`, `level`/`severity`, `rt`/`ms`/`duration`, …)
so most log formats just work.

**Note:** parsing is best-effort — always verify flagged items against
your raw logs. Hit **Load sample** to try it instantly.

## Try it
1. Unzip `xml-log-anomaly-detector.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon → **Load sample** → **Analyze**.

## Permissions (justified)
- `storage` — remembers your last pasted log on-device. Nothing uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time dev fee. Firefox: free, requires signing.
- No network calls; everything runs locally.
