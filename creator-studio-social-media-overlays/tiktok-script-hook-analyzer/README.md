# Hook Analyzer — TikTok Script Scorer

Paste a video script and get a **0–100 score on your opening hook**, with a per-factor
breakdown and concrete rewrite suggestions. All analysis runs locally in the popup —
nothing is sent anywhere.

## How it works

The extension extracts your hook (the first ~2 sentences) and runs 7 heuristics:

| Factor | Points |
|---|---|
| Question opener | 20 |
| Numbers or stats | 15 |
| Curiosity gap (open-loop words) | 15 |
| Direct "you" address | 15 |
| Snappy length (≤ 140 chars) | 15 |
| Pattern-interrupt opener (POV / Stop / number) | 10 |
| Zero filler intros | 10 |

Scores: **80+** Strong hook · **55–79** Decent, room to sharpen · **<55** Needs work.

> Heuristic analysis scores patterns, not virality. Treat it as a checklist, not a guarantee.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` in the folder. (Temporary until restart, per Firefox policy.)

## Permissions

- `storage` — remembers your last pasted script on this device so you don't lose it
  between popup opens. Nothing is synced or transmitted.

## Publishing notes

- Manifest V3, no remote code, no network requests, no analytics.
- The `storage` permission is the only one requested; data stays local.
- Store-safe: standard popup utility, no policy-sensitive behavior.
