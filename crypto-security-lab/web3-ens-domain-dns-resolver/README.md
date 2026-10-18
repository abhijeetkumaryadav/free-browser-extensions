# ENSResolve — Web3 ENS Domain Resolver v1.0.0

Resolve **ENS names** (e.g. `vitalik.eth`) to Ethereum addresses — and reverse-lookup any address to its primary name. Read-only, no wallet, no keys, no signing.

## How it works
1. **Namehash (EIP-137)** computed locally with a bundled keccak-256 implementation
2. `eth_call` to the ENS registry contract → resolver address
3. `eth_call` to the resolver → `addr(node)` → Ethereum address
4. Reverse: `namehash(<address>.addr.reverse)` → `name(node)` → primary name

Lookups go to free public JSON-RPC gateways (Cloudflare's `cloudflare-eth.com` first, `ethereum.publicnode.com` as fallback). No API keys anywhere.

## Features
- Forward resolution: ENS name → 0x address
- Reverse resolution: 0x address → primary ENS name
- Shows namehash, resolver contract, resolved address, primary name
- Click-to-copy address; last query remembered locally

## Honest scope
- **Read-only.** Cannot send transactions, manage names, or renew domains.
- Only names with a resolver + address record set will resolve; unregistered names report "not registered".
- ENS data is public on-chain data; gateways are third-party public endpoints (rate limits may apply).

## Permissions
- `storage` — remembers the last query.
- Host permissions: `https://cloudflare-eth.com/`, `https://ethereum.publicnode.com/` — the only network destinations (JSON-RPC `eth_call` only).

## Install (Chrome / Edge / Opera)
1. Unzip `web3-ens-domain-dns-resolver.zip`
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → select the unzipped folder

Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.

## Publishing notes
- Manifest V3. No remote code — keccak-256 and namehash are bundled.
- Cryptography verified: keccak-256 matches RFC-style vectors (`""`, `"abc"`), namehash matches the official ENS documentation vectors (`eth`, `vitalik.eth`).
