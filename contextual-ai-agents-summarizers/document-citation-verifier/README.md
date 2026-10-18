# Document Citation Verifier v1.0.0

Collect every outbound link on the page you're viewing, then
best-effort verify each one: the extension opens it briefly in a
**hidden background tab**, checks for browser error signals, and
closes the tab. Results table shows **alive / dead / unknown**
("unknown" = the page blocked inspection, e.g. store pages — not
necessarily broken), with one-click **CSV export**.

## Try it
1. Unzip `document-citation-verifier.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select folder.
3. Open any article or doc with links → click the icon → **Verify links** → keep the popup open while it checks.

## Permissions
- `activeTab` + `scripting` — read the page's links and probe each link in a tab you never see.
- `storage` — last verification runs cached on-device. Nothing uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee. No remote code, no network calls of its own.
- Firefox: MV3 compatible as written.
- Note for review: tabs are created inactive and closed immediately after the check; nothing is downloaded.
