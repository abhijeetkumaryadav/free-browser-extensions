# Buying Intent Tracker v1.0.0

**Scan page** on any product page: extracts title, price, list price,
rating, review count, stock availability ("only X left" detection),
and image count — then computes an explainable **0–100 buying-intent
score** with per-factor bars (Rating 25 · Reviews 20 · Discount 15 ·
Availability 25 · Imagery 15) and a verdict: HOT / WARM / COOL / COLD.

Save scans to history to compare products side by side.

## Try it
1. Unzip `buying-intent-tracker.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any product page → click the icon → **Scan page**.

## Publishing notes
- Permissions: `activeTab` + `scripting` (read the page you scan),
  `storage` (scan history on-device). Nothing uploaded.
- Chrome Web Store: $5 one-time dev fee.

## Files
```
manifest.json, popup.html/css/js, icons/, README.md
```

## Future-proofing
- Manifest V3 only, no deprecated APIs.
- All page parsing isolated in one injectable, dependency-free function.
- Scoring weights are named constants in one place (`score()`).
