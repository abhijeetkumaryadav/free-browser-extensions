# ReadAloud — Text to Speech Speed Reader

Reads any article aloud using **your browser's built-in voices** — no accounts, no network, nothing leaves your device.

## What it does

- **Read Article** — extracts the article text from the current tab (semantic `<article>`/`<main>` heuristic, boilerplate skipped) and reads it aloud, paragraph by paragraph.
- **Read Selected text** — reads whatever text you have selected on the page.
- **Speed (0.5×–2.5×), pitch, and voice controls** — changes apply live, restarting the current paragraph. Your speed is remembered **per site**.
- **Word highlighting** — the word being spoken is highlighted in the page as it reads (best-effort; toggleable). The page's original HTML is restored exactly when reading stops or finishes.
- **Transport controls** — play, pause/resume, stop, plus a live progress bar and word counter.
- **Keeps reading after the popup closes** — the speech engine runs in the tab itself, so you can close the popup and keep listening.

## Honest scope

- Uses the `speechSynthesis` voices installed with your browser/OS. Voice quality and `onboundary` word-timing precision vary by voice — highlighting is best-effort.
- Reading runs in the tab; closing the tab stops it.
- Extensions can't access `chrome://` pages or the Web Store — the popup tells you when a page can't be read.

## Install

**Chrome / Edge:**
1. Unzip the package.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.

**Firefox:** the code uses standard WebExtensions APIs (`storage`, `activeTab`, `scripting`) plus `speechSynthesis` in the page — it should work in Firefox with the same load-temporary-add-on flow, though voices depend on the OS.

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Remember speed (per site), pitch, voice, and highlight preference on-device. |
| `activeTab` | Read the article text / selection from the tab you're viewing, only when you press play. |
| `scripting` | Inject the reader into the active tab on demand. |

No host permissions. No network calls — speech is synthesized locally by the browser.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Privacy disclosure: no data collected, transmitted, or shared.
