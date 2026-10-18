# MemeForge — Meme Template Overlay Generator

A fun meme maker: pick one of 6 bundled original meme templates, add top and
bottom captions in classic meme style (white Impact-style text with black
outline, auto word-wrap), tweak font size, toggle the outline, preview live,
and download your meme as a PNG. Everything runs locally in the popup — no
uploads, no accounts, no network calls.

## Install

**Chrome / Edge / Opera**
1. Unzip `meme-template-image-overlay-generator.zip`.
2. Go to `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder.

## Permissions (all justified)

- `storage` — remembers your last template, font size, and outline preference.
  That's it. The only permission the extension requests.

Downloads use a canvas blob + anchor click, so no `downloads` permission is
needed. No host permissions, no content scripts, no network requests.

## Notes for publishing

- Category: Fun / Entertainment.
- All 6 templates are original blank designs generated for this project — no
  copyrighted meme images are bundled.
- Screenshots: show the template picker, caption editing, and a finished meme.
- Privacy tab: declare no data collection.
