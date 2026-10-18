# Visibility Health Diary

**Hidden-Shadowban Visibility Metric Ticker** — honestly scoped as a manual visibility logbook.

## What it does

- **Log your posts' metrics** — copy reach, likes, comments, saves from your platform analytics into the diary, plus a note about what felt different.
- **Reach-over-time chart** — an SVG trend line of your last 20 posts.
- **Stats** — post count, average reach (last 10), average engagement rate.
- **Dip prompts** — if your last 3 posts average under 50% of your prior baseline, you get a reflection prompt listing *speculative, common* causes. These are prompts for journaling, **never diagnoses**.
- **Export JSON / clear all.**

## Honest scope

- **This tool cannot detect shadowbans.** No platform discloses them, and no browser extension can see them. Any claim otherwise would be a lie.
- It reads nothing automatically: every number is typed by you from your own analytics.
- Everything is stored locally in `chrome.storage.local`. Nothing is transmitted anywhere.

## Files

- `manifest.json` — MV3, `storage` permission only
- `popup.html` / `popup.css` / `popup.js` — the app (no content or background scripts; nothing touches web pages)
- `README.md`, `icons/icon{16,48,128}.png`

## Privacy

Zero network requests. No accounts. No tracking. Your diary never leaves the browser.
