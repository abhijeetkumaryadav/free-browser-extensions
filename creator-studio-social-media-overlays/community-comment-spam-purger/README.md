# Community Comment Spam Purger v1.0.0

A heuristic comment spam scorer. Paste comment text and get a 0–100 spam score with a per-signal breakdown, or batch-score many comments at once (separate with a blank line).

## Honest scope
This is an **analysis tool only**. It never deletes, hides, reports, or moderates comments automatically — it only scores text you paste. Scores are heuristics and will have false positives; you decide what to do with the results.

## Scoring signals (all local)
1. **Excessive links** — counts URLs (up to +30)
2. **ALL CAPS shouting** — uppercase ratio of letters (up to +20)
3. **Repeated phrases** — repeated 3–5 word n-grams (up to +15)
4. **Suspicious keywords** — scam/giveaway/engagement-bait phrases (up to +25)
5. **Emoji spam** — emoji count above 4 (up to +15)
6. **Excessive punctuation** — `!!!` / `???` bursts (up to +10)
7. **Gibberish-like text** — unusually long tokens (up to +5)

**Verdicts:** 0–24 Likely clean · 25–49 Suspicious · 50–74 Likely spam · 75–100 Spam

## Install
**Chrome / Edge:** unzip the file, open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, click **Load unpacked**, select the unzipped folder.
**Firefox:** open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`. (Temporary install; for permanent use, sign via addons.mozilla.org.)
**Opera:** open `opera://extensions`, enable **Developer mode**, **Load unpacked**.

## Permissions
| Permission | Why |
|---|---|
| `storage` | Reserved for future on-device history (currently minimal usage) |

No host permissions. No network calls. No remote code.

## Publishing notes
- Manifest V3, no deprecated APIs.
- Single `storage` permission — minimal and easily justified in store review.
- Privacy policy: no data collection, no transmission, no analytics. All scoring runs on-device.
