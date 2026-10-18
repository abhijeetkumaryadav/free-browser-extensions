# FrameFX — Emoji Animation Studio

Animate an emoji with **bounce**, **spin**, **pulse** or **shake**, preview it live,
and export the animation as a **PNG frame sequence**. 100% local — no accounts,
no network, no tracking.

## Honest scope

- Exports **PNG frames only** (`framefx-<anim>-001.png`, …). This extension does
  **not** encode GIFs or videos. Stitch the frames in any video editor, or use a
  free GIF tool, if you need an animated GIF.
- Everything runs on-device in the popup canvas.

## Install (developer mode)

**Chrome / Edge / Opera**
1. Download and unzip `animated-gif-emoji-creator.zip`.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` in the unzipped folder. (Temporary install; removed on restart.)

## How to use

1. Pick an emoji (type one or use the quick-pick swatches).
2. Choose an animation style: Bounce, Spin, Pulse or Shake.
3. Tune frame rate (4–24 fps), frame count (4–36) and emoji size.
4. Watch the live preview, hit **Replay** to restart it.
5. **Export PNG frames** downloads one PNG per frame to your default download folder.

## Permissions

- `storage` — remembers your emoji, animation, fps, frame count and size between sessions.

Nothing else. No host permissions, no network access.

## Notes for store publishing

- Name/summary must not promise GIF output. Suggested summary: *"Animate emoji on a canvas and export the frames as a PNG sequence — bounce, spin, pulse, shake."*
- Icons included: 16 / 48 / 128 px.
- MV3 only, no remote code.
