# Outreach Sequence Builder v1.0.0

Build multi-step outreach sequences: name a sequence, add steps with a
**day offset**, a **channel** (Email / Call / LinkedIn), and a message
**template** using `{firstName}`, `{company}`, and `{title}` variables.
Preview every step filled in with a sample contact, copy individual
steps or the whole sequence to the clipboard, and keep as many saved
sequences as you like. Ships with an example "SaaS Intro" sequence.

## Try it
1. Unzip `outreach-sequence-builder.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Click the icon: tweak the sample contact, add steps, hit **Copy all**.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.
Edge: `edge://extensions` → Developer mode → Load unpacked.

## Permissions
- `storage` — saves your sequences and sample contact on-device. Nothing else.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration; declare `storage` in the privacy section.
- Firefox Add-ons: free account; extension must pass automated signing (no remote code — clean).
- No network calls, no analytics, no external services.
