# BubblePop — Bubble Wrap Popper

Infinite bubble wrap popping with a satisfying synthesized "pop" sound.
Zero stress, all pops.

## Install (Chrome / Edge / Opera / Firefox)

1. Unzip `click-sound-bubble-wrap-popper.zip` anywhere.
2. Open `chrome://extensions` (or `edge://extensions`, `opera://extensions`, `about:debugging#/runtime/this-firefox` for Firefox).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

## Use

- Click the toolbar icon → **Open bubble wrap** to launch the full-page game.
- Click bubbles — or hold and drag for rapid-fire popping.
- The HUD tracks pops per sheet, current streak, and sheet progress.
- Sound toggle (toolbar popup and in-game) controls the synthesized pop.
- Clearing a sheet shows a celebration card with lifetime pop stats.

The pop sound is synthesized with the Web Audio API (pitch-dropping sine
"snap" + filtered noise click) — no audio files are bundled, and the pitch
varies slightly per pop so rapid popping sounds organic.

## Permissions

- `storage` — saves lifetime pop count, best streak, and the sound
  preference on-device. No browsing data is read and nothing is sent
  anywhere.

## Publishing notes

- Manifest V3, no remote code, no network calls, no content scripts.
- All assets local; icons generated with PIL.
