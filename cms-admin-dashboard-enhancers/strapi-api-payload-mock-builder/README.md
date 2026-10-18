# Strapi Mock Payload Builder v1.0.0

Define a Strapi-style content-type schema (field name + type) and generate
realistic mock JSON payloads — single entries or collections — in the Strapi v5
response shape (`{ data, meta }`). 100% offline.

## Features
- Field editor: 15 field types (string, text, number, integer, float, boolean,
  date, datetime, email, url, enumeration, array, json, relation, media)
- Realistic mock values aware of field names (`title`, `slug`, `email`, …)
- Single entry or collection mode (1–50 entries) with Strapi v5 pagination meta
- Save / load / delete named schemas (on-device)
- Copy JSON to clipboard, download as `.json`

## Install
**Chrome / Edge:** unzip → `chrome://extensions` → Developer mode → Load unpacked → select the folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.

## Permissions (justified)
- `storage` — persist saved schemas on-device only.
- `clipboardWrite` — copy generated JSON on click.

No host permissions, no network calls, no remote code. Everything stays on-device.

## Publishing notes
MV3, no deprecated APIs. Pure generator tool — no page access, no data
collection — so the store privacy questionnaire is trivial (no data collected).
