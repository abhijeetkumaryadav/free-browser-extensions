# Grammar & Style Regulation Checker v1.0.0

Paste any text and check it against your own style regulations —
entirely on-device, nothing is sent anywhere:

- **Passive voice** — flags sentences like “was written by…”
- **Long sentences** — over your configurable word limit (default 25)
- **Banned words & phrases** — your editable list (e.g. “very”, “utilize”)
- **Repeated words** — catches “the the”
- **Readability** — Flesch Reading Ease score + 0–100 style score

Findings are listed with the offending sentence for context.
Regulations (word limit + banned list) persist on this device.

## Try it
1. Unzip `grammar-style-regulation-checker.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Paste text, hit **Analyze text**, tune your regulations below.

## Permissions
- `storage` only — saves your word limit and banned-phrase list.

## Publishing notes
- No network access, no data leaves the device.
- Chrome Web Store: $5 one-time developer registration fee.
- Firefox: self-distribute signed via AMO (free).
