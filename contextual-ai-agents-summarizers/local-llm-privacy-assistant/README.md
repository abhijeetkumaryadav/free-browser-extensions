# LLM Privacy Shield v1.0.0

Paste the text you'd send to an AI chatbot. On-device detection
highlights emails, phone numbers, ID / card-like numbers, street
addresses, and possible person names, with per-type counts.
**Redact all** swaps them for `[EMAIL]`, `[PHONE]`, etc., and
**Copy redacted** puts the safe version on your clipboard. A privacy
checklist reminds you what never to paste. Zero permissions —
everything runs locally in the popup.

Detection is heuristic: always give the redacted text a final look.

## Try it
1. Unzip `local-llm-privacy-assistant.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Paste text → **Scan for PII** → **Redact all** → **Copy redacted**.

## Publishing notes
- Permissions: none. Nothing leaves the device, nothing is stored.
- Chrome Web Store: $5 one-time dev fee. Firefox: sign the same MV3 build.
