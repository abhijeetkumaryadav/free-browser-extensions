# Schema Markup Validator — LocalBusiness v1.0.0

Validate LocalBusiness JSON-LD schema markup: required/recommended fields per
schema.org, shape checks (PostalAddress, GeoCoordinates, opening hours,
aggregateRating), and fix hints. Paste markup or scan the current page's
embedded JSON-LD with one click. 100% client-side — nothing leaves your device.

## Install (unpacked, development)

**Chrome / Edge**
1. Unzip `schema-markup-local-business-validator.zip` (keep the folder).
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** → select the unzipped folder.

**Firefox**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**.
2. Select `manifest.json` inside the unzipped folder.
3. Note: temporary add-ons unload when Firefox closes.

## Permissions (minimal, justified)

| Permission | Why |
|---|---|
| `activeTab` | Read the active tab's URL/type so "Scan this page" only runs on real web pages |
| `scripting` | Inject a read-only collector (on click only) that returns the page's `application/ld+json` blocks |
| `storage` | Remember your last pasted markup on-device |
| `clipboardWrite` | "Copy report" button |

No host permissions, no network calls. The page collector only runs when you
click "Scan this page", and only reads JSON-LD script blocks.

## What's checked

- **Required (errors):** `@context` referencing schema.org, `@type`, `name`
- **Recommended (warnings):** `address`, `telephone`, `url`, `image`,
  `priceRange`, `openingHoursSpecification`, `geo`
- **Shapes:** PostalAddress sub-fields, latitude/longitude ranges, day-of-week
  names, `HH:MM` times, ratingValue bounds, URL validity
- **Multi-node:** handles `@graph` arrays and multiple blocks, labeling each

## Publishing notes

- MV3 only, no deprecated APIs.
- Privacy: no data collection; the store privacy disclosure can state that no
  user data is collected or transmitted.
- Suggested store category: Developer Tools.
