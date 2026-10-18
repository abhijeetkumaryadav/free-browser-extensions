# Query Privacy Scrubber v1.0.0

Strips tracking query parameters (`utm_*`, `gclid`, `fbclid`, `msclkid`,
`_ga`, …) from URLs as you browse, using `declarativeNetRequest` redirect
rules. Fully user-controlled: master on/off toggle, editable parameter list
(supports `prefix_*` wildcards), live stripped counter, and a URL preview
tester. Reversible — disable the toggle and URLs pass through untouched.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
Developer mode → Load unpacked → select this folder.

**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
select `manifest.json`. Note: `declarativeNetRequestWithHostAccess` behavior
may differ in Firefox MV3 builds; the preview tester always works.

**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `declarativeNetRequest` | Required to register redirect rules. |
| `declarativeNetRequestWithHostAccess` | Lets the redirect rules act on any site without declaring host permissions; rules only ever strip query parameters, never read page content. |
| `storage` | Saves your parameter list, toggle state, and stats. |

No host permissions declared. No network calls. No data leaves your device.
The stripped-params counter uses `onRuleMatchedDebug`, which fires for
unpacked installs; on store builds the counter stays at 0 (rules still work).

## Publishing notes

- MV3 only, no deprecated APIs.
- `declarativeNetRequestWithHostAccess` is sensitive for store review — the
  listing must clearly describe the parameter-stripping purpose.
