/* ReplySmith — template-based email reply drafter. No AI, no network. */
'use strict';

/* Sentence-block templates keyed by tone × intent. */
const TEMPLATES = {
  professional: {
    accept: {
      greet: 'Hi [Name],\n\nThank you for your email.',
      body: 'I am happy to confirm that this works for me. I will follow through on the next steps and keep you posted on progress.',
      close: 'Best regards,\n[Your Name]'
    },
    decline: {
      greet: 'Hi [Name],\n\nThank you for thinking of me.',
      body: 'After reviewing, I will not be able to take this on at the moment. I appreciate the opportunity and hope we can revisit in the future.',
      close: 'Kind regards,\n[Your Name]'
    },
    followup: {
      greet: 'Hi [Name],\n\nI hope you are well.',
      body: 'I wanted to follow up on my previous message and check whether there have been any updates. Please let me know if anything is needed from my side.',
      close: 'Best regards,\n[Your Name]'
    },
    thank: {
      greet: 'Hi [Name],\n\nThank you very much for your email.',
      body: 'I really appreciate your time and effort on this. It was a pleasure working through it with you.',
      close: 'Warm regards,\n[Your Name]'
    }
  },
  friendly: {
    accept: {
      greet: 'Hi [Name]!\n\nThanks so much for your message!',
      body: 'Yes, I would love to! Sounds great — count me in. I will get started and let you know how it goes.',
      close: 'Cheers,\n[Your Name]'
    },
    decline: {
      greet: 'Hi [Name],\n\nThanks for reaching out!',
      body: 'I will have to pass this time, unfortunately. I really appreciate you thinking of me, though — let us definitely keep in touch.',
      close: 'All the best,\n[Your Name]'
    },
    followup: {
      greet: 'Hi [Name]!\n\nHope you are doing well.',
      body: 'Just bumping this up in case it got buried. Let me know what you think whenever you get a chance!',
      close: 'Cheers,\n[Your Name]'
    },
    thank: {
      greet: 'Hi [Name]!\n\nThank you so much for this.',
      body: 'I really appreciate everything you have done here. It means a lot — thank you!',
      close: 'Many thanks,\n[Your Name]'
    }
  },
  firm: {
    accept: {
      greet: 'Hello [Name],\n\nAcknowledged.',
      body: 'I agree to the terms as stated. Please confirm in writing so we have a clear record moving forward.',
      close: 'Regards,\n[Your Name]'
    },
    decline: {
      greet: 'Hello [Name],\n\nI have reviewed your request.',
      body: 'I will not be proceeding. This is my final position on the matter.',
      close: 'Regards,\n[Your Name]'
    },
    followup: {
      greet: 'Hello [Name],',
      body: 'This is a follow-up to my message dated earlier. I require a response by the stated deadline so we can proceed without further delay.',
      close: 'Regards,\n[Your Name]'
    },
    thank: {
      greet: 'Hello [Name],\n\nThank you for the update.',
      body: 'Your prompt action on this is noted and appreciated.',
      close: 'Regards,\n[Your Name]'
    }
  },
  apologetic: {
    accept: {
      greet: 'Hi [Name],\n\nI am sorry for the delayed reply.',
      body: 'I would be glad to accept. Apologies again for the late response, and thank you for your patience.',
      close: 'Kind regards,\n[Your Name]'
    },
    decline: {
      greet: 'Hi [Name],\n\nI am sorry for the delayed reply.',
      body: 'I am afraid I cannot take this on, and I am sorry for any inconvenience. I truly appreciate you reaching out.',
      close: 'Sincerely,\n[Your Name]'
    },
    followup: {
      greet: 'Hi [Name],\n\nI am sorry to chase.',
      body: 'I wanted to gently follow up on this. I understand things get busy, so whenever you have a moment I would appreciate an update.',
      close: 'Kind regards,\n[Your Name]'
    },
    thank: {
      greet: 'Hi [Name],\n\nThank you — and sorry for my slow reply.',
      body: 'I really appreciate your understanding. Thank you for everything.',
      close: 'Warm regards,\n[Your Name]'
    }
  }
};

const $ = id => document.getElementById(id);
const source = $('source'), tone = $('tone'), intent = $('intent');
const blocks = $('blocks'), bGreet = $('bGreet'), bBody = $('bBody'), bClose = $('bClose');
const copyBtn = $('copy'), saveBtn = $('save'), savedList = $('saved');

/* Extract a likely sender name from a "From:" line in the pasted email. */
function guessName(text) {
  const m = text.match(/^(?:From|Sent by)\s*:\s*([A-Z][a-zA-Z.\-']+(?:\s+[A-Z][a-zA-Z.\-']+)?)/m);
  if (m) return m[1].replace(/['"]$/g, '');
  const hi = text.match(/^(?:Hi|Hello|Dear)\s+([A-Z][a-zA-Z\-']+)/m);
  return hi ? hi[1] : '[Name]';
}

function fill(tpl, name) {
  return tpl.replaceAll('[Name]', name);
}

function draft() {
  const name = guessName(source.value);
  const t = TEMPLATES[tone.value][intent.value];
  bGreet.value = fill(t.greet, name);
  bBody.value = fill(t.body, name);
  bClose.value = fill(t.close, name);
  blocks.hidden = false;
  /* Persist last used tone/intent as the user's preset. */
  chrome.storage.local.set({ lastTone: tone.value, lastIntent: intent.value });
}

function fullText() {
  return [bGreet.value.trim(), '', bBody.value.trim(), '', bClose.value.trim()].join('\n');
}

async function copyReply() {
  await navigator.clipboard.writeText(fullText());
  const old = copyBtn.innerHTML;
  copyBtn.textContent = 'Copied!';
  setTimeout(() => { copyBtn.innerHTML = old; }, 1500);
}

async function saveDraft() {
  const drafts = (await chrome.storage.local.get('drafts')).drafts || [];
  drafts.unshift({ id: Date.now(), tone: tone.value, intent: intent.value, text: fullText() });
  await chrome.storage.local.set({ drafts: drafts.slice(0, 20) });
  renderDrafts();
}

async function renderDrafts() {
  const drafts = (await chrome.storage.local.get('drafts')).drafts || [];
  savedList.innerHTML = '';
  for (const d of drafts) {
    const div = document.createElement('div');
    div.className = 'saved-item';
    const span = document.createElement('span');
    span.textContent = `${d.tone} · ${d.intent} — ${new Date(d.id).toLocaleDateString()}`;
    const load = document.createElement('button'); load.textContent = 'Load';
    load.onclick = () => {
      const [g, , b, , c] = d.text.split('\n');
      bGreet.value = g || ''; bBody.value = b || ''; bClose.value = c || '';
      blocks.hidden = false;
    };
    const del = document.createElement('button'); del.textContent = 'Delete';
    del.onclick = async () => {
      const cur = (await chrome.storage.local.get('drafts')).drafts || [];
      await chrome.storage.local.set({ drafts: cur.filter(x => x.id !== d.id) });
      renderDrafts();
    };
    div.append(span, load, del);
    savedList.appendChild(div);
  }
}

async function init() {
  const s = await chrome.storage.local.get(['lastTone', 'lastIntent']);
  if (s.lastTone) tone.value = s.lastTone;
  if (s.lastIntent) intent.value = s.lastIntent;
  await renderDrafts();
}

$('build').addEventListener('click', draft);
copyBtn.addEventListener('click', copyReply);
saveBtn.addEventListener('click', saveDraft);
init();
