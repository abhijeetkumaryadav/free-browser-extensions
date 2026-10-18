# KeyInspect — PGP Public Key Inspector v1.0.0

Paste an armored PGP public key block and inspect it locally: fingerprint,
key ID, algorithm, key size, creation/expiry, user IDs, subkeys, and signature
packet metadata.

## Honest scope

**Parsing & inspection only.** This extension does NOT verify PGP signatures —
signature verification requires a keyring with trust decisions, which this tool
deliberately avoids. Use it to *look at* a key before importing it elsewhere.

## Features

- Armor parsing with CRC24 checksum validation (VALID / MISMATCH badge)
- OpenPGP packet parsing (old + new format headers)
- v4 fingerprint via SHA-1 (`0x99` prefix construction), formatted in groups of 4
- Key ID (last 64 bits of fingerprint)
- Algorithm name, key size in bits (RSA/DSA/ElGamal), creation date
- Expiry from key-expiration signature subpackets
- User ID packets, subkey list, signature packet list (type, hash algo, issuer)
- Copy fingerprint / copy full report as JSON
- Draft autosave (local only)

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
is standard WebExtensions + WebCrypto.

## Publishing notes

- MV3, no remote code, no data collection — store-friendly.
- The in-popup disclaimer ("parsing only, not signature verification") must stay.
