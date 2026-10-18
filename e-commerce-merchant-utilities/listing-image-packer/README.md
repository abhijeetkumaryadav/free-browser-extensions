# Listing Image Packer v1.0.0

**Collect** on any product or gallery page: gathers every meaningful
image (tiny icons and tracking pixels filtered out), shows a gallery
with dimensions and file size (real size via HEAD when allowed,
clearly-marked estimate otherwise), biggest images first. Download
individually or hit **Download all**.

## Try it
1. Unzip `listing-image-packer.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any product page → click the icon → **Collect**.

**Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json`.

## Publishing notes
- Permissions: `activeTab` + `scripting` (read the page you collect
  from), `downloads` (save images), `storage` (reserved for prefs).
  Nothing uploaded.
- Chrome Web Store: $5 one-time dev fee.

## Files
```
manifest.json, popup.html/css/js, icons/, README.md
```

## Future-proofing
- Manifest V3 only. Page parsing isolated in one injectable async function.
- Download logic centralized in `downloadOne` / `downloadAll`.
