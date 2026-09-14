"use strict";
/* popup.js — la bulle de l'extension. Lit la page ACTIVE (celle derrière la
   popup), en extrait contacts / profils LinkedIn, et les enregistre dans une
   liste partagée avec l'application (même origine chrome-extension). */
const KEY="FT_OS_DB_v1";
const $=s=>document.querySelector(s);

function readDB(){ try{ const r=localStorage.getItem(KEY); if(r) return JSON.parse(r); }catch(e){} return null; }
function writeDB(db){ try{ localStorage.setItem(KEY,JSON.stringify(db)); }catch(e){}
  try{ chrome.storage&&chrome.storage.local&&chrome.storage.local.set({[KEY]:db}); }catch(e){} }
async function ensureDB(){ // fusionne avec chrome.storage si localStorage vide (autres onglets)
  let db=readDB();
  if(!db && chrome.storage){ try{ const g=await chrome.storage.local.get(KEY); if(g&&g[KEY]) db=g[KEY]; }catch(e){} }
  if(!db) db={contacts:[]};
  if(!Array.isArray(db.contacts)) db.contacts=[];
  return db;
}
async function activeTab(){ const [t]=await chrome.tabs.query({active:true,currentWindow:true}); return t; }
function hostOf(u){ try{ return new URL(u).hostname.replace(/^www\./,""); }catch(e){ return ""; } }

let ROWS=[];         // {name,headline,email,phone,company,url,sel}
let CURRENT=null;    // dernier résultat de scan

function guessNameFromEmail(email){
  const l=(email||"").split("@")[0];
  if(/^[a-z]+[._\-][a-z]+$/.test(l)) return l.split(/[._\-]/).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  return "";
}
function buildRows(res){
  const rows=[]; const dom=hostOf(res.url);
  if(res.profiles && res.profiles.length){
    res.profiles.forEach(p=>rows.push({name:p.name,headline:p.headline||"",email:"",phone:"",company:"",url:p.url,sel:true}));
  }
  if(res.businesses && res.businesses.length){
    res.businesses.forEach(b=>rows.push({name:b.name||"",headline:b.address||"",email:"",phone:b.phone||"",company:b.website?hostOf(b.website):"",url:b.website||res.url,sel:true}));
  }
  // Résultats de recherche (Google/Bing/DDG) : chaque entreprise -> une ligne
  // (nom + site + domaine, réutilisable ensuite par « Deviner l'email »).
  if(res.results && res.results.length){
    res.results.forEach(rr=>rows.push({name:"",headline:rr.title||rr.domain||"",email:"",phone:"",company:rr.domain||"",url:rr.url||("https://"+(rr.domain||"")),sel:true}));
  }
  (res.emails||[]).forEach(e=>{
    rows.push({name:guessNameFromEmail(e)||res.name||"",headline:res.headline||"",email:e,phone:(res.phones&&res.phones[0])||"",company:e.split("@")[1]||dom,url:res.url,sel:true});
  });
  if(!(res.emails||[]).length && (res.phones||[]).length){
    res.phones.forEach(ph=>rows.push({name:res.name||"",headline:res.headline||"",email:"",phone:ph,company:dom,url:res.url,sel:true}));
  }
  // dédup
  const seen=new Set();
  return rows.filter(r=>{ const k=r.email||r.url+"|"+r.name+"|"+r.phone; if(seen.has(k))return false; seen.add(k); return true; });
}

function setCtx(res){
  const ctx=$("#ctx"), t=$("#ctxText");
  if(res && res.isLinkedIn){ ctx.classList.add("li");
    t.textContent = res.isSearch ? "LinkedIn — page de résultats" : "LinkedIn — profil"; }
  else { ctx.classList.remove("li"); t.textContent = hostOf(res? res.url : "") || "Page web"; }
}

