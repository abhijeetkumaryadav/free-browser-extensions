/* Policy Draft Helper — question wizard → plain-language template drafts.
   NOT legal advice. Every output reminds the user to get a lawyer's review. */
'use strict';

const $ = (id) => document.getElementById(id);
const DATA_LABELS = {
  'd-name': 'name and email address',
  'd-pay': 'payment details',
  'd-analytics': 'analytics and usage data',
  'd-cookies': 'cookies and similar tracking technologies',
  'd-location': 'location data',
};

let tosDraft = '';
let ppDraft = '';

function dataList() {
  return Object.keys(DATA_LABELS).filter((id) => $(id).checked).map((id) => DATA_LABELS[id]);
}

function buildTos(d) {
  const date = new Date().toISOString().slice(0, 10);
  return `TERMS OF SERVICE — ${d.name.toUpperCase()}
Last updated: ${date}

⚠️ DRAFT ONLY — NOT A LEGAL DOCUMENT. Have a qualified lawyer in your jurisdiction review and adapt this before publishing.

1. ABOUT THIS SERVICE
These Terms of Service ("Terms") govern your use of ${d.name} (${d.type}).

2. USING THE SERVICE
You agree to use ${d.name} only for lawful purposes and in line with these Terms.
You must provide accurate information when you register.

3. ACCOUNTS
You are responsible for keeping your account credentials confidential and for all
activity under your account. Notify us immediately of any unauthorized use.

4. ACCEPTABLE USE
You agree not to: (a) break the law using the service; (b) interfere with its
operation; (c) attempt to access other users' data; (d) upload harmful content.

5. INTELLECTUAL PROPERTY
The service, its content and branding remain our property. You may not copy or
reverse-engineer it except as the law allows.

6. PAYMENTS (if applicable)
Fees are charged as displayed at purchase. All fees are exclusive of taxes unless
stated. Refund requests are handled on a case-by-case basis — contact ${d.email}.

7. DISCLAIMER
The service is provided "as is" without warranties of any kind, to the maximum
extent permitted by law.

8. LIMITATION OF LIABILITY
To the maximum extent permitted by law, our liability is limited to the amounts
you paid us in the 12 months before the claim.

9. CHANGES
We may update these Terms. Material changes will be announced; continued use
means you accept the updated Terms.

10. CONTACT
Questions about these Terms: ${d.email}

Region note: you indicated ${d.region}. Consumer-protection, data and contract
laws differ by jurisdiction — confirm these Terms comply locally with a lawyer.`;
}

function buildPp(d) {
  const date = new Date().toISOString().slice(0, 10);
  const data = dataList();
  const dataText = data.length ? data.join('; ') : 'no personal data knowingly collected';
  const cookieNote = $('d-cookies').checked
    ? 'We use cookies for essential functions and, where consented, analytics. You can control cookies in your browser settings.'
    : 'We do not currently use cookies.';
  return `PRIVACY POLICY — ${d.name.toUpperCase()}
Last updated: ${date}

⚠️ DRAFT ONLY — NOT A LEGAL DOCUMENT. Privacy laws (GDPR, CCPA/CPRA, DPDP Act, etc.) have strict requirements. Have a qualified lawyer review this before publishing.

1. WHAT WE COLLECT
We collect: ${dataText}.

2. HOW WE USE IT
We use your data to: provide and improve ${d.type} (${d.name}); respond to your
requests; keep the service secure; and meet legal obligations.

3. COOKIES
${cookieNote}

4. SHARING
We do not sell your personal data. We may share data with trusted processors
(e.g. hosting, payments, analytics) who are bound by confidentiality, and when
required by law.

5. YOUR RIGHTS
Depending on your location, you may have rights to access, correct, delete or
export your data, and to withdraw consent. Contact ${d.email} to exercise them —
we will respond within the time limits your law requires.

6. DATA RETENTION
We keep personal data only as long as needed for the purposes above, then delete
or anonymize it.

7. SECURITY
We use reasonable technical and organizational measures to protect your data. No
system is 100% secure.

8. CHILDREN
Our service is not directed at children under the age required by local law.

9. CHANGES
We will notify you of material changes to this policy.

10. CONTACT
Privacy questions: ${d.email}

Region note: you indicated ${d.region}. Data-protection rules differ by
jurisdiction (e.g. consent requirements, breach-notification duties). Confirm
compliance with a lawyer.`;
}

async function loadSaved() {
  const s = await chrome.storage.local.get(['svcName', 'svcType', 'contactEmail', 'region']);
  if (s.svcName) $('svcName').value = s.svcName;
  if (s.svcType) $('svcType').value = s.svcType;
  if (s.contactEmail) $('contactEmail').value = s.contactEmail;
  if (s.region) $('region').value = s.region;
}

$('generateBtn').addEventListener('click', async () => {
  const d = {
    name: $('svcName').value.trim() || '[Your Service Name]',
    type: $('svcType').value,
    email: $('contactEmail').value.trim() || '[contact@example.com]',
    region: $('region').value.trim() || '[your region]',
  };
  await chrome.storage.local.set({ svcName: d.name, svcType: d.type, contactEmail: d.email, region: d.region });
  tosDraft = buildTos(d);
  ppDraft = buildPp(d);
  $('step-wizard').hidden = true;
  $('step-result').hidden = false;
  showTab('tos');
});

function showTab(which) {
  $('tabTos').classList.toggle('active', which === 'tos');
  $('tabPp').classList.toggle('active', which === 'pp');
  $('draftOut').value = which === 'tos' ? tosDraft : ppDraft;
  $('draftOut').scrollTop = 0;
}
$('tabTos').addEventListener('click', () => showTab('tos'));
$('tabPp').addEventListener('click', () => showTab('pp'));

$('backBtn').addEventListener('click', () => {
  $('step-result').hidden = true;
  $('step-wizard').hidden = false;
});

$('copyBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('draftOut').value);
    $('copyBtn').textContent = 'Copied!';
    setTimeout(() => { $('copyBtn').textContent = 'Copy draft'; }, 1500);
  } catch {
    $('draftOut').select();
    $('copyBtn').textContent = 'Select & copy (Ctrl+C)';
    setTimeout(() => { $('copyBtn').textContent = 'Copy draft'; }, 2000);
  }
});

loadSaved();
