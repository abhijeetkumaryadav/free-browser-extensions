# DictatePad — Speech-to-Text Buffer

A press-and-hold dictation pad. Hold the big button and speak — the browser's
built-in Web Speech API streams interim results live and appends final
transcript chunks into an editable buffer. Copy, clear, and the buffer
autosaves locally.

## Install (Chrome / Edge / Opera)

1. Unzip `speech-to-text-dictation-buffer.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Honest scope

- Uses the **browser's built-in** `SpeechRecognition` API — no API keys, no code of ours in the loop.
- Works in Chrome and Edge. Firefox does not implement the Web Speech API, so dictation is unavailable there (the popup says so).
- Recognition may use the browser vendor's online speech service, so a network connection is usually required for transcription.
- The microphone listens **only while the talk button is physically held**; a pulsing indicator shows the listening state.

## Permissions

- `storage` — saves your text buffer on-device only. Nothing is sent anywhere by this extension.

## Publishing notes

- Manifest V3, no remote code, no network calls of our own, no analytics.
- 16/48/128 PNG icons included; description and name are store-ready.
