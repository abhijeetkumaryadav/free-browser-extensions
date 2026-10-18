# FlowWatch — GitHub Actions Status Ticker

A polished popup that tracks GitHub Actions workflow runs for any repository you configure: live status/conclusion badges, branch + event + relative time per run, one-click refresh, and an optional 5-minute auto-refresh that keeps a red failed-run count on the toolbar badge.

## Your token, your device

FlowWatch **requires your own GitHub personal access token** (classic, `repo` scope) — nothing is hardcoded and there is no bundled credential of any kind.

- The token is entered by you in Settings and stored only in `chrome.storage.local` on your device.
- It is sent exclusively to `https://api.github.com` for the repositories you configure.
- "Forget token" wipes the token, repo, and cached runs from the device.

## Install (developer mode)

**Chrome / Edge / Opera:**
1. Unzip `github-actions-workflow-status-ticker.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:** this build targets Chromium's MV3. Firefox supports MV3 but `host_permissions` and the `alarms`-driven service worker behave slightly differently; the popup core (fetch with your token) works wherever `fetch` to api.github.com is allowed.

## Use

1. Click the toolbar icon → **Settings** (gear).
2. Create a token at GitHub → Settings → Developer settings → Personal access tokens (classic) with the `repo` scope.
3. Paste the token, enter owner + repository, enable auto-refresh if you want the badge, then **Save & connect**.
4. Click any run card to open it on GitHub.

## Permissions — why each one

| Permission | Why |
|---|---|
| `storage` | Stores your token, repo, auto-refresh preference, and cached runs locally. |
| `alarms` | Drives the optional 5-minute background refresh that updates the toolbar badge. |
| Host: `https://api.github.com/*` | Only network destination: the GitHub REST API, using your token. |

## Publishing notes

- No remote code, no analytics, no bundled secrets.
- The token field is user-supplied; never ship a build with a token in it.
- Store listing should repeat: "Requires your own GitHub personal access token (classic, repo scope)."
