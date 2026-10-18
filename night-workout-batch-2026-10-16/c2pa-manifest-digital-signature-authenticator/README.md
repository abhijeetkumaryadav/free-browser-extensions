# C2PA Concepts — Provenance Explainer & Notes

**Educational only — not authentication.** This extension explains the building
blocks of C2PA content provenance (manifests, digital signatures, signers,
trust lists) in plain language, and gives you a private notebook for your own
verification notes.

## What's inside

- **Learn tab** — six concept cards: Content Credentials (C2PA), the manifest,
  digital signatures, signers & certificates, trust lists, and an honest list of
  what this tool cannot do.
- **My notes tab** — add private notes (title + details), search them, delete
  them. Stored in `chrome.storage.local` on your machine.

## Important limits

- It cannot read a C2PA manifest, check a signature, or verify an image.
- Metadata can be stripped or faked — treat provenance as one clue, never a
  verdict.
- Nothing is uploaded or transmitted anywhere.
