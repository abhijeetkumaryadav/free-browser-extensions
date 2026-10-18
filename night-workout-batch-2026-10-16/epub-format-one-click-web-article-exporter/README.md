# Article to EPUB — One-Click Web Article Exporter

**Heuristic extraction — best effort.** Article text is pulled from the active
tab with simple DOM heuristics (`<article>`, `<main>`, or the largest text
block). Complex or paywalled layouts may export partially. Images are not
included — text only.

## What it does

- Click **Export this page as EPUB**: reads the active tab, splits the article
  text into paragraphs, and assembles a valid minimal EPUB file
  (mimetype, `META-INF/container.xml`, OPF, NCX, one XHTML chapter) entirely
  in your browser with a local, dependency-free ZIP writer.
- The `.epub` downloads immediately. No network calls, no accounts, no tracking.

## Permissions

- `activeTab` + `scripting`: read the tab you click on (text only, images skipped).
- `storage`: reserved for future settings. No personal data is stored today.

## Privacy

Fully local. Zero network calls. No analytics, no telemetry.
