# Permission Audit — Extension Security Scanner v1.0.0

A read-only security audit of your installed browser extensions. Lists every
extension with its full permission inventory, flags risky permissions
(`<all_urls>`, `webRequestBlocking`, `debugger`, `nativeMessaging`, …) with
severity badges, and computes a 0–100 risk score per extension.

## Install

**Chrome / Edge:** unzip → `chrome://extensions` (or `edge://extensions`) →
Developer mode → Load unpacked → select this folder.

**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
select `manifest.json`. Note: `chrome.management.getAll()` host-permission
details vary by browser; permission names still audit correctly.

**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `management` | Read-only listing of installed extensions + their permissions. Nothing is modified. |
| `storage` | Remembers your sort preference. |

No host permissions. No network calls. No data leaves your device.

## Publishing notes

- MV3 only, no deprecated APIs.
- `management` is a sensitive permission for store review — the listing must
  describe the audit purpose; the extension is strictly read-only.
- Firefox: `browser.management` works; host permission detail may be limited —
  the popup degrades gracefully.
