# Opinion Sentiment Aggregator v1.0.0

Paste multiple opinions or reviews (one per line, or blank line
between them). An on-device lexicon scores each as
positive / neutral / negative with per-item bars, then shows an
aggregate gauge with verdict, the most positive and most negative
picks, and the top sentiment words. Past analyses are kept in
history. Clearly labeled as a lexicon heuristic — indicative only,
not machine learning.

## Try it
1. Unzip `opinion-sentiment-aggregator.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
   - Edge: `edge://extensions`, same steps.
   - Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.
3. Paste opinions, hit **Analyze**.

## Permissions
- `storage` — saves your analysis history on-device. Nothing is uploaded anywhere.

## Publishing notes
- No host permissions, no remote code, no network calls.
- Chrome Web Store: $5 one-time developer registration fee.
