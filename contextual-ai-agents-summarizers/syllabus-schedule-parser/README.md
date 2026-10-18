# Syllabus Schedule Parser v1.0.0

Paste syllabus text and get a schedule: the extension detects dates
(“Jan 20”, “02/12”, “2026-03-05”, “Friday”, …), pulls the assignment
or event description from each line, and auto-tags the type —
**exam**, **assignment**, **reading**, or **event**. Export everything
as an **ICS calendar file** (imports into Google/Apple/Outlook) or
**CSV**. Best-effort parsing, clearly labeled — verify against the
original syllabus.

## Try it
1. Unzip `syllabus-schedule-parser.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon, paste syllabus text → **Parse schedule** → ⬇ ICS.

## Publishing notes
- Permissions: **none**. Runs entirely on-device; nothing is uploaded.
- Chrome Web Store: $5 one-time dev fee. Edge Add-ons and Firefox
  Add-ons are free; Firefox requires signing.
