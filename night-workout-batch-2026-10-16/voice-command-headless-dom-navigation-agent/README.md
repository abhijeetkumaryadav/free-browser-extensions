# Voice Command Navigator — Headless DOM Navigation Agent

Drive the active tab with your voice. Tap the mic, say a command, and the
extension executes it on the current tab: scroll, navigate history, click
links/buttons by their spoken text, reload, or close the tab.

## Honest scope

- Uses your **browser's built-in Web Speech API** (`SpeechRecognition` /
  `webkitSpeechRecognition`) — recognition accuracy varies and it only works
  in browsers that support it (Chrome, Edge). No AI model is bundled.
- **No audio is recorded or uploaded** — recognition runs locally in your
  browser. The popup only reads the resulting text transcript.
- If speech recognition is unsupported, the popup shows a clear message
  instead of failing silently.

## Commands

| Say | Does |
|---|---|
| "scroll up" / "scroll down" | Smooth-scrolls the page |
| "go back" / "go forward" | Tab history navigation |
| "click \<text\>" | Clicks the best-matching visible link/button |
| "top" / "bottom" | Jumps to page top/bottom |
| "reload" | Reloads the tab |
| "close tab" | Closes the active tab |

The popup shows the heard transcript and the matched action after every
command.

## Files

- `manifest.json` — MV3 manifest (permissions: `storage`, `activeTab`, `scripting`)
- `popup.html` / `popup.css` / `popup.js` — mic UI, transcript display, command matcher
- `background.js` — action router that performs tab actions and click-by-text
- `icons/` — 16/48/128 PNG icons
- No remote code, no analytics, zero network requests.

## Install

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select this folder.
3. Click the toolbar icon, tap the mic, allow mic permission, and speak.
