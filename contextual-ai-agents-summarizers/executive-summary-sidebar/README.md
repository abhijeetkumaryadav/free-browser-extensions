# Executive Summary v1.0.0

An on-device **extractive summarizer** in your toolbar. Paste long
text (article, report, email) or hit **Grab page** to pull the
current page's article text, then get a summary of adjustable
length (2–10 sentences), key-term chips, and a reading-time
estimate. Uses keyword-frequency scoring — a fast heuristic, not
AI — and nothing ever leaves your device.

## Try it
1. Unzip `executive-summary-sidebar.zip`.
2. `chrome://extensions` (Edge: `edge://extensions`, Firefox: `about:debugging`) → Developer mode → **Load unpacked** → select the folder.
3. Click the icon on any article page → **Grab page** → **Summarize**.

## Permissions
- `activeTab` + `scripting`: read the text of the page you are viewing when you hit "Grab page". No storage permission; nothing is saved or uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration. Declare in the privacy tab that no data is collected.
- Firefox: same source works; submit via addons.mozilla.org for signing.