function render(){
  const box=$("#rows");
  if(!ROWS.length){ box.innerHTML=`<div class="empty">Aucun contact détecté sur cette page.<br>Ouvrez une page de résultats LinkedIn, un annuaire ou une page « contact ».</div>`;
    $("#toolbar").classList.add("hide"); $("#saveBar").classList.add("hide"); return; }
  box.innerHTML=ROWS.map((r,i)=>`<div class="row ${r.sel?'on':''}" data-i="${i}">
    <span class="chk"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></span>
    <div class="info">
      <div class="nm">${esc(r.name||r.email||r.phone||"—")}</div>
      ${r.headline?`<div class="sub">${esc(r.headline)}</div>`:""}
      ${r.email?`<div class="mail">${esc(r.email)}</div>`:""}
      ${r.phone?`<div class="sub">${esc(r.phone)}</div>`:""}
      ${r.email?'<span class="tag g">email</span>':r.phone?'<span class="tag w">téléphone</span>':'<span class="tag n">profil</span>'}
    </div></div>`).join("");
  box.querySelectorAll(".row").forEach(el=>el.onclick=()=>{ const i=+el.dataset.i; ROWS[i].sel=!ROWS[i].sel; render(); });
  $("#toolbar").classList.remove("hide"); $("#saveBar").classList.remove("hide");
  const n=ROWS.filter(r=>r.sel).length;
  $("#count").textContent=n; $("#saveN").textContent=n?`(${n})`:"";
  $("#selAll").classList.toggle("on", n===ROWS.length && n>0);
  $("#selAll").style.background=(n===ROWS.length&&n>0)?"var(--brand)":"";
  $("#selAll").style.borderColor=(n===ROWS.length&&n>0)?"var(--brand)":"";
  $("#selAll").querySelector("svg").style.opacity=(n===ROWS.length&&n>0)?"1":"0";
}
const esc=s=>(s==null?"":String(s)).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function withPage(url,n){ try{ const u=new URL(url); u.searchParams.set("page",String(n)); return u.toString(); }catch(e){ return url; } }
function withGoogleStart(url,n){ try{ const u=new URL(url); u.searchParams.set("start",String((n-1)*10)); return u.toString(); }catch(e){ return url; } }
function isGoogleSearch(url){ return /google\.[a-z.]+\/search/.test(url||""); }
function isMapsUrl(url){ return /google\.[a-z.]+\/maps/.test(url||""); }
// Défilement du volet Google Maps (chargé à la volée) — injecté dans la page.
function popupScrollFeed(){ try{ var f=document.querySelector('[role="feed"]')||document.querySelector('div[aria-label][tabindex="-1"]'); if(f){ f.scrollTop=f.scrollHeight; } window.scrollTo(0,document.body.scrollHeight); return true; }catch(e){ return false; } }
function waitComplete(tabId,ms=12000){ return new Promise(res=>{ const t0=Date.now();
  const iv=setInterval(async()=>{ try{ const t=await chrome.tabs.get(tabId);
    if(t.status==="complete"||Date.now()-t0>ms){ clearInterval(iv); setTimeout(res,900); } }catch(e){ clearInterval(iv); res(); } },350); }); }

