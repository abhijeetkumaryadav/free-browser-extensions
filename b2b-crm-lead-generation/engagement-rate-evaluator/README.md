# Engagement Rate Evaluator v1.0.0

Enter followers, likes, comments, and shares for a post. Get an
engagement rate with an industry-context verdict (Excellent / Good /
Average / Low), see how the post compares against your own average,
and build a saved history with a trend sparkline.

## Try it
1. Unzip `engagement-rate-evaluator.zip`.
2. Chrome/Edge: `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select the folder.
   Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pick `manifest.json`.
3. Click the icon, enter numbers, hit **Calculate**; **Save post** keeps it in history.

## Publishing notes
- Permissions: `storage` only — post history lives on-device. Nothing is uploaded or scraped; all numbers are entered manually.
- Chrome Web Store: $5 one-time dev fee. Edge Add-ons and Firefox signing are free.
