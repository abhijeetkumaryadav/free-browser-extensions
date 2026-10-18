# PlainStrip — Rich Text to Plain Text (v1.0.0)

Paste rich or formatted text and get clean plain text back. Strips fonts, colors,
bold/italic, links, and other formatting while keeping the words — with options
for line breaks, trimming, and blank-line collapsing.

## Install

**Chrome / Edge:**
1. Download and unzip `clipboard-rich-text-stripper.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox:** this package targets Chromium MV3. Firefox supports MV3 with minor
adjustments (`clipboardRead`/`clipboardWrite` are not Firefox permissions — the
"Strip clipboard" and copy buttons may need page-context permission prompts).

## Usage

- **Paste** rich text (Ctrl+V) into the Input box — the extension reads the HTML
  flavor and strips tags to plain text automatically.
- **Strip clipboard** reads the clipboard text on demand (only when you click it).
- Toggle options: keep line breaks, trim each line, collapse blank lines,
  collapse spaces.
- **Copy result** copies the plain text; **Save to history** keeps it locally
  (20 most recent, click an entry to reload it).

## Permissions (justified)

| Permission | Why |
|---|---|
| `storage` | Saves options and the stripped-text history on-device |
| `clipboardRead` | Reads clipboard text **only** when you click "Strip clipboard" |
| `clipboardWrite` | Copies the stripped result when you click "Copy result" |

No network calls. No data leaves the device.

## Publishing notes

- MV3 only, no remote code, no deprecated APIs.
- Clipboard read is gesture-gated; safe for Chrome Web Store review.
