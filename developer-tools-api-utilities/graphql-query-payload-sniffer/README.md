# GraphQL Query Workbench v1.0.0

A **paste-only** GraphQL workbench. It never touches live traffic —
paste a query plus variables JSON and get:

- **Pretty-printed query** (proper indentation, one field per line)
- **Variables validation** — JSON syntax check with key count
- **Complexity estimate** — field count, max nesting depth, and
  possible list fields (clearly labeled heuristic)
- **curl command** — ready to run against your endpoint, one click to copy

Your last query/variables/endpoint are saved on-device for convenience.

## Try it
1. Unzip `graphql-query-payload-sniffer.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Click the icon, paste a query, hit **Analyze**.

## Permissions
- `storage` only — remembers your last workbench inputs. No network
  access, no page reading, no traffic interception of any kind.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee.
- The name deliberately says "Workbench": it does not sniff or
  intercept network traffic.
