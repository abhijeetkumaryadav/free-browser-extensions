# Twitch Phrasebook Panel

Your own Twitch chat phrasebook in a toggleable side panel on twitch.tv pages.

## What it is

A manual reference: you define chat phrases with your own translations/meanings in the
popup, then open a side panel over Twitch streams for quick lookup while watching chat.

## What it is NOT (labeled honestly in the popup and panel)

- **Not live translation** — it does not read, translate, or modify Twitch chat.
- There is no machine-translation API available to extensions in this environment,
  so nothing here is automatic. Everything in the panel is text **you** typed.

## Usage

1. Open the popup, add phrases with your translations (e.g. "Poggers" → "expression of excitement").
2. Go to a Twitch stream page.
3. Click **Open panel on this tab** in the popup, or the floating **Phrasebook** button on the page.
4. Close the panel with × or the same button.

## Privacy

- 100% local. No network calls. The panel is an overlay — chat and the page are never modified.

## Development

- Manifest V3; `storage` + `activeTab` + `scripting` permissions only.
- `content.js` is an IIFE with no external dependencies.
