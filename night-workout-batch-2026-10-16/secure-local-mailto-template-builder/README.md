# Mailto Template Builder

Create reusable email templates with `{{placeholders}}`, fill them in, and open
the result in your mail client with one click.

## Honest scope

- **Builds `mailto:` links only.** The extension never sends email itself —
  clicking "Open in mail client" just hands a `mailto:` URL to your OS, which
  opens your configured mail app with everything pre-filled.
- **100% local.** Templates live in `chrome.storage.local`. No network calls,
  no accounts, no tracking.
- Placeholder values are inserted as plain text; subject/body are
  percent-encoded. To/Cc/Bcc are used exactly as you type them.

## How it works

1. **New** → name the template, set To/Cc/Bcc, write subject & body using
   `{{placeholders}}` like `{{name}}` or `{{topic}}`.
2. Click a template → fill each placeholder → review the preview.
3. **Open in mail client** → your mail app opens with the draft ready.

Edit or delete templates any time from the use view.

## Permissions

- `storage` — saves your templates locally. Nothing else is requested.

## Files

`manifest.json` · `popup.html` · `popup.css` · `popup.js` · `icons/`
