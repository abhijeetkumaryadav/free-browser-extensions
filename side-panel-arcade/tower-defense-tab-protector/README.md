# TabGuard — Tower Defense

A polished tower-defense game for your browser. Place arrow, cannon and frost towers along a fixed enemy path, survive escalating waves, and beat your best wave.

## Install (load unpacked)

**Chrome / Edge / Opera**
1. Download and unzip `tower-defense-tab-protector.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.

**Firefox** — this build targets Chromium MV3; for Firefox, the manifest and APIs used (`storage`, `tabs`, `runtime.getURL`) are MV3-compatible, but load via `about:debugging → This Firefox → Load Temporary Add-on` and report any issues.

## How to play

1. Click the toolbar icon, then **Play** to open the game tab.
2. Pick a tower in the Build panel (Arrow 50g / Frost 80g / Cannon 110g), then click a free tile to build.
3. Press **Start wave** when ready. Enemies follow the glowing path.
4. Earn gold for kills, spend it on more towers or upgrades (click a placed tower → Upgrade/Sell).
5. Survive as many waves as you can — your best wave is saved on-device.

Towers:
- **Arrow** — fast single-target shots, great early game.
- **Frost** — low damage but slows enemies, combos well with cannons.
- **Cannon** — slow, heavy splash damage for packed groups.

Enemies: Grunts (steady), Runners (fast, weak), Brutes (slow, tanky, cost 2 lives if they leak).

## Permissions

- `storage` — saves your best wave locally on your device. Nothing else is stored or transmitted.

No network requests, no analytics, no data collection.

## Publishing notes

- Manifest V3, no remote code, no deprecated APIs.
- All art is drawn at runtime on canvas; icons are locally generated PNGs.
- Suitable for the Chrome Web Store "Games" category.
