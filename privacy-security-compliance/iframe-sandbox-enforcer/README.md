# Iframe Sandbox Enforcer v1.0.0

Harden embedded iframes on any page: list them, sandbox them, or block third-party frames — with per-site policies and one-click restore.

## What it does

- **Scan this page** — lists every `<iframe>` with its source URL, first-party/third-party badge, and current sandbox state.
- **Per-frame actions** — apply a strict `sandbox` attribute (empty value = most restrictive) or remove it again.
- **Bulk actions** — sandbox all frames, or remove third-party frames from the page.
- **Site policies** — remember an enforcement mode per origin (off / sandbox third-party / sandbox all / block third-party) applied automatically when pages load.
- Everything is in-memory and reversible: reloading the page restores the original state.

## Install

**Chrome / Edge**
1. Unzip `iframe-sandbox-enforcer.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**
1. Unzip the package.
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.

**Opera** — same as Chrome via `opera://extensions`.

## Permissions (and why)

| Permission | Why |
|---|---|
| `storage` | Remembers your per-site enforcement policies on-device. |
| `scripting` | Scans iframes and applies sandbox attributes in the active tab, only when you ask (or for a site you enabled). |
| `activeTab` | Lets the popup read and harden the tab you clicked the icon on. |
| Optional host access (`<all_urls>`) | Requested **only** when you save a per-site policy, scoped to that origin, so the background worker can enforce it on page load. Revocable anytime via the policy toggle or `chrome://extensions`. |

No network requests are ever made. No data leaves your device.

## Publishing notes

- MV3 only; no deprecated APIs.
- Store listing: describe the optional host permission clearly ("used only for sites where you enable automatic iframe hardening").
- Screenshots: popup scan results on a page with embedded frames.
