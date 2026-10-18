# NetCheck — IP Address Validator

Validate IPv4/IPv6 addresses, classify them, and inspect CIDR ranges — all computed locally from the text you type.

## What it does

- **Validation** — full IPv4 parser (octet range checks) and IPv6 parser (`::` compression, embedded IPv4 like `::ffff:1.2.3.4`).
- **Classification** — private (RFC 1918), public, loopback, link-local/APIPA, multicast, CGNAT shared space, documentation ranges, reserved, unspecified, unique-local (IPv6).
- **Details** — integer value, binary, hex, legacy class, reverse-DNS name (`in-addr.arpa` / `ip6.arpa`), expanded + RFC 5952-compressed IPv6 forms.
- **CIDR** — append `/24` (or any valid prefix) to see the network address, total addresses, and usable hosts.
- Live validation while typing, example chips, Enter-to-check.

The parsing logic is covered by 53 Node unit tests (`test.js`).

## Honest scope

- NetCheck is a **pure string validator**. It never touches the network, never scans hosts, never probes ports, and never performs DNS lookups. Everything is computed locally.

## Permissions

None. Zero permissions requested.

## Install (development)

**Chrome / Edge / Opera:**
1. Download and unzip `local-network-ip-address-validator.zip`
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the unzipped folder

**Firefox:** Load via `about:debugging` → This Firefox → Load Temporary Add-on.

## Publishing notes

- MV3, no deprecated APIs, no permissions — minimal review surface.
