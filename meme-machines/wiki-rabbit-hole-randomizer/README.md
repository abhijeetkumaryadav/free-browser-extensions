# RabbitHole — Wiki Randomizer v1.0.0

Go down the rabbit hole: open a random article on a public wiki, keep a
breadcrumb trail of your dives, and export the trail as a shareable text log.

## Features
- **Wiki picker** — Wikipedia (English), Simple English Wikipedia, Wiktionary,
  Wikiquote, Wikimedia Commons.
- **Dive in** — opens a random article in a new tab (only on your click).
- **Breadcrumb trail** — every landed article's title + wiki + time, newest first;
  click any entry to revisit it.
- **Back navigation** — jump back to the previous article of your trail.
- **Shareable log** — copy the whole trail as plain text (numbered, with URLs).
- **Depth counter** — see how far the hole goes.

All trail data lives in `chrome.storage.local` on your device (capped at 100 entries).

## Install
1. Unzip `wiki-rabbit-hole-randomizer.zip`.
2. Open `chrome://extensions` (Chrome/Edge) or `edge://extensions`.
3. Enable **Developer mode** → **Load unpacked** → select the folder.
4. Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on
   (pick `manifest.json`; note: `chrome.*` APIs work via Firefox's compatibility layer).

## Permissions (justified)
- `storage` — save your trail and the last selected wiki locally.
- `tabs` — read the title of the tab opened by **Dive in** (after the random
  redirect lands) so the trail shows real article names; also open trail URLs.
  Nothing is read from tabs you didn't open through the extension.

## Publishing notes
- Chrome Web Store: "justification for tabs permission" — needed to read the
  title of the random-article tab the user explicitly opened via Dive in.
- No remote code, no network calls except opening the wiki URL the user chose.
