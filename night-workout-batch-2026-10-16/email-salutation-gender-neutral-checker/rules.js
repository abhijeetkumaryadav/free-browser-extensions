/* rules.js — bundled gendered-salutation list.
   Each rule: { pattern: RegExp (case-insensitive), note, alternatives[] }.
   Heuristic matching only — no language understanding. */

const SALUTATION_RULES = [
  {
    label: "Dear Sir",
    pattern: /\bdear\s+sir\b/i,
    note: "Assumes the recipient is male.",
    alternatives: ["Dear [Name]", "Dear Hiring Manager", "Dear Team", "Hello"]
  },
  {
    label: "Dear Madam",
    pattern: /\bdear\s+madam\b/i,
    note: "Assumes the recipient is female.",
    alternatives: ["Dear [Name]", "Dear Hiring Manager", "Dear Team", "Hello"]
  },
  {
    label: "Dear Sir/Madam",
    pattern: /\bdear\s+si?rs?\s*\/\s*ma'?dams?\b|\bdear\s+madam\s*\/\s*sir\b/i,
    note: "Binary framing; impersonal.",
    alternatives: ["Dear [Name]", "Dear Hiring Team", "To whom it may concern", "Hello"]
  },
  {
    label: "Dear Sirs",
    pattern: /\bdear\s+sirs\b/i,
    note: "Assumes a male group.",
    alternatives: ["Dear All", "Dear Team", "Dear Colleagues", "Hello everyone"]
  },
  {
    label: "Dear Gentlemen",
    pattern: /\bdear\s+gentlemen\b/i,
    note: "Assumes a male group.",
    alternatives: ["Dear All", "Dear Team", "Dear Colleagues", "Hello everyone"]
  },
  {
    label: "Dear Ladies",
    pattern: /\bdear\s+ladies\b/i,
    note: "Assumes a female group.",
    alternatives: ["Dear All", "Dear Team", "Dear Colleagues", "Hello everyone"]
  },
  {
    label: "Hey guys",
    pattern: /\bhey\s+guys\b/i,
    note: "\"Guys\" reads as male-default for mixed groups.",
    alternatives: ["Hey everyone", "Hey team", "Hey all", "Hi folks"]
  },
  {
    label: "Hi guys",
    pattern: /\bhi\s+guys\b/i,
    note: "\"Guys\" reads as male-default for mixed groups.",
    alternatives: ["Hi everyone", "Hi team", "Hi all", "Hi folks"]
  },
  {
    label: "Dear guys",
    pattern: /\bdear\s+guys\b/i,
    note: "\"Guys\" reads as male-default for mixed groups.",
    alternatives: ["Dear all", "Dear team", "Hello everyone"]
  },
  {
    label: "Gentlemen,",
    pattern: /(^|[\n.!?]\s*)gentlemen\b/i,
    note: "Addresses the group as men.",
    alternatives: ["Everyone,", "Team,", "Colleagues,", "All,"]
  },
  {
    label: "Ladies and gentlemen",
    pattern: /\bladies\s+and\s+gentlemen\b/i,
    note: "Binary framing.",
    alternatives: ["Everyone", "Colleagues", "Guests", "Team"]
  },
  {
    label: "Dear Mr./Mrs./Ms.",
    pattern: /\bdear\s+(mr|mrs|ms|miss)\.?\s+\w/i,
    note: "Title-based salutations assume gender; fine if you know the person prefers it.",
    alternatives: ["Dear [Full Name]", "Dear [First Name] [Last Name]", "Hello [Name]"]
  },
  {
    label: "Hey man / dude / bro",
    pattern: /\b(hey|hi|yo)\s+(man|dude|bro|buddy|mate)\b/i,
    note: "Masculine-coded informal address.",
    alternatives: ["Hey", "Hi there", "Hey friend", "Hello"]
  },
  {
    label: "Dear Chairman",
    pattern: /\bdear\s+chairman\b/i,
    note: "Gendered role title.",
    alternatives: ["Dear Chair", "Dear Chairperson", "Dear [Name]"]
  },
  {
    label: "Dear Spokesman",
    pattern: /\bdear\s+spokesman\b/i,
    note: "Gendered role title.",
    alternatives: ["Dear Spokesperson", "Dear [Name]"]
  }
];
