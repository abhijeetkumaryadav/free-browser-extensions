# JwtLens — Client-Side JWT Decoder v1.0.0

Paste a JSON Web Token and decode it locally: header, payload claims, token
lifetime (iat/exp/nbf) with a live expiry status, and signature presence.

## Honest scope

**Decode only.** This extension never verifies signatures and never handles
secrets or keys. Decoding a JWT does not prove it is authentic — always verify
signatures server-side. A warning to avoid pasting production tokens is shown
in the popup.

## Features

- base64url decode of header + payload (strict validation, clear errors)
- Claims table: issued-at, expires, not-before (human UTC dates)
- Live status: Valid / expires soon / EXPIRED / not yet valid
- Signature panel: algorithm from header, signature presence, explicit
  "NOT verified" label; special warning for `alg=none`
- JSON syntax-highlighted header + payload views, copy buttons
- Token draft autosave (text only, local)

## Permissions

- `storage` — remembers your pasted draft locally. That's it.

## Privacy

100% local. No network calls. Nothing you paste ever leaves the device.

## Install

1. Unzip the package (keep `manifest.json` at the zip root).
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**.
4. **Load unpacked** → select the unzipped folder.

Works in Chrome, Edge, Opera. Firefox: loads as a temporary add-on; all logic
is standard WebExtensions APIs.

## Publishing notes

- MV3, no remote code, no data collection — store-friendly.
- The decode-only / never-verified disclaimer must stay in the popup.
