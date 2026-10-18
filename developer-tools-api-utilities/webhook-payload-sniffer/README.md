# Webhook Payload Sniffer v1.0.0

A **webhook testing workbench** — paste JSON payloads, validate and
pretty-print them, generate ready-to-run `curl` commands against a
test endpoint **you** type in, and keep a history of test payloads.
Everything stays on your device.

> This is a workbench, not a sniffer: it does **not** intercept live
> network traffic. Nothing is sent anywhere automatically.

## Try it
1. Unzip `webhook-payload-sniffer.zip`.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the folder.
3. Pin the extension, click its icon, paste a JSON payload → **Validate**.
4. Type your test endpoint URL, pick a method, **Generate curl**, then run it in your terminal.

## Permissions (minimal)
- `storage` — saves your payload history on-device. That's it. No
  host permissions, no network interception, no data leaves the machine.

## Publishing notes
- Single-purpose, no remote code, no data collection — straightforward
  Chrome Web Store / Edge Add-ons review.
- Firefox: same MV3 manifest works; submit via AMO.
