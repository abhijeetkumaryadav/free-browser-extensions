/* Company Graveyard — defunct-company memorial. All local; archive links open only when clicked. */
// ENGINE-START
function cleanUrl(u){if(!u)return "";u=u.trim();if(!u)return "";if(/^https?:\/\//i.test(u))return u;if(/^[a-z0-9.-]+\.[a-z]{2,}/i.test(u))return "https://"+u;return "";}
function makeCompany(name,url,year,eulogy){
  name=(name||"").trim();if(!name||name.length>80)return null;
  const u=cleanUrl(url||"");if(url&&url.trim()&&!u)return null;
  year=parseInt(year,10);if(year&&(year<1970||year>2100))return null;
  eulogy=(eulogy||"").trim().slice(0,1000);
  return {id:Date.now()+""+Math.floor(Math.random()*1e4),name,url:u,year:year||null,eulogy,createdAt:Date.now()};
}
function archiveUrl(u){return "https://web.archive.org/web/"+encodeURIComponent(u);}
function sortCompanies(list){return [...list].sort((a,b)=>b.createdAt-a.createdAt);}
function filterCompanies(list,q){q=(q||"").trim().toLowerCase();if(!q)return list;return list.filter(c=>(c.name+" "+(c.eulogy||"")).toLowerCase().includes(q));}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
// ENGINE-END

document.addEventListener("DOMContentLoaded",()=>{
  const $=id=>document.getElementById(id);
  const listEl=$("list"),countEl=$("count"),searchEl=$("search");
  let items=[];
  const load=()=>chrome.storage.local.get({companies:[]},r=>{items=r.companies;render();});
  const save=()=>chrome.storage.local.set({companies:items});
  function render(){
    const q=searchEl.value,rows=sortCompanies(filterCompanies(items,q));
    countEl.textContent="("+items.length+")";
    listEl.innerHTML=rows.length?"":'<div class="empty">No burials yet. Lay one to rest above.</div>';
    for(const c of rows){
      const d=document.createElement("div");d.className="item";
      d.innerHTML='<div><span class="t">'+esc(c.name)+'</span>'+(c.year?'<span class="y">† '+c.year+'</span>':'')+'</div>'
        +(c.eulogy?'<div class="e">“'+esc(c.eulogy)+'”</div>':'')
        +'<div class="ops">'+(c.url?'<a href="'+archiveUrl(c.url)+'" target="_blank">Archive.org snapshot ↗</a>':'')
        +'<button class="del" data-id="'+c.id+'">Exhume</button></div>';
      listEl.appendChild(d);
    }
    listEl.querySelectorAll(".del").forEach(b=>b.onclick=()=>{items=items.filter(x=>x.id!==b.dataset.id);save();render();});
  }
  $("btnAdd").onclick=()=>{
    const c=makeCompany($("fName").value,$("fUrl").value,$("fYear").value,$("fEulogy").value);
    if(!c){alert("Give it a name (and a valid URL/year if you add those).");return;}
    items.push(c);if(items.length>500)items=items.slice(-500);
    save();$("fName").value=$("fUrl").value=$("fYear").value=$("fEulogy").value="";render();
  };
  searchEl.oninput=render;
  $("btnClear").onclick=()=>{if(items.length&&confirm("Exhume all buried companies?")){items=[];save();render();}};
  load();
});
