# BleepBox — Text Censor

Censors profanity in text you paste (or grab from the active tab's selection) using a
bundled word list plus your own additions. Three intensity modes (Mild / Standard /
Strict) and four mask styles (asterisks, hashes, first+last letter, `[bleep]`).

**Honest scope: BleepBox censors text only.** It cannot bleep audio in videos, streams,
or any real-time media. The name is a joke; the subtitle-censoring is real, the bleeping is not.

## Features

- Paste text or grab the current page selection with one click
- Bundled word list (mild / standard / strict tiers), add and remove words freely
- Mask styles: `****`, `####`, `f***k`, `[bleep]`
- Hit count on every run, one-click copy of censored output
- Everything runs locally — no network calls, no data leaves your device

## Install (development)

**Chrome / Edge / Opera:**
1. Download and unzip `subtitle-censor-bleeper.zip`
2. Go to `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

**Firefox:** MV3 is supported, but `chrome.scripting.executeScript` with `chrome.tabs`
needs the `scripting` permission mapped to `browser.scripting`; grab-selection may
need the page host permission. Paste mode works everywhere without permissions.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save your word-list edits, intensity, and mask-style choices on-device |
| `activeTab` | Let "Grab selection" read selected text only when you click the button |
| `scripting` | Inject a tiny self-contained function to read `window.getSelection()` on click |

No host permissions. No remote code. No analytics.

## Publishing notes

- Chrome Web Store: single-purpose text utility, minimal permissions — fine for listing.
- Do not describe it as an "audio bleep" tool in the listing; store reviewers reject misleading claims.
