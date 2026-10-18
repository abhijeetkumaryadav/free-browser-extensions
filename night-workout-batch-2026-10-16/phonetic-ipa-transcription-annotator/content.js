'use strict';
// ============ ENGINE-START ============
// Pair engine: longest-word-first whole-word matching, regex-safe.
function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
// Build a single alternation regex, longest first, case-insensitive.
function buildPattern(pairs){
  if(!pairs.length) return null;
  const sorted = [...pairs].sort((a,b)=>b.word.length-a.word.length);
  return new RegExp('\\b('+sorted.map(p=>escapeRe(p.word)).join('|')+')\\b','gi');
}
function lookup(map, token){
  const hit = map.get(token.toLowerCase());
  return hit === undefined ? null : hit;
}
// ============ ENGINE-END ============

// Wrap matches in ruby tags inside TEXT NODES only; returns count.
function annotateNode(root, pattern, map){
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      if(!n.nodeValue || !pattern.test(n.nodeValue)) return NodeFilter.FILTER_SKIP;
      pattern.lastIndex = 0;
      const t = n.parentNode;
      if(!t || t.closest('script,style,ruby,textarea,input,select,[contenteditable]')) return NodeFilter.FILTER_SKIP;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  let n;
  while((n = walker.nextNode())) nodes.push(n);
  let count = 0;
  for(const node of nodes){
    pattern.lastIndex = 0;
    const text = node.nodeValue;
    let m, last = 0;
    const frag = document.createDocumentFragment();
    while((m = pattern.exec(text))){
      count++;
      if(m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const word = m[0];
      const ipa = lookup(map, word);
      const ruby = document.createElement('ruby');
      ruby.className = '__ipa_ruby';
      ruby.dataset.ipaOrig = word;
      ruby.appendChild(document.createTextNode(word));
      const rt = document.createElement('rt');
      rt.textContent = ipa === null ? '' : ipa;
      ruby.appendChild(rt);
      frag.appendChild(ruby);
      last = m.index + word.length;
    }
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  }
  return count;
}
function removeAll(){
  let removed = 0;
  document.querySelectorAll('ruby.__ipa_ruby').forEach(r=>{
    r.replaceWith(document.createTextNode(r.dataset.ipaOrig || r.textContent));
    removed++;
  });
  return removed;
}
// message bridge
if(typeof chrome !== 'undefined' && chrome.runtime){
  chrome.runtime.onMessage.addListener((msg, _s, respond)=>{
    if(msg.type === 'IPA_ANNOTATE'){
      const map = new Map(msg.pairs.map(p=>[p.word.toLowerCase(), p.ipa]));
      const pattern = buildPattern(msg.pairs);
      respond({count: pattern ? annotateNode(document.body, pattern, map) : 0});
    }else if(msg.type === 'IPA_REMOVE'){
      respond({removed: removeAll()});
    }
    return true;
  });
}
