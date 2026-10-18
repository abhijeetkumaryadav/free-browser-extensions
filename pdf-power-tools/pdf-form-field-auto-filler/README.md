# FormPilot — Profile Form Filler

Fill web forms from your saved profiles. Scan the page, preview every detected
field with its guessed mapping, and fill only the fields you approve.
Passwords, hidden inputs, and file inputs are never touched.

> **Honest scope:** this fills **web forms** (HTML inputs). Browser extensions
> cannot script the built-in PDF viewer, so despite the queue name this tool
> does not fill PDF files. The README and popup both state this plainly.

## Install

**Chrome / Edge (Chromium)**
1. Unzip `pdf-form-field-auto-filler.zip`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox / Opera:** the extension uses only `storage`, `activeTab`, and
`scripting` — it should work in Firefox (MV3) and Opera with the same steps.

## How to use

1. Click the FormPilot toolbar icon. Create or edit a profile
   (**+** to add, pencil to edit): name, email, phone, address, etc.
2. Open the form page and click **Scan this page**.
3. Review the preview list: each detected field shows its label, input type,
   and the guessed profile-field mapping (change it via the dropdown, or set
   to "— skip —"). Uncheck anything you don't want filled.
4. Click **Fill selected**. FormPilot sets each value the way a real keystroke
   would (native setters + `input`/`change` events, so React/Vue forms react).
5. Review the page before submitting — autofill is a draft, not a signature.

Matching is heuristic: it reads `autocomplete` attributes first, then field
names/ids/placeholders/labels ("email", "first_name", "postal-code", …).
Wrong guesses are fixed with one dropdown change.

## Permissions — why each is needed

| Permission | Why |
|---|---|
| `storage` | Save your profiles on-device. |
| `activeTab` | Scan/fill only the tab you clicked on. |
| `scripting` | Inject the scanner/filler into that tab on demand. |

No host permissions, no background page, no network calls. Your profile data
never leaves the device. Export/import is a local JSON file you control.

## Honest scope & limits

- Web forms only — **cannot fill PDFs** in the browser's built-in viewer.
- Cannot run on `chrome://`, Web Store, or other restricted pages.
- Heuristic matching can mislabel unusual fields — the preview exists so you
  catch it before filling.
- Some sites with aggressive bot protection may reject programmatic input.

## Publishing notes

- Chrome Web Store: single-purpose form utility, minimal justified
  permissions. Declare that profile data is stored locally and never
  transmitted.
- No remote code, no analytics — review-friendly.

## Files

- `manifest.json` — MV3 manifest
- `popup.html` / `popup.css` / `popup.js` — popup UI, profiles, scan/fill flow
- `filler.js` — injected scanner + filler (runs in the page on demand only)
- `icons/` — generated PNG icons (16/48/128)
