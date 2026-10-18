# Twitch Chat Sentiment Ticker v1.0.0

Live heuristic sentiment ticker for the Twitch chat you're watching. Open a Twitch
stream, press **Start sampling**, and the popup shows a rolling 5-minute view of
chat mood: positive %, messages/minute, and top emotes.

## How it works

- The popup injects a small read-only sampler into the Twitch tab **only when you
  press Start** (via `chrome.scripting` + the `activeTab` grant).
- The sampler watches chat with a `MutationObserver`, scores each message with a
  small local English word lexicon (+1 / -1 / 0), and stores compact samples
  (`{timestamp, score, emotes}`) in `chrome.storage.local` — capped at 300.
- The popup polls storage every 2 seconds and renders rolling stats.
- **Stop sampling** (or closing the tab) disconnects the observer. Nothing is
  ever modified on the page and nothing is sent anywhere.

The scoring is a deliberately simple heuristic — for fun, not science.

## Install (load unpacked)

**Chrome / Edge**
1. Unzip `twitch-chat-sentiment-ticker.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox**
1. Unzip the package.
2. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** →
   select `manifest.json`. (Note: temporary until packaged/signed for distribution.)

## Permissions (all justified)

| Permission | Why |
|---|---|
| `activeTab` | Read chat DOM on the Twitch tab you opened, only after you press Start. |
| `scripting` | Inject the read-only sampler content script on demand. |
| `storage` | Keep the last 300 compact chat samples + the sampling flag on-device. |

No host permissions, no network calls, no analytics.

## Publishing notes

- MV3, no deprecated APIs.
- Honest scope: heuristic sentiment only; Twitch DOM selectors are defensive
  (multiple fallbacks) but may need updates if Twitch changes its markup —
  the sampler fails silently and the popup simply shows no data.
- Chrome Web Store: single-purpose, minimal permissions; disclose "reads page
  content on twitch.tv only when the user starts sampling" in the privacy tab.
