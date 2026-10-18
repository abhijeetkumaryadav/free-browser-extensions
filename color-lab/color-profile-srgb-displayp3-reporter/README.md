# GamutCheck — Color Profile Reporter v1.0.0

An informational tool that reports what your browser actually exposes about display color — `screen.colorDepth` / `screen.pixelDepth`, CSS `color-gamut` media support, and `color(display-p3 …)` syntax support — plus five side-by-side **sRGB vs Display-P3 test swatches** so you can visually compare gamuts on your own display.

## Install (Chrome / Edge / Opera / Firefox)
1. Download and unzip `color-profile-srgb-displayp3-reporter.zip`.
2. Open `chrome://extensions` (or `about:debugging#/runtime/this-firefox`), enable **Developer mode**.
3. Click **Load unpacked** / **Load Temporary Add-on** and select the unzipped folder.

## Permissions
None beyond the popup itself. No network access. Nothing leaves your device.

## Honest scope
- Web extensions **cannot read the OS ICC color profile** — only `colorDepth`/`pixelDepth` are exposed.
- Gamut detection uses CSS feature queries (`color-gamut` media, `CSS.supports`), which report *capability*, not calibration.
- The swatches are a **visual comparison**, not a calibration or measurement tool. If your display/browser lacks wide-gamut support, both swatches look identical — that is the correct result.

## Publishing notes
- MV3, no permissions, no remote code, no analytics. Ready for Chrome Web Store review after real-browser testing.
