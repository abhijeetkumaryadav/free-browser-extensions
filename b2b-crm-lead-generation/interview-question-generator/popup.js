// Interview Question Generator — on-device template engine. No AI, no network.

// Curated lexicon of skills the engine can spot in a job description.
const SKILL_LEXICON = [
  "javascript","typescript","python","java","go","rust","c++","c#","php","ruby","swift","kotlin",
  "react","angular","vue","next.js","node.js","express","django","flask","spring","laravel",
  "sql","postgresql","mysql","mongodb","redis","elasticsearch","graphql","rest api",
  "aws","azure","gcp","docker","kubernetes","terraform","ci/cd","jenkins","git",
  "machine learning","deep learning","nlp","data science","pandas","tensorflow","pytorch",
  "figma","ui design","ux research","prototyping","design systems",
  "seo","content marketing","email marketing","google ads","analytics","a/b testing",
  "sales","negotiation","crm","account management","lead generation",
  "project management","agile","scrum","kanban","jira",
  "leadership","mentoring","communication","stakeholder management","cross-functional",
  "system design","microservices","distributed systems","testing","debugging","code review",
  "excel","financial modeling","accounting","auditing",
  "customer support","onboarding","documentation","technical writing",
];
const SENIORITY_HINTS = ["senior","lead","principal","staff","junior","intern","manager","director","head of","architect"];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("gen").addEventListener("click", generate);
  $("copyAll").addEventListener("click", copyAll);
  // restore last bank if the user generated one before
  const { lastBank } = await chrome.storage.local.get("lastBank");
  if (lastBank && lastBank.text) {
    $("jd").value = lastBank.text;
    renderBank(lastBank);
  }
}

function extract(jd) {
  const low = jd.toLowerCase();
  const skills = SKILL_LEXICON.filter((s) => {
    const re = new RegExp("\\b" + s.replace(/[.+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
    return re.test(low);
  }).slice(0, 8);
  const expMatch = low.match(/(\d+)\s*\+?\s*(years?|yrs)/);
  const experience = expMatch ? `${expMatch[1]}+ years` : null;
  const seniority = SENIORITY_HINTS.find((h) => low.includes(h)) || null;
  const firstLine = jd.split(/\n/).map((l) => l.trim()).find((l) => l.length > 3) || "";
  const role = firstLine.length > 70 ? firstLine.slice(0, 70) + "…" : (firstLine || "this role");
  return { skills, experience, seniority, role };
}

function skillOr(skills, fallbackIdx) {
  const fallbacks = ["the core technologies in this role", "your primary stack", "the key tools listed"];
  return skills.length ? skills[fallbacks.length % skills.length] : fallbacks[fallbackIdx % fallbacks.length];
}

function buildBank({ skills, experience, seniority, role }) {
  const s0 = skills[0] || "the core technologies in this role";
  const s1 = skills[1] || s0;
  const lvl = seniority ? ` (${seniority} level)` : "";
  const behavioral = [
    "Tell me about a time you owned a project end-to-end. What was the outcome, and what would you do differently?",
    `Describe the hardest problem you've solved involving ${s0}. Walk me through your debugging process.`,
    `Tell me about a time you had to learn ${s1} (or a new technology) quickly to hit a deadline.`,
    "Give an example of a disagreement with a teammate or stakeholder. How did you resolve it?",
    "Tell me about a time you received difficult feedback. What did you change?",
  ];
  const technical = [
    `How would you architect a feature using ${s0} from scratch? Talk through the key decisions.`,
    `What are the trade-offs of ${s0} versus alternatives you've worked with?`,
    `How do you test, monitor, and validate work involving ${s1}?`,
    `Explain ${s0} to a non-technical stakeholder in two minutes.`,
    "What's a performance or scalability risk you've actually hit, and how did you fix it?",
  ];
  const situational = [
    `It's your first week as ${role}${lvl}. What do you focus on in the first 30 days?`,
    "A critical deadline is at risk because of a dependency outside your control. What do you do?",
    `You disagree with your manager's technical call on ${s0}. How do you handle it?`,
    "You're asked to estimate work with incomplete requirements. How do you respond?",
  ];
  const culture = [
    "What kind of team environment brings out your best work?",
    "How do you prefer to give and receive feedback?",
    "What are you looking for in your next role that this one might offer?",
    `How do you stay current with developments in ${s0}?`,
  ];
  if (experience) {
    behavioral.push(`With ${experience} of experience, what's a mistake you made early on that still shapes how you work?`);
  }
  if (seniority && /lead|manager|director|principal|staff|head/.test(seniority)) {
    behavioral.push("Tell me about someone you've mentored. How did you help them grow?");
    situational.push("Two of your reports disagree on an approach and both escalate to you. How do you decide?");
  }
  return [
    { title: "Behavioral", questions: behavioral },
    { title: "Technical", questions: technical },
    { title: "Situational", questions: situational },
    { title: "Culture fit", questions: culture },
  ];
}

async function generate() {
  const text = $("jd").value.trim();
  if (text.length < 40) {
    $("bank").innerHTML = `<div class="empty-bank">Paste a job description (a few sentences at least) to generate questions.</div>`;
    return;
  }
  const facts = extract(text);
  const bank = buildBank(facts);
  const payload = { text, facts, bank, at: Date.now() };
  await chrome.storage.local.set({ lastBank: payload });
  renderBank(payload);
}

function renderBank({ facts, bank }) {
  // meta
  $("meta").hidden = false;
  $("mRole").textContent = facts.role;
  $("mExp").textContent = facts.experience || "—";
  const chips = $("mSkills");
  chips.innerHTML = "";
  (facts.skills.length ? facts.skills : ["generalist"]).forEach((s) => {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = s;
    chips.appendChild(c);
  });
  // sections
  const box = $("bank");
  box.innerHTML = "";
  bank.forEach((sec) => {
    const card = document.createElement("section");
    card.className = "glass card";
    const h = document.createElement("h2");
    h.textContent = `${sec.title} (${sec.questions.length})`;
    card.appendChild(h);
    sec.questions.forEach((q, i) => {
      const row = document.createElement("div");
      row.className = "q";
      const n = document.createElement("div");
      n.className = "n";
      n.textContent = i + 1;
      const p = document.createElement("p");
      p.textContent = q;
      const btn = document.createElement("button");
      btn.textContent = "Copy";
      btn.addEventListener("click", async () => {
        await copyText(q);
        btn.textContent = "Copied ✓";
        setTimeout(() => (btn.textContent = "Copy"), 1200);
      });
      row.append(n, p, btn);
      card.appendChild(row);
    });
    box.appendChild(card);
  });
  $("footRow").hidden = false;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // fallback for older contexts
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

async function copyAll() {
  const { lastBank } = await chrome.storage.local.get("lastBank");
  if (!lastBank) return;
  let md = `# Interview questions — ${lastBank.facts.role}\n\n`;
  for (const sec of lastBank.bank) {
    md += `## ${sec.title}\n`;
    sec.questions.forEach((q, i) => (md += `${i + 1}. ${q}\n`));
    md += "\n";
  }
  await copyText(md);
  const btn = $("copyAll");
  btn.textContent = "Copied ✓";
  setTimeout(() => (btn.textContent = "Copy all as Markdown"), 1500);
}
