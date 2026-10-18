# AnimeTab — Background Sprite Anime Theme Engine

An anime-inspired animated new-tab page. Pick from **5 hand-tuned procedural themes** — every sprite is drawn live on canvas with plain 2D primitives. No images, no hotlinks, no network, no tracking.

## Themes

| Theme | Vibe |
|---|---|
| **Sakura Drift** | Falling cherry petals with flutter and sway |
| **Starfall Night** | Twinkling stars, glowing moon, occasional shooting stars |
| **Cloud Voyage** | Soft drifting cumulus clouds over a sunny sky |
| **Firefly Meadow** | Blinking fireflies over a dusk meadow silhouette |
| **Aqua Bubbles** | Rising ocean bubbles with rotating light rays |

Each theme also re-skins the page: matching accent colors on the theme dock and a mood that fits the scene.

## Features

- Live clock, date, and time-of-day greeting
- Glassmorphism theme dock with gradient swatches
- Particle density control (Calm / Normal / Lively), persisted in `chrome.storage.local`
- Theme choice persisted across sessions
- Respects `prefers-reduced-motion` (renders a single static frame)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remember your theme + density choice |

That's it. No host permissions, no remote code, no analytics.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open a new tab and pick your mood.
