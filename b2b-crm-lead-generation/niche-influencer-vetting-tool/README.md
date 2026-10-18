# Niche Influencer Vetting Tool v1.0.0

Enter an influencer's stats manually (followers, avg likes, avg
comments, sponsored-post rate) and get an instant audit: engagement
rate, cost per engagement, and a scored red-flag checklist —
engagement-vs-audience mismatch, like-to-comment ratio anomalies,
and cost sanity — with an overall **PARTNER / CAUTION / PASS**
verdict. Vetted creators are kept in local history.

No social-media APIs or scraping; everything is manual entry and
on-device.

## Try it
1. Unzip `niche-influencer-vetting-tool.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Enter stats, hit **Run vetting**.
4. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on.

## Publishing notes
- Permissions: `storage` only (vetted-creator history). No network calls.
- Chrome Web Store: $5 one-time dev fee; Edge and Firefox free.
