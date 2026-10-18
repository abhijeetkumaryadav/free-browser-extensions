# User-Agent Profile Switcher v1.0.0

Dev/testing tool: pick a User-Agent profile (Chrome/Windows,
Safari/iPhone, Firefox/Linux, Googlebot, or your own custom string)
and apply it to **main-frame requests on sites you explicitly
enable**. Uses `declarativeNetRequest` `modifyHeaders` — no code
runs in pages, and one click resets everything.

The extension only requests host permission for each site when you
add it, and releases it when you remove it.

## Try it
1. Unzip `user-agent-profile-switcher.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open a site → click the icon → **Enable current site** → pick a profile → toggle on.

## Permissions
- `declarativeNetRequest` — rewrite the User-Agent request header on
  enabled sites (the whole point of the tool).
- `storage` — profiles, custom string, and the enabled-site list,
  on-device only.
- `activeTab` — read the current tab's URL so "Enable current site" works.
- Optional host permissions — requested per site, only when you add it.

## Publishing notes
- Chrome: one-time $5 developer registration. Edge: free.
- Firefox: declarativeNetRequest is supported in MV3 on recent
  versions; optional host permissions flow works via `permissions.request`.
- Clearly a testing utility — nothing is obfuscated, no traffic is
  intercepted, and the user controls exactly which sites are affected.
