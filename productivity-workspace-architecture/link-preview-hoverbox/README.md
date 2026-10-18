# Link Preview Hoverbox v1.0.0

Hover any link for ~600ms and a small card appears near your cursor
showing the link's **domain**, **full URL**, and heuristic safety badges:

- **External** — points to a different website
- **Download** — looks like a file download (.pdf, .zip, .exe, …)
- **Suspicious** — URL-shape heuristics: IP host, look-alike (punycode)
  domain, embedded credentials, excessive subdomains, odd TLD, very long URL
- **Non-web** — `mailto:`, `tel:`, `javascript:`, etc.

The link target is **never fetched or contacted** — analysis is a local
URL-shape check only. Toggle previews and tune the hover delay from the
popup. Esc or scrolling dismisses the card.

## Try it
1. Unzip `link-preview-hoverbox.zip`.
2. **Chrome / Edge:** open `chrome://extensions`, enable **Developer mode**,
   click **Load unpacked**, and select the folder.
3. **Firefox:** open `about:debugging#/runtime/this-firefox`, click
   **Load Temporary Add-on**, and select `manifest.json` (temporary until
   signed via AMO for permanent installs).
4. Hover any link and wait a beat.

## Permissions
- `storage` — saves your enable toggle and hover-delay preference on-device.
- Host access (`<all_urls>` content script) — required to watch for link
  hovers on every page. No page content is read, stored, or transmitted,
  and no network requests are made.

## Publishing notes
- Manifest V3, zero network calls, zero analytics.
- Chrome Web Store: $5 one-time developer registration.
