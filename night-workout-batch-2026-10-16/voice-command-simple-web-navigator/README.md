# VoiceNav — Voice Command Web Navigator

Control your browsing with simple voice commands. Speech recognition runs **100% on-device** in your browser: no accounts, no network calls, nothing is recorded or sent anywhere.

## Commands

| Say | Does |
|---|---|
| "scroll down" / "scroll up" | Scroll the page |
| "scroll to top" / "scroll to bottom" | Jump to page ends |
| "go back" / "go forward" | Browser history |
| "reload" | Refresh the page |
| "new tab" / "close tab" | Tab control |
| "click …" | Click an element by its text, e.g. "click search" |
| "open …" | Open a site, e.g. "open wikipedia" |
| "read page" | Read visible text aloud |
| "stop" | Stop speaking |

Navigation commands ("go back", "open …", "close tab", …) ask for a spoken **"yes"** confirmation first — toggleable in Settings.

## How it works

1. Click the mic, speak a command.
2. The popup parses it locally with the Web Speech API.
3. Page actions run through a content script injected on demand (`activeTab` + `scripting`).

## Permissions

- `activeTab` + `scripting` — run commands on the page you're viewing, only when you ask
- `tabs` — open/close/switch tabs for "new tab" / "close tab"
- `storage` — remember settings and the command log

Microphone access is requested by the browser for the popup page itself; no manifest permission covers it and no audio leaves the device.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select this folder (or drag in the `.zip` contents).
3. Pin VoiceNav, click the mic, and talk.

## Honest scope

- Recognition quality depends on your browser's built-in speech engine and microphone.
- "click …" matches visible button/link text heuristically; oddly-labeled controls may not match.
- Not tested in a live browser; validation covered manifest parsing, JS syntax, icon generation, and packaging.
