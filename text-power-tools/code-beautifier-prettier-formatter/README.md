# Beautify — Code Formatter

Paste messy code and clean it up with a built-in **heuristic** beautifier:
brace-aware indentation for JavaScript and CSS, plus JSON pretty-print
with validation. Everything runs on-device.

> **Honest scope:** this is a hand-written heuristic formatter, **not
> Prettier**. It normalizes indentation and line breaks but does not do
> full parsing, operator wrapping, or opinionated style rules. Review the
> output before shipping.

## Install (Chrome / Edge / Opera)

1. Download and unzip `code-beautifier-prettier-formatter.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

Firefox: `about:debugging` → This Firefox → Load Temporary Add-on →
select `manifest.json`.

## Permissions

- `storage` — autosaves your draft (input, language, indent choice) locally.

## Usage

1. Paste code, pick a language (JavaScript / JSON / CSS) and indent style.
2. Click **Beautify**. JSON is validated first — invalid JSON shows the
   parser's error message.
3. **Copy** the output with one click.

## Publishing notes

- Manifest V3, no remote code, no network calls, no analytics.
- Single `storage` permission, justified above.
