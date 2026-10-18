# Video Stream Codec Reporter v1.0.0

Read-only inspector: scan the active tab and list every `<video>`
element with its source URL, codec/MIME hints (declared `type`
attributes plus an extension-based MIME guess), resolution, duration,
readyState (with label), and buffered time ranges. One click copies a
plain-text report. Nothing is modified on the page.

## Try it
1. Unzip `video-stream-codec-reporter.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open a page with video (e.g. a news article or YouTube) →
   **Scan page** → **Copy report**.

## Permissions
- `activeTab` — run only when you click **Scan page** on the current tab.
- `scripting` — inject a read-only DOM scan (no page modification).

## Publishing notes
- Chrome: one-time $5 developer registration. Edge: free.
- Firefox: MV3 `scripting` is supported; optional adjustments to
  manifest keys are minimal if submitting to AMO.
- Fully read-only: no network calls, no storage, no data collection.
