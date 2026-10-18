# Handshake Tester — Webhook Endpoint Checker

Test your own webhook / API endpoints with a canned JSON payload and inspect
the status code, response headers, latency, and body — all inside the popup.

## Honest scope

- **Tests your endpoints — not AI negotiation.** There is no AI, no agent
  protocol, and no handshake logic here: it sends an HTTP request you compose
  to a URL you entered, and shows what came back.
- Requests are sent **only** to endpoints you explicitly save. The extension
  makes no other network requests.
- Only `http:`/`https:` URLs are accepted.

## Usage

1. Add an endpoint: name, full URL, and HTTP method. It is saved locally.
2. Edit the JSON payload (or leave it empty for bodyless methods).
3. Pick the endpoint and click **Send test**.
4. Read the status, latency, headers, and the first 2 KB of the body.

## Permissions

- `storage` — saves your endpoints locally.
- `host_permissions: <all_urls>` — required because endpoints can live on any
  host you choose; fetch is only ever called with your saved URLs.

## Privacy

Everything stays on your machine except the test request you deliberately send
to your own endpoint. No analytics, no remote code.
