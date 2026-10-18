# Yarn / npm Package Checker v1.0.0

Paste a `package.json` (or just its `dependencies`/`devDependencies`
block) and every dependency is looked up live on the public npm
registry. For each package you get: your version vs the latest
published version, an **Outdated** / **Up to date** / **Deprecated** /
**Not found** verdict, and its license. Summary counts plus a
one-click markdown report you can paste into a PR.

The pasted JSON never leaves your machine — only public, read-only
registry lookups are made.

## Try it
1. Unzip `yarn-npm-package-checker.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon, paste a package.json, hit **Check packages**.

## Permissions
- `host_permissions: https://registry.npmjs.org/*` — read-only version
  metadata lookups. No user data is sent anywhere.

## Publishing notes
- Chrome Web Store: $5 one-time dev fee; Firefox: free, needs signing.
- Single host permission, clearly justified in the store listing.
