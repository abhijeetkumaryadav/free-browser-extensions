/* Bundled prompt-injection pattern rules.
 * Each rule: { id, severity: "high"|"medium"|"low", pattern (regex source), note }.
 * Patterns are case-insensitive by design. This is a heuristic list — new
 * attack phrasings will not match, and benign text can match. */
// RULES-START
const INJECTION_RULES = [
  { id: "ignore-prev", severity: "high",
    pattern: "ignore\\s+(all\\s+)?(previous|prior|above|earlier)\\s+instructions?",
    note: "Classic instruction-override attempt: asks the model to drop its system/developer instructions." },
  { id: "disregard-rules", severity: "high",
    pattern: "disregard\\s+(all\\s+)?(your|the)\\s+(rules|guidelines|instructions|policies)",
    note: "Direct attempt to make the model abandon its operating rules." },
  { id: "forget-instructions", severity: "high",
    pattern: "forget\\s+(everything|all|your)\\s+(you\\s+)?(know|were\\s+told|instructed)",
    note: "Tries to wipe the model's context so attacker text becomes the only authority." },
  { id: "new-instructions", severity: "high",
    pattern: "new\\s+instructions?\\s*[:\\-]|follow\\s+these\\s+new\\s+instructions",
    note: "Attempts to install attacker-supplied instructions mid-conversation." },
  { id: "system-prompt-leak", severity: "high",
    pattern: "(reveal|show|print|output|repeat|disclose)\\s+(your\\s+)?(system\\s+prompt|initial\\s+prompt|hidden\\s+instructions)",
    note: "Prompt-extraction attempt: tries to leak the hidden system prompt." },
  { id: "role-play-override", severity: "medium",
    pattern: "you\\s+are\\s+now\\s+(dan|a\\s+helpful|an\\s+unrestricted|evil|jailbroken)",
    note: "Role-play override: redefines the assistant as an unrestricted persona." },
  { id: "developer-mode", severity: "medium",
    pattern: "developer\\s+mode|do\\s+anything\\s+now|jailbreak",
    note: "Known jailbreak framing: claims a special mode that lifts restrictions." },
  { id: "no-refusal", severity: "medium",
    pattern: "do\\s+not\\s+refuse|cannot\\s+refuse|must\\s+answer|you\\s+must\\s+comply",
    note: "Tries to disable refusal behavior so the model answers anything." },
  { id: "base64-hidden", severity: "medium",
    pattern: "decode\\s+(this\\s+)?base64|from\\s+base64",
    note: "Asks the model to decode obfuscated content — a common smuggling trick." },
  { id: "translate-attack", severity: "low",
    pattern: "translate\\s+to\\s+\\w+\\s+and\\s+then\\s+(ignore|follow|do)",
    note: "Translation used as a carrier to sneak instructions past filters." },
  { id: "hypothetical-framing", severity: "low",
    pattern: "hypothetically|in\\s+a\\s+fictional\\s+scenario|imagine\\s+you\\s+have\\s+no\\s+restrictions",
    note: "Hypothetical/fictional framing used to launder a disallowed request." },
  { id: "urgent-override", severity: "low",
    pattern: "urgent(ly)?\\s+(override|bypass)|emergency\\s+override|as\\s+an\\s+emergency",
    note: "False urgency used to pressure the model into skipping safeguards." },
  { id: "multi-persona", severity: "low",
    pattern: "respond\\s+as\\s+two|split\\s+personality|good\\s+cop",
    note: "Multi-persona trick: one 'free' persona is asked to answer unrestricted." },
  { id: "prompt-delimiter", severity: "low",
    pattern: "```\\s*system|\\[SYSTEM\\]|<\\|system\\|>",
    note: "Fake system-role delimiters trying to inject privileged content." },
];
// RULES-END

/* Scan text against the bundled rules. Returns array of hit objects:
 * { rule, match (snippet), index }. Case-insensitive. */
// ENGINE-START
function scanForInjection(text) {
  const hits = [];
  if (!text) return hits;
  for (const rule of INJECTION_RULES) {
    let re;
    try {
      re = new RegExp(rule.pattern, "gi");
    } catch {
      continue;
    }
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = Math.max(0, m.index - 40);
      const end = Math.min(text.length, m.index + m[0].length + 40);
      hits.push({
        rule,
        snippet: (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ") + (end < text.length ? "…" : ""),
        matched: m[0],
      });
      if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-length loop
    }
  }
  // Sort: high severity first, then by position.
  const rank = { high: 0, medium: 1, low: 2 };
  hits.sort((a, b) => (rank[a.rule.severity] - rank[b.rule.severity]));
  return hits;
}
// ENGINE-END

if (typeof module !== "undefined") module.exports = { INJECTION_RULES, scanForInjection };
