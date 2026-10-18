# RegexLab — Bulk Find & Replace

Define multiple find → replace rules and transform text in one pass:

- **Per-rule mode:** plain text (special characters auto-escaped) or
  regular expression (supports `$1`-style group references).
- **Per-rule flags:** case-insensitive toggle, enable/disable toggle.
- **Live preview:** each rule shows its match count against your source,
  and the result panel updates as you type.
- **Rule sets:** save named sets of rules, reload or delete them later.
- Draft (source text + rules) autosaves locally.

## Install (Chrome / Edge / Opera)

1. Download and unzip `regex-bulk-find-replace-panel.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on →
select `manifest.json`.

## Permissions

- `storage` — autosaves your draft and saved rule sets locally.

## Tips

- Rules apply **sequentially** in list order; later rules see the output
  of earlier ones.
- An invalid regex is flagged on its rule badge instead of breaking
  everything else.

## Publishing notes

- Manifest V3, no remote code, no network calls, no analytics.
- Single `storage` permission, justified above.
