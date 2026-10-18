# PingPlot — HTTP Uptime & Latency Monitor v1.0.0

Monitor any website's uptime with periodic **HTTP(S) latency checks**: enter a URL, pick a check interval, and PingPlot logs every check, draws a latency graph, computes 24h uptime %, and can fire a desktop notification when the site goes down or comes back up.

## Honest scope

Browsers **cannot do ICMP ping** — there is no WebExtensions API for it. PingPlot measures HTTP(S) request round-trip time with `fetch` (HEAD, falling back to GET). That is a solid uptime proxy: if the server answers HTTP, it's up. It is **not** a network-layer ping.

## Features

- User-configured target URL + check interval (1 / 5 / 15 / 30 / 60 min) via `chrome.alarms`
- Immediate first check on start; background checks keep running while the browser is open
- Latency line graph (last 60 checks) with failure markers, drawn on canvas
- Stats: current status, last latency, 24h uptime %, total checks
- Event log: up/down transitions + failures with timestamps; clear button
- Optional desktop notification on status change
- "Check now" manual trigger; live refresh while popup is open
- Config + up to 288 samples stored locally (`chrome.storage.local`)

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist target URL, interval, samples, and settings on-device |
| `alarms` | Schedule periodic checks in the MV3 service worker |
| `notifications` | Optional alert when the monitored site changes up/down state |
| `<all_urls>` (host) | The user types an arbitrary URL to monitor; `fetch` needs host permission for cross-origin checks. No browsing data is collected — only the configured URL is ever fetched. |

## Install (developer mode)

**Chrome / Edge / Opera**
1. Unzip `server-ping-uptime-latency-grapher.zip`
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**
3. **Load unpacked** → select the unzipped folder

**Firefox**: MV3 service workers are supported in recent Firefox, but `chrome.alarms` + `<all_urls>` fetch behavior may differ — treat as Chrome/Edge-first.

## Limitations

- HTTP latency ≠ ICMP ping; TLS handshake and server processing are included in timings
- Sites that block HEAD/GET from extensions (bot protection) may report DOWN while actually up
- Checks stop when the browser is fully closed (alarms re-arm on browser start)

## Publishing notes

- No remote code, no analytics, no data leaves the device except the user's own configured URL fetch
- Declare the `<all_urls>` host permission honestly in the store listing: "checks the single URL you configure"
