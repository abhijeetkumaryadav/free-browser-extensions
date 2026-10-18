# NetLock — Tab Network Lockout v1.0.0

Panic-button network lockout for the current tab. One click freezes the tab's
network activity; one more click restores it.

## What it does

- **Lock network**: injects a guard into the current tab (page's MAIN world, at
  `document_start`) that neuters `fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource`, `sendBeacon`, dynamic subresource loading (`img`/`video`/`audio`/
  `script`/`iframe` `src` setters), link clicks, form submits and `window.open`.
  It also flips `navigator.onLine` to `false` and fires an `offline` event so the
  page shows its own offline state, plus a red banner across the top.
- **Badge**: locked tabs get a 🔒 badge and tooltip.
- **Deep block (optional)**: also blocks the locked site's own resources at the
  network layer via a session-scoped `declarativeNetRequest` rule. Asks for host
  permission for that site only, at lock time; the permission is released on unlock.
- **Auto-lock domains**: list domains that should be locked automatically whenever
  you open them.
- **Unlock**: removes the guard scripts and rules, clears the badge, and reloads
  the tab so it picks up a live network stack again.

## Honest scope

- Tab/site-scoped only — never system-wide. It does not touch other tabs,
  other apps, or the OS network stack.
- Requests already in flight when you lock may complete; the guard stops *new*
  network activity.
- Locks are session-scoped: they do not survive a browser restart (session
  `declarativeNetRequest` rules and non-persistent content scripts vanish).
- Cannot lock `chrome://` pages, the Web Store, or other restricted pages.

## Install

1. Unzip, then open `chrome://extensions` (Edge: `edge://extensions`).
2. Enable **Developer mode**, click **Load unpacked**, select this folder.
3. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on (service
   worker APIs used here are Chromium-first; Firefox support is best-effort).

## Permissions — why each is needed

| Permission | Why |
|---|---|
| `storage` | Lock state (session) + settings/auto-lock list (local). |
| `scripting` | Inject/remove the per-tab guard script. Only ever on tabs you lock. |
| `activeTab` | Identify and act on the tab you click the popup from. |
| `tabs` | Read tab URLs for auto-lock matching and per-tab badges. |
| `declarativeNetRequest` | Session-scoped deep-block rules for the locked site only. |
| Optional host access | Requested per-site at lock time *only* when Deep block is on. |

## Privacy

Everything runs on-device. No analytics, no network calls, no data leaves the browser.

## Publishing notes

- Chrome Web Store: single-purpose (tab network lockout), minimal permissions,
  no remote code. The optional host permission is requested at runtime with a
  clear in-product explanation.
- Edge Add-ons: same package works as-is.
