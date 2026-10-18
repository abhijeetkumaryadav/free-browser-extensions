# Signature Block Formatter

Design an email signature in the popup, preview it in **Markdown** and **plain text**, and copy either format with one click.

## How to use

1. Fill in name, role, company, phone, email, website, and socials (one per line as `Label, URL`).
2. Toggle between the **Markdown** and **Plain text** tabs to preview each format.
3. Click **Copy shown format** — or reset to a blank signature.
4. Your draft autosaves locally, so it survives closing the popup.

## Honest scope

- **Markdown / plain text only — not HTML signatures.** Rich HTML signatures are out of scope.
- Everything stays in `chrome.storage.local` — nothing is uploaded anywhere.
