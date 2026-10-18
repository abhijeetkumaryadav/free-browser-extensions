# FakeForge — Synthetic Data Form Generator

Generate realistic-but-**fake** test data for development and QA: full profiles,
names, emails, phones, addresses, companies, usernames, passwords, UUIDs, dates,
and lorem text. Copy any value with one click, or fill the current page's form
with synthetic data in one click.

## What it does

- **Full profile generator** — one click creates a coherent fake identity
  (name, email, phone, address, company, username, birth date, UUID);
  click any field to copy it, or copy the whole profile as JSON.
- **Individual field generators** — 10 field types, each with regenerate and
  copy buttons.
- **One-click form fill** — fills visible form fields on the active tab using
  label/name heuristics (email → fake email, tel → fake phone, etc.).
  Skips hidden, disabled, file, checkbox, and submit inputs. Uses native value
  setters so React/Vue forms pick up the values.
- **Recent history** — last 12 copied values, click to copy again.

## Honest scope

All data is **synthetic and fictional** (555-01xx phone range, example.com-style
domains). It is for testing forms and UIs only — never real people's data.
Form filling runs only when you click the button, on the tab you're viewing.

## Install

**Chrome / Edge**
1. Unzip the package.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox** (temporary)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and choose `manifest.json`.
3. Note: one-click form fill uses `chrome.scripting`; on Firefox use the
   individual copy buttons.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save recent-values history on-device. |
| `activeTab` | Identify the tab to fill when you click the button. |
| `scripting` | Inject the filler into the active tab on your click only. |

No host permissions, no background page, no network access.

## Publishing notes

- Manifest V3, no deprecated APIs.
- Privacy: all data is generated locally; nothing is collected or transmitted.
- Store data-safety: no data collected, no data transmitted.
