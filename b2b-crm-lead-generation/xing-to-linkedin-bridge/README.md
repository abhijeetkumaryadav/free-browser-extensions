# XING to LinkedIn Bridge v1.0.0

On a public XING profile you're viewing, click **Read this XING profile**
to build a LinkedIn-ready summary card: name, headline, current company,
and location (parsed from Open Graph tags, JSON-LD Person data, and page
structure — best-effort). One click opens LinkedIn people search
pre-filled with the name + company, and you can copy the summary as text.

Best-effort by design: it reads only the public fields already visible to
you on the current tab. LinkedIn sign-in is still required on linkedin.com.

## Try it
1. Unzip `xing-to-linkedin-bridge.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Open any public XING profile, click the toolbar icon, then **Read**.

## Publishing notes
- Permissions: `activeTab` + `scripting` — read the visible page only when
  you click Read. No storage, no network calls, nothing uploaded.
- Chrome Web Store: $5 one-time developer registration.
- Edge Add-ons: free. Firefox: free, requires signing.
