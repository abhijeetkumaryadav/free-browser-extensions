# Interview Theme Grouper

Manually tag interview quotes/notes with themes and a sentiment rating, then browse them grouped by theme with counts.

**Honest scope:** this extension performs NO automatic sentiment detection and NO theme analysis. Every quote is pasted by you, every theme is assigned by you, every sentiment rating is chosen by you. The extension only stores, filters, and groups what you label. It is an organizer, not an analyzer.

## Features

- Paste quotes/notes with an optional speaker label
- Toggle themes from your theme list (custom + bundled starter themes: Pain points, Pricing, Onboarding, Feature requests, Workarounds, Trust, UX feedback, Competitors)
- Assign a sentiment rating per quote: positive / neutral / negative
- Themes tab: per-theme counts and a filterable, sentiment-filterable quote list
- Manage tab: add/delete themes, export quotes as CSV or JSON, delete everything
- 100% local via `chrome.storage.local`

## Permissions

- `storage` — store your quotes and theme list locally. Nothing leaves the browser.

## Install (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder
