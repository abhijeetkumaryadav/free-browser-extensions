# ReadingLens — Article Reading Time & Difficulty Estimator

Click **Analyze this page** and ReadingLens extracts the article body, then computes
on-device:

- Word count and estimated reading time at your adjustable WPM (150–350)
- **Flesch–Kincaid grade level** and **Flesch reading ease** score
- A difficulty verdict: **Easy read** / **Moderate** / **Dense**
- Top 10 keywords (stopwords excluded)

Article extraction prefers semantic containers (`<article>`, `<main>`), then falls
back to the densest paragraph-heavy container, stripping navigation, ads, and
boilerplate first.

## Install (Chrome / Edge / Brave)

1. Unzip the release archive anywhere on your disk.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped folder.

## Firefox

Firefox supports MV3, but this extension uses `chrome.scripting.executeScript`,
which requires the `scripting` permission path that Firefox implements with some
differences. For Firefox, load via `about:debugging` → **This Firefox** →
**Load Temporary Add-on** and select `manifest.json`. Report issues before
shipping a signed build.

## Permissions

| Permission | Why it is needed |
|---|---|
| `activeTab` | Access the tab you click on, so its article text can be analyzed. |
| `scripting` | Inject the text-extraction script into the active tab only, and only when you click Analyze. |
| `storage` | Remember your reading-speed (WPM) preference on this device. |

No network requests are ever made. All analysis is 100% local.

## Publishing notes

- Chrome Web Store: single-purpose (readability analysis); justify `scripting` as
  user-invoked article extraction.
- The WPM preference is the only stored data; include a privacy policy stating
  that no browsing data is collected or transmitted.
