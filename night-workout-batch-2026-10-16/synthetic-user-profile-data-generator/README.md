# Test Profile Generator — Dev Fake Data

Generates **clearly-fake** test profiles for form testing. 100% local, zero network.

## TEST DATA ONLY

Every value is obviously fictional:
- Names: `Test User-XXXX`
- Emails: `test.user.xxxx@example.test` (RFC 2606 reserved TLD — undeliverable by design)
- Phones: `555-01XX` (fictional range)
- Addresses/companies marked TEST

**These profiles are never usable as real identities.** Use them to test form validation, UI layouts, and data pipelines — never to impersonate anyone or create accounts.

## Features

- Generate 1–20 profiles at once
- Toggle which fields to include (name, email, phone, address, company, DOB)
- Card view of each generated profile
- Copy all as formatted JSON

## Permissions

- `storage` — caches nothing sensitive; reserved for future preference storage
