# SigArt — ASCII Art Signature Builder

Type any text and turn it into a big ASCII-art signature using a **built-in 5×5 pixel
bitmap font** (A–Z, 0–9, and common punctuation) — rendered entirely on your device.
Copy it or download it as a `.txt` file.

## What it does

- Live ASCII-art preview as you type (up to 60 chars)
- Custom **fill character** (default `#` — try `*`, `█`, `@`…)
- Adjustable **character width / scale** (1×–3×)
- Adjustable **letter spacing** (0–3 columns)
- Stats (output width × height in characters)
- One-click **Copy** and **Download .txt**
- Remembers your last settings locally

## Honest scope

- The font is a hand-built 5×5 pixel font bundled in the extension — there is no
  FIGlet, no font downloads, and no network access. Unsupported characters render
  as blank space. Lowercase is rendered as uppercase.

## Install

1. Unzip `standard-ascii-art-signature-builder.zip`
2. Open `chrome://extensions` (Edge: `edge://extensions`, Firefox: `about:addons` → gear → Debug Add-ons)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remembers your text, fill character, scale, and spacing between sessions |

No host permissions, no tabs, no scripting — the extension never touches web pages.

## Publishing notes

- Manifest V3, no remote code, no analytics, single-purpose utility
- Suitable for the Chrome Web Store "Productivity" category; privacy policy can state
  "no data collected, no network access"