async function scan(){
  const btn=$("#scan"), lab=$("#scanLabel");
  btn.disabled=true; lab.innerHTML='<span class="spin"></span>';
  $("#status").textContent="Lecture de la page…";
  try{
    const tab=await activeTab();
    if(!tab || !/^https?:/.test(tab.url||"")){ $("#status").textContent="Ouvrez d'abord une page web (onglet actif)."; return; }
    let [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:ftPageScrape});
    CURRENT=result; setCtx(result);
    // Google Maps : faire défiler le volet pour charger toutes les fiches, puis re-scraper.
    if(result.isMaps || isMapsUrl(tab.url)){
      for(let s=0;s<8;s++){ $("#status").textContent=`Chargement des fiches… ${s+1}/8`;
        try{ await chrome.scripting.executeScript({target:{tabId:tab.id},func:popupScrollFeed}); }catch(e){}
        await new Promise(r=>setTimeout(r,700)); }
      try{ const [{result:rm}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:ftPageScrape}); if(rm){ result=rm; CURRENT=rm; } }catch(e){}
    }
    let rows=buildRows(result);
    // Multi-pages LinkedIn + Google (page de résultats)
    const pages=Math.max(1,Math.min(20,+$("#pages").value||1));
    const liMulti = result.isLinkedIn && result.isSearch;
    const gMulti = (result.isSerp || isGoogleSearch(tab.url)) && !result.isMaps;
    if((liMulti||gMulti) && pages>1){
      const base=tab.url; const seen=new Set(rows.map(r=>r.url));
      for(let k=2;k<=pages;k++){
        $("#status").textContent=`Page ${k}/${pages}…`;
        const nextUrl = gMulti ? withGoogleStart(base,k) : withPage(base,k);
        await chrome.tabs.update(tab.id,{url:nextUrl});
        await waitComplete(tab.id);
        try{ const [{result:r2}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:ftPageScrape});
          let fresh=0; buildRows(r2).forEach(r=>{ if(!seen.has(r.url)){ seen.add(r.url); rows.push(r); fresh++; } });
          if(gMulti && fresh===0) { try{ await chrome.tabs.update(tab.id,{url:base}); }catch(e){} break; }
        }catch(e){}
      }
      try{ await chrome.tabs.update(tab.id,{url:base}); }catch(e){}
    }
    ROWS=rows; render();
    $("#status").textContent = rows.length? `${rows.length} contact(s) détecté(s).` : "";
  }catch(e){
    $("#status").textContent="Impossible de lire cette page (page protégée ?). Réessayez sur une page web classique.";
  }finally{ btn.disabled=false; lab.textContent="Analyser à nouveau"; }
}

function refreshLists(db){
  const sel=$("#listSel"); const tags=[...new Set(db.contacts.flatMap(c=>c.tags||[]))];
  const opts=["Prospection LinkedIn",...tags.filter(t=>t!=="Prospection LinkedIn")];
  sel.innerHTML=opts.map(o=>`<option>${esc(o)}</option>`).join("");
}
async function save(){
  const db=await ensureDB();
  const list=$("#listSel").value.trim()||"Prospection LinkedIn";
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  let n=0;
  ROWS.filter(r=>r.sel).forEach(r=>{
    const dup = r.email ? db.contacts.some(c=>c.email===r.email)
              : db.contacts.some(c=>c.name===r.name && (c.sourceUrl===r.url));
    if(dup){ // ajoute juste la liste
      const c=db.contacts.find(c=>r.email?c.email===r.email:(c.name===r.name&&c.sourceUrl===r.url));
      if(c){ c.tags=c.tags||[]; if(!c.tags.includes(list)) c.tags.push(list); }
      return;
    }
    db.contacts.unshift({id:uid(),email:r.email||"",name:r.name||"",domain:r.company||"",phone:r.phone||"",
      service:r.headline||"",sourceUrl:r.url||"",confidence:"",source:CURRENT&&CURRENT.isLinkedIn?"linkedin":"web",stage:"À contacter",added:Date.now(),tags:[list]});
    n++;
  });
  writeDB(db);
  $("#status").textContent = `${n} contact(s) enregistré(s) dans « ${list} ».`;
  refreshLists(db);
}

// wiring
(async()=>{
  const db=await ensureDB(); refreshLists(db);
  const tab=await activeTab().catch(()=>null);
  if(tab) setCtx({url:tab.url,isLinkedIn:/linkedin\./.test(hostOf(tab.url)),isSearch:/\/search\//.test(tab.url||"")});
  if(tab && (/linkedin\.com\/search/.test(tab.url||"") || isGoogleSearch(tab.url))) $("#pagesWrap").classList.remove("hide");
})();
$("#scan").addEventListener("click",scan);
$("#saveBtn").addEventListener("click",save);
$("#selAll").addEventListener("click",()=>{ const all=ROWS.every(r=>r.sel); ROWS.forEach(r=>r.sel=!all); render(); });
$("#newList").addEventListener("click",()=>{ const name=prompt("Nom de la nouvelle liste :"); if(name&&name.trim()){ const o=document.createElement("option"); o.textContent=name.trim(); o.selected=true; $("#listSel").prepend(o); } });
$("#openApp").addEventListener("click",()=>{ const url=chrome.runtime.getURL("index.html"); chrome.tabs.create({url}); window.close(); });
