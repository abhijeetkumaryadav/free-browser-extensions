# Zero-Knowledge Proof Session Authenticator (Demo) v1.0.0

An **educational simulator** of a Schnorr-style zero-knowledge challenge-response login flow, running entirely locally between a "prover" panel and a "verifier" panel.

## Honest scope — read this

- **Teaching demo only. NOT real authentication security.** The group parameters are toy-sized (p = 23, q = 11, g = 2) and are breakable in milliseconds by design.
- Demonstrates the *protocol flow*: keygen → commitment → challenge → response → verification, and the key ZK property (the verifier is convinced without learning the secret `x`).
- Randomness uses `crypto.getRandomValues`; arithmetic is plain BigInt modular math.
- Do not use this (or anything like it at this scale) to protect real accounts.

## How to play

1. **Keygen** — prover picks secret `x`, publishes `y = gˣ mod p`
2. **Commit** — prover picks random `r`, sends `t = gʳ`
3. **Challenge** — verifier picks random `c`
4. **Respond** — prover sends `s = r + c·x mod q`
5. **Verify** — verifier checks `gˢ ≟ t·yᶜ (mod p)`

Or press **Run full protocol** to watch all five steps with a narrated log.

## Permissions

- `storage` — reserved for future session settings (currently unused beyond defaults).

## Files

- `manifest.json`, `popup.html`, `popup.css`, `popup.js`
- `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

MV3 only. Chrome / Edge / Firefox / Opera compatible.
