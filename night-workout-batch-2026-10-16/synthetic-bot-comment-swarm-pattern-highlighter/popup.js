'use strict';
/* ============================================================
   Bot Swarm Signals — heuristic bot-pattern scanner
   Heuristic signals only: patterns can misfire. NOT bot detection.
   Pure engine between ENGINE-START / ENGINE-END (headless-testable).
   ============================================================ */

// ENGINE-START
const BOT_SIGNALS = [
  { id:'repetition', name:'Repetitive phrasing',
    desc:'Repeated sentence or phrase inside one comment.',
    check(t){ const s=t.toLowerCase().match(/[^.!?]+[.!?]+/g)||[];
      const seen=new Set(); for(const x of s){ const k=x.trim();
        if(k.length>10 && seen.has(k)) return {hit:true, weight:30, note:'A sentence repeats: "'+k.slice(0,40)+'…"'}; seen.add(k);} return {hit:false}; } },
  { id:'generic', name:'Generic praise',
    desc:'Vague flattery with no specifics.',
    check(t){ const pats=[/great (post|content|share|video)/i,/amazing (post|content|video|work)/i,/nice (post|video|content|work)/i,/love (this|it)/i,/thanks for sharing/i,/so (inspiring|beautiful|true)/i];
      const m=pats.filter(p=>p.test(t)); return m.length?{hit:true,weight:15*m.length,note:m.length+' generic-praise phrase(s)'}:{hit:false}; } },
  { id:'emoji', name:'Emoji overload',
    desc:'Heavy emoji padding.',
    check(t){ const n=(t.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu)||[]).length;
      return n>=4?{hit:true,weight:Math.min(20,5*n),note:n+' emoji in one comment'}:{hit:false}; } },
  { id:'links', name:'Link-heavy',
    desc:'Links crammed into short text.',
    check(t){ const n=(t.match(/https?:\/\/|www\./gi)||[]).length;
      return n>=2?{hit:true,weight:10*n,note:n+' links found'}:{hit:false}; } },
  { id:'short', name:'Short & content-free',
    desc:'Under 12 words, no substantive claim.',
    check(t){ const w=t.trim().split(/\s+/).filter(Boolean);
      return w.length>0 && w.length<12?{hit:true,weight:12,note:w.length+' words total'}:{hit:false}; } },
  { id:'caps', name:'ALL-CAPS shouting',
    desc:'Entire comment in capitals.',
    check(t){ const letters=t.replace(/[^A-Za-z]/g,'');
      if(letters.length>10 && letters===letters.toUpperCase()) return {hit:true,weight:10,note:'fully capitalized'}; return {hit:false}; } },
  { id:'cta', name:'Spam CTA',
    desc:'Call-to-action spam ("DM me", "click link", crypto giveaway).',
    check(t){ const pats=[/dm me/i,/check (out )?my (bio|profile)/i,/click (the )?link/i,/(crypto|giveaway|airdrop)/i,/make money/i,/double your/i];
      const m=pats.filter(p=>p.test(t)); return m.length?{hit:true,weight:18*m.length,note:m.length+' spam-CTA phrase(s)'}:{hit:false}; } },
  { id:'hashtag', name:'Hashtag stuffing',
    desc:'Many hashtags, classic amplification.',
    check(t){ const n=(t.match(/#\w+/g)||[]).length;
      return n>=4?{hit:true,weight:Math.min(16,4*n),note:n+' hashtags'}:{hit:false}; } },
];

function scanBotSignals(text){
  if(typeof text!=='string' || !text.trim()) return {score:0, verdict:'Empty', signals:[]};
  let score=0; const signals=[];
  for(const s of BOT_SIGNALS){
    let r; try{ r=s.check(text); }catch(e){ continue; }
    if(r && r.hit){ score+=r.weight; signals.push({name:s.name, desc:s.desc, note:r.note}); }
  }
  score=Math.min(100, Math.round(score));
  return {score, verdict:verdictForBot(score), signals};
}
function verdictForBot(score){
  if(score<=15) return 'Clean';
  if(score<=40) return 'Mild signals';
  if(score<=70) return 'Strong signals';
  return 'Very bot-like';
}
// ENGINE-END

/* ---------- popup wiring ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const input=document.getElementById('input');
  const notes=document.getElementById('notes');
  const card=document.getElementById('resultCard');
  chrome.storage.local.get(['botLastText','botNotes'], r => {
    if(r.botLastText) input.value=r.botLastText;
    if(r.botNotes) notes.value=r.botNotes;
  });
  notes.addEventListener('input', () => chrome.storage.local.set({botNotes:notes.value}));
  document.getElementById('scan').addEventListener('click', () => {
    const t=input.value;
    chrome.storage.local.set({botLastText:t});
    const {score, verdict, signals}=scanBotSignals(t);
    card.classList.remove('hidden');
    document.getElementById('score').textContent=score;
    document.getElementById('verdict').textContent=verdict;
    document.getElementById('verdictSub').textContent=signals.length+' signal'+(signals.length===1?'':'s')+' found';
    const ul=document.getElementById('signals');
    ul.innerHTML=signals.length?signals.map(s=>'<li><b>'+escapeHtml(s.name)+'</b> — '+escapeHtml(s.note)+'<br><span style="color:var(--muted)">'+escapeHtml(s.desc)+'</span></li>').join(''):'<li>No strong bot signals in this text.</li>';
  });
});
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
