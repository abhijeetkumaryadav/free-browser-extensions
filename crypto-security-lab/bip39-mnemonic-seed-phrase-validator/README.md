# MnemoCheck — BIP39 Mnemonic Validator (v1.0.0)

Validate BIP39 mnemonic seed phrases locally: word count (12/15/18/21/24), membership in the official English wordlist (2048 words, vendored at build time), and the BIP39 checksum.

⚠️ **Safety:** a strong warning is shown in the popup — never enter a real seed phrase that controls funds. This tool is for testing and learning. Nothing is ever transmitted; there is no network code at all.

## Features
- Three checks with pass/fail detail: word count, wordlist membership (unknown words named with positions), checksum
- Copyable validation report
- Enter key triggers validation
- Wordlist vendored locally (public domain, bitcoin/bips)

## Install
1. Unzip `bip39-mnemonic-seed-phrase-validator.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

## Permissions
- None. The extension requests zero permissions.

No network calls are made, ever. Works in Chrome, Edge, Opera; Firefox via temporary add-on load.

## Publishing notes
- Zero permissions + no remote code → store-friendly.
- Listing copy must keep the "never enter a real funded seed" warning.
