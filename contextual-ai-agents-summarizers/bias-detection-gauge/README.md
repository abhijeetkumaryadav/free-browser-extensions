# Bias Detection Gauge v1.0.0

Paste any text and get an on-device heuristic scan for
loaded-language signals: absolutist terms ("always", "never"),
emotionally charged adjectives, and one-sided framing markers
("everyone knows", "so-called"). Shows a 0–100 signal-strength
gauge plus every flagged phrase with its category.

**Clearly labeled as a heuristic writing aid — not a verdict on
truth.** It flags word choices that *can* signal slanted framing;
context decides.

## Try it
1. Unzip `bias-detection-gauge.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon, paste text, hit **Analyze**.

## Publishing notes
- Permissions: `storage` only (remembers your last pasted text).
  Nothing uploaded — analysis runs entirely on-device.
- Chrome Web Store: $5 one-time dev fee.
