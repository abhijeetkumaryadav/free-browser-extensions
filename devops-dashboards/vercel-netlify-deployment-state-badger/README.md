# DeployBadger — Vercel & Netlify Deployment Status v1.0.0

Track your Vercel and Netlify deployments from the toolbar: recent deployments
with READY / BUILDING / ERROR badges, manual refresh, optional 5-minute
auto-refresh, and a red toolbar badge counting failed deployments.

## Your token is required (by design)

This extension ships with **no credentials**. To use it:

1. **Vercel** — go to vercel.com → your Account → **Tokens**, create a token
   (read scope is enough).
2. **Netlify** — go to app.netlify.com → User settings → **Applications** →
   **New access token**.
3. Open the extension, pick the provider, paste the token, click
   **Save & connect**. The token is validated with one API call before saving.

The token is stored **only** in `chrome.storage.local` on your device and is
sent **only** to the selected provider's API (`api.vercel.com` or
`api.netlify.com`). "Forget token & disconnect" (log-out icon) wipes it.

## Install

**Chrome / Edge / Opera**
1. Unzip `vercel-netlify-deployment-state-badger.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox** — MV3 is supported, but the `alarms`-based badge refresh and the
Vercel/Netlify host permissions behave the same as Chromium in current
Firefox. Load via `about:debugging → This Firefox → Load Temporary Add-on`
(select `manifest.json`).

## Permissions — why each one

| Permission | Why |
|---|---|
| `storage` | Store your token, provider choice, and auto-refresh preference locally. |
| `alarms` | Optional 5-minute auto-refresh that updates the failed-count badge. |
| Host: `api.vercel.com`, `api.netlify.com` | Fetch your deployments from the provider you configured. No other network calls are made. |

## Publishing notes

- No remote code: all logic is bundled; only provider REST APIs are called.
- Privacy: the token never leaves the device except to its own provider API.
- Single purpose: deployment status monitoring.
