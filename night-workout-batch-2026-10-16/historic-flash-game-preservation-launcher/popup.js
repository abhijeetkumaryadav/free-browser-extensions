/* Flash Game Shelf — your flash-game list. Links only; no emulation; zero network. */
// ENGINE-START
function cleanUrl(u){if(!u)return "";u=u.trim();if(/^https?:\/\//i.test(u))return u;if(/^[a-z0-9.-]+\.[a-z]{2,}/i.test(u))return "https://"+u;return "";}
function makeGame(name,url,note){
  name=(name||"").trim();if(!name||name.length>80)return null;
  const u=cleanUrl(url||"");if(!u)return null;
  note=(note||"").trim().slice(0,1000);
  return {id:Date.now()+""+Math.floor(Math.random()*1e4),name,url:u,note,createdAt:Date.now()};
}
function sortGames(list){return [...list].sort((a,b)=>b.createdAt-a.createdAt);}
function filterGames(list,q){q=(q||"").trim().toLowerCase();if(!q)return list;return list.filter(g=>(g.name+" "+(g.note||"")).toLowerCase().includes(q));}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
// ENGINE-END

document.addEventListener("DOMContentLoaded",()=>{
  const $=id=>document.getElementById(id);
  const listEl=$("list"),countEl=$("count"),searchEl=$("search");
  let items=[];
  const load=()=>chrome.storage.local.get({games:[]},r=>{items=r.games;render();});
  const save=()=>chrome.storage.local.set({games:items});
  function render(){
    const q=searchEl.value,rows=sortGames(filterGames(items,q));
    countEl.textContent="("+items.length+")";
    listEl.innerHTML=rows.length?"":'<div class="empty">Shelf is empty. Add a classic above.</div>';
    for(const g of rows){
      const d=document.createElement("div");d.className="item";
      d.innerHTML='<div class="t">'+esc(g.name)+'</div>'
        +(g.note?'<div class="n">'+esc(g.note)+'</div>':'')
        +'<div class="ops"><a href="'+esc(g.url)+'" target="_blank">Play / archive ↗</a>'
        +'<button class="del" data-id="'+g.id+'">Remove</button></div>';
      listEl.appendChild(d);
    }
    listEl.querySelectorAll(".del").forEach(b=>b.onclick=()=>{items=items.filter(x=>x.id!==b.dataset.id);save();render();});
  }
  $("btnAdd").onclick=()=>{
    const g=makeGame($("fName").value,$("fUrl").value,$("fNote").value);
    if(!g){alert("Need a game name and a valid link.");return;}
    items.push(g);if(items.length>500)items=items.slice(-500);
    save();$("fName").value=$("fUrl").value=$("fNote").value="";render();
  };
  searchEl.oninput=render;
  $("btnClear").onclick=()=>{if(items.length&&confirm("Clear the whole shelf?")){items=[];save();render();}};
  load();
});
