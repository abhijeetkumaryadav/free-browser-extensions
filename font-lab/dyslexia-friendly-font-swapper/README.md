# ReadEase — Dyslexia-Friendly Font Swapper (v1.0.0)

An accessibility aid that makes web pages easier to read: toggle a
dyslexia-friendly system font stack (Verdana, Tahoma, Trebuchet MS,
Century Gothic, Comic Sans, or your OS default) and fine-tune letter
spacing, word spacing and line height with sliders. Everything is
reversible — toggle off or hit "Restore page".

## Honest scope

- **Accessibility aid, not medical advice.** These are commonly recommended
  readability adjustments (distinctive letterforms, extra spacing), not a
  treatment for dyslexia.
- **System fonts only.** Browser extensions cannot browse or upload your
  local `.ttf` files, so this tool uses font stacks already installed on
  your device. Nothing is downloaded and nothing leaves the machine.

## Install (Chrome / Edge / Opera)

1. Unzip `dyslexia-friendly-font-swapper.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

## Install (Firefox)

Firefox supports Manifest V3 extensions from `about:debugging#/runtime/this-firefox`
via **Load Temporary Add-on** (select `manifest.json`). `chrome.scripting`
requires the `scripting` permission grant; Chrome/Edge recommended.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Apply/restore changes on the tab you interact with, only after your gesture |
| `scripting` | Inject a small self-contained stylesheet into the page's main world |
| `storage` | Remember your font + spacing preferences (on-device only) |

## Publishing notes

- No remote code, no network calls, no data collection — safe for the
  Chrome Web Store single-purpose policy.
- All fonts are system stacks; nothing bundled or downloaded.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — 380px glassmorphism popup
- `icons/` — 16/48/128 PNG icons (PIL-generated)
