# EmoteSwap — Twitch Emote Text Replacer

A fun, user-triggered tool: click **"Emote-ify this page"** and known emote codes
(`Kappa`, `PogChamp`, `KEKW`, `LUL`, `MonkaS`, `Sadge`, `FeelsBadMan`, `OMEGALUL`)
in the page's text are replaced with little bundled emote icons — or with purple
badge pills if you pick **Badges** mode. Click **"Restore original"** to put the
page text back exactly as it was.

Just for fun. Fully reversible, everything stays on your device.

## Install

**Chrome / Edge / Opera**
1. Unzip `twitch-emote-universal-text-replacer.zip`.
2. Go to `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder.
   (Note: Firefox loads `chrome.*` MV3 APIs via its compatibility layer; the
   emote PNGs are bundled, so no network calls are needed anywhere.)

## Permissions (all justified)

- `storage` — remembers your Icons/Badges preference only.
- `activeTab` — lets the button act on the tab you clicked it from.
- `scripting` — injects the replacer script into that tab on demand.
- `http://*/*`, `https://*/*` host permission — required so the injected script
  can run on the page you clicked the button on, and so the bundled emote PNGs
  (declared in `web_accessible_resources`) can load there.

No network requests are ever made. No data leaves your device.

## Notes for publishing

- Category: Fun / Entertainment. This is a novelty text filter, not affiliated
  with Twitch.
- The emote icons are simple original face drawings generated for this project;
  they are not copies of Twitch's copyrighted emotes.
- Screenshots: show the popup, a page before/after "Emote-ify", and the restore.
- Privacy tab: declare no data collection.
