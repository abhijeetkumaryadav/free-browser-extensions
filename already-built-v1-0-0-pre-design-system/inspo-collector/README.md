# Inspo Collector v1.0.0

Save images from anywhere on the web into themed inspiration boards — with
auto-tags and extracted color palettes. Built for creators doing visual
research (mood boards, campaign references, trend hunting).

## What it does

- **Right-click any image → “Save image to Inspo Board”** → pick a board.
  The image URL, source page, auto-generated tags, and a 5-color palette
  are saved instantly. A ✓ badge confirms the save.
- **Popup gallery**: browse boards as tabs, search by tag or title, see
  palette swatches per image, open the source page, delete items.
- **Boards**: create unlimited boards (Festive Edit, Glow Routine…),
  delete them (their images move back to Unsorted).
- **Export**: download any board as JSON.

## Try it right now (no publishing needed)

**Chrome / Edge / Brave / Opera**
1. Unzip `inspo-collector.zip` anywhere.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.
5. Right-click any image on any site → save it to a board.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json`.
   (Temporary: lasts until Firefox restarts. For permanent install,
   submit to AMO — see below.)

## Publishing (when you're ready)

| Store | Fee | Notes |
|---|---|---|
| Chrome Web Store | $5 one-time | Manifest V3 ✓, 2-step verification on Google account, review 1–3 days |
| Edge Add-ons | Free | Same zip as Chrome, Partner Center account, review a few days |
| Firefox (AMO) | Free | Code is unminified so no source upload needed; review can take days–weeks |
| Opera Add-ons | Free (to verify) | Same Chromium zip |

Upload the **zip** (manifest.json at the root). Listing assets you'll need:
128×128 icon ✓ (included), short description ≤132 chars, ≥1 screenshot
at 1280×800, small promo tile 440×280. Privacy policy page required only
if you start collecting user data — v1 stores everything locally in
`chrome.storage.local`, so you can honestly declare “no data collected”.

## Files

```
manifest.json      Extension config (MV3)
background.js      Service worker: context menus, saving, badges
content.js         Palette extraction in page context (best-effort)
popup.html/css/js  Gallery UI
new-board.html/js  Board creation page
icons/             16 / 48 / 128 px icons
```

## v1.1 ideas

- Drag-and-drop board covers, notes per image
- “Copy palette as CSS” button
- Sync via chrome.storage.sync
- Share board as a public link
