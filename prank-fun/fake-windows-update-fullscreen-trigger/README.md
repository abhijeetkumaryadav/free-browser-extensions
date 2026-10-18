# FakeUpdate — Cartoonish Prank Overlay

A harmless prank extension: one click shows a deliberately cartoonish full-page "updating" screen on the current tab, with a giant **THIS IS A PRANK** banner and a progress bar that climbs then comically resets with silly status lines ("Downloading more RAM…", "Teaching ducks to type…").

## Deliberate anti-deception design

- The overlay is **obviously cartoonish**: playful gradient, Comic Sans-style type, dotted spinner, striped yellow progress bar, dashed "prank" banner.
- A large **"THIS IS A PRANK — nothing is updating"** banner is visible at all times.
- **Press `Esc` or click "Exit prank"** to leave instantly. The page underneath is never touched.
- It does **not** mimic any real operating-system update screen.

## Install

1. Unzip the package.
2. Open `chrome://extensions` (Chrome/Edge) or `about:debugging#/runtime/this-firefox` (Firefox).
3. Enable **Developer mode** → **Load unpacked** → select the unzipped folder.
4. Pin the icon, click it, then "Trigger the prank".

## Permissions

- `activeTab` — lets the popup act on the current tab when you click.
- `scripting` — injects the overlay content script on demand, only into the tab where you triggered the prank.

No network calls, no data collection, no persistent state (not even `storage` is used).

## Publishing notes

- Clearly labeled as a joke everywhere (popup tag, banner, store-description disclosure).
- Minimal permissions, single purpose, instantly reversible — suitable for the Chrome Web Store with a "prank/joke" disclosure.
