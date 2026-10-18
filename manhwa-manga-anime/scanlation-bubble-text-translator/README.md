# BubbleTranslate — Scanlation Text Helper

Select text on any page (or paste it in), pick source/target languages, and open it in Google Translate in a new tab. Languages and the last explicit source language are remembered on-device. Built for comic/scanlation readers working with selectable text.

**Honest scope:** this is selection/paste translation — it is **not** image OCR and cannot read text baked into images.

## Install

1. Download and unzip `scanlation-bubble-text-translator.zip`.
2. Go to `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Pin the extension, then click its toolbar icon.

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → choose `manifest.json`. (Temporary installs are removed on browser restart.)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your source/target language choices on-device. |
| `activeTab` | Lets the "Use page selection" button read the tab you're viewing, only when you click it. |
| `scripting` | Runs a tiny one-shot function to read `window.getSelection()` in the active tab. |

No page content is stored or sent anywhere except the Google Translate URL you explicitly open.

## Use

1. Select text on the page and click **Use page selection** — or paste text directly.
2. Choose From/To languages (From defaults to auto-detect). The swap button exchanges them.
3. Click **Translate in new tab**.

## Publishing notes

- Manifest V3 only; no deprecated APIs.
- Minimal, justified permissions; no host permissions, no background page, no remote code.
- Icons: generated PNGs (16/48/128) in `icons/`.
