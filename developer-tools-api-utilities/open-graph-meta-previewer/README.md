# Open Graph Meta Previewer v1.0.0

Scan any page and see exactly how it will look when shared:
realistic **X/Twitter**, **Facebook**, and **LinkedIn** card previews,
plus a **meta completeness score** with a checklist — missing
`og:image`, title/description too long or too short, missing
`twitter:card`, and more.

## Try it
1. Unzip `open-graph-meta-previewer.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select the folder.
3. Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `manifest.json`.
4. Open any article or product page → **Scan page**.

Previews are approximations of each network's card renderer.

## Permissions
- `activeTab` + `scripting`: read meta tags from the page you scan.
- Nothing is stored or uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee.
- Firefox Add-ons: free, requires Mozilla signing.
