# Coupon Regional Applier v1.0.0

**Try on this page:** type a code and hit Apply — the extension finds
the coupon field on the checkout page (handles React-controlled
inputs), fills it, and clicks the apply button.

**Coupon vault:** save codes tagged by store and region (IN / US / EU /
GLOBAL), filter by region chips, one-click copy, one-click apply, delete.

## Try it
1. Unzip `coupon-regional-applier.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any store checkout → click the icon → Apply a code.

## Publishing notes
- Permissions: `activeTab` + `scripting` (fill the coupon field on the
  page you’re checking out on), `storage` (vault on-device). Nothing uploaded.
- Chrome Web Store: $5 one-time dev fee.

## Files
```
manifest.json, popup.html/css/js, icons/, README.md
```

## Future-proofing
- Manifest V3 only. Page interaction isolated in one injectable function.
- Selector lists and constants grouped at the top of functions.
