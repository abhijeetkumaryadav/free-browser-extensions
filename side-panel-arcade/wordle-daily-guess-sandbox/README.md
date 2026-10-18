# WordBox — Daily Guess Sandbox

A Wordle-style 5-letter word game in your toolbar: guess the word in 6 tries with
green/yellow/gray tile feedback, on-screen + physical keyboard, a date-seeded
**Daily** word (one game per day) and unlimited **Practice** mode.

## Features

- 6×5 tile board with flip-reveal animations and shake on invalid guesses
- Correct duplicate-letter scoring (two-pass evaluation, tested)
- Daily mode: word deterministically seeded by date — same word for everyone, one game per day, progress resumes
- Practice mode: unlimited random words + "new word" button
- Stats: played, win %, streak, max streak, guess-distribution chart
- On-screen keyboard with green/yellow/gray key coloring + full physical keyboard support
- 662 answer words + 2,151 total allowed guesses, all bundled locally (`words.js`) — **zero network calls**

## Install (Chrome / Edge / Opera)

1. Unzip `wordle-daily-guess-sandbox.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

For Firefox: open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** →
select `manifest.json` (MV3 popups and `chrome.storage` supported).

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist game state (daily progress, practice game) and statistics. On-device only. |

## Word lists

`words.js` is generated from `gen_words.py` (hand-curated lists, validated: all
5 letters, unique, answers ⊂ allowed). To regenerate, run `python3 gen_words.py`.

## Publishing notes

- MV3 only, no deprecated APIs, no host permissions, no remote code — store-safe.
- No user-data collection; privacy policy can state "no data leaves device".
- Game name/branding is original ("WordBox"); no trademarked assets.
