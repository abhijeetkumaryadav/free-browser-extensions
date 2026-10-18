# Prompt Injection Scanner

Scans text for classic prompt-injection phrasings using a bundled,
hand-written pattern list — with severity labels, matched snippets, and
plain-language explanations.

## Honest scope

- **Pattern matching — not guaranteed detection.** It matches 14 known
  injection phrasings (instruction overrides, role-play jailbreaks, system
  prompt extraction, obfuscation tricks, fake system delimiters). Novel attack
  phrasing will not match; benign text can match. A clean result does **not**
  prove text is safe.
- Not AI. No models, no network, no uploads.

## Usage

1. Paste text into the box and click **Scan text**, or click **Scan active
   field** to read the focused text field / selection on the current tab
   (read-only; the page is never modified).
2. Read the verdict and review each hit: severity, matched phrase, context
   snippet, and why the pattern is suspicious.
3. The collapsible-free rule list at the bottom documents every bundled rule.

## Permissions

- `storage` — reserved for future preferences.
- `activeTab` + `scripting` — click-only, read-only grab of the focused field.

## Privacy

Scanned text never leaves the popup. No analytics, no remote code.
