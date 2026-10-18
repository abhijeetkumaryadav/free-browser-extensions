# Business Registry EIN Lookup Helper v1.0.0

A business-registry assistant for EIN and entity lookups: a **curated directory
of official state/federal registry links**, a **step-by-step lookup checklist**
with progress tracking, and a **per-registry notes field** for your findings.
100% offline — no IRS access, no government IDs collected or stored.

## Features

- **Official registry directory** — 10 curated official portals:
  - IRS: EIN online application, Tax Exempt Organization Search
  - SAM.gov entity registration, SEC EDGAR company search, USPTO trademark search
  - State registries: Delaware, California, New York, Florida, Texas
  - Each opens in a new tab; search filter across names/descriptions.
- **6-step EIN lookup checklist** — confirm legal name → identify formation
  state → check EIN status → search state registry → verify registered agent →
  record findings. Progress bar + reset.
- **Per-registry notes** — expandable notes field on every registry card,
  autosaved on-device (debounced) for dates, entity numbers, and links.
- **Custom registries** — add your own official links (name + URL), delete them
  any time.

## Honest scope

- This is a **directory + checklist + notes** tool, not an IRS integration. It
  cannot and does not query the IRS, retrieve EINs, or access any government
  database. It never asks for, collects, or stores SSNs, EINs, or any
  government ID — the notes fields are free text for your own records.
- Curated links are the public official portals; open them and complete each
  lookup yourself following the checklist.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist checklist state, notes, and custom registries on-device. |

No host permissions, no content scripts, no network access by the extension
itself (links you click open in your browser normally).

## Install

**Chrome / Edge:** unzip → `chrome://extensions` → Developer mode → Load unpacked → select this folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json`.
**Opera:** `opera://extensions` → Developer mode → Load unpacked.

## Publishing notes

- MV3 only, no deprecated APIs.
- Single minimal permission (`storage`) — store-safe.
- No remote code, no data collection — privacy disclosure: "no data collected".
