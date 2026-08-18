"use strict";
/* ============================================================
   1. STORE — persistance locale, zéro dépendance
   ============================================================ */
const KEY = "FT_OS_DB_v1";
const DEFAULT_DB = {
  meta:{ created:Date.now(), version:1 },
  settings:{ theme:"light", caTarget:120000, panier:790, convDevis:0.30, convRdv:0.25, convContact:0.35,
    quoteSeq:1, invoiceSeq:1, tvaDefault:0, erasmusEnvelope:0, lastBackup:0,
    company:{
      name:"FORMASKILLS TRAVEL",
      legal:"SAS au capital de 500 € — RCS Montpellier 990 746 430",
      addr1:"Siège : 10 rue du Micocoulier, 34680 Saint-Georges-d'Orques",
      addr2:"Bureau commercial : 17 rue Danton, 34200 Sète",
      phone:"+33 9 75 46 22 81",
      email:"contact.travel@formaskills.fr",
      web:"formaskills-travel.fr",
      iban:"FR76 1695 8000 0149 0124 0764 046",
      bic:"QNTOFRP1XXX",
      atout:"", rcp:"", garantie:"", tvaMention:"TVA non applicable, art. 293 B du CGI"
    },
    docStyle:{ logo:"", accent:"#1d5fd6", headerExtra:"", footerMode:"auto", footerText:"", showBank:true }
  },
  partners:[], projects:[], participants:[], providers:[],
  budget:[], tasks:[], contacts:[], automations:[], quotes:[], docs:[], activity:[],
  customFields:{ partners:[], projects:[], participants:[], providers:[], tasks:[] }
};
function loadDB(){
  try{ const raw=localStorage.getItem(KEY); if(raw){ return migrate(JSON.parse(raw)); } }
  catch(e){ console.warn("DB corrompue, réinit",e); }
  return structuredClone(DEFAULT_DB);
}
function migrate(db){ // garantit la présence de toutes les clés (évite les casses futures)
  const d=structuredClone(DEFAULT_DB);
  for(const k in d){ if(!(k in db)) db[k]=d[k]; }
  for(const k in d.settings){ if(db.settings==null) db.settings={}; if(!(k in db.settings)) db.settings[k]=d.settings[k]; }
  return db;
}
const _hadLocal = !!localStorage.getItem(KEY);
let DB = loadDB();
let _saveT=null;
function mirrorChrome(){ try{ if(typeof chrome!=="undefined" && chrome.storage && chrome.storage.local) chrome.storage.local.set({[KEY]:DB}); }catch(e){} }
function save(){ // debounce léger pour ne pas écrire à chaque frappe
  clearTimeout(_saveT);
  _saveT=setTimeout(()=>{ try{ localStorage.setItem(KEY, JSON.stringify(DB)); mirrorChrome(); }catch(e){ toast("Stockage plein — exportez une sauvegarde","bad"); } }, 120);
}
function saveNow(){ try{ localStorage.setItem(KEY, JSON.stringify(DB)); mirrorChrome(); }catch(e){} }
/* Résilience : si localStorage a été vidé mais que chrome.storage a survécu
   (recharge/mise à jour de l'extension), on récupère les données. */
async function hydrateFromChrome(){
  try{
    if(typeof chrome==="undefined" || !chrome.storage || !chrome.storage.local) return;
    const got = await chrome.storage.local.get(KEY); const remote = got && got[KEY];
    if(remote && !_hadLocal){ DB = migrate(remote); saveNow(); renderNav(); go(CURRENT); toast("Données restaurées depuis la sauvegarde interne"); }
    else { mirrorChrome(); }
  }catch(e){}
}
const uid = ()=> Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function logAct(msg){ DB.activity.unshift({t:Date.now(),m:msg}); DB.activity=DB.activity.slice(0,120); }

/* ============================================================
   2. UTILITAIRES UI
   ============================================================ */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = s => (s==null?"":String(s)).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const eur = n => (Number(n)||0).toLocaleString("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const fmtDate = t => t? new Date(t).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}):"—";
function toast(msg,kind="ok"){
  const el=document.createElement("div"); el.className="toast "+(kind==="ok"?"ok":kind==="bad"?"bad":kind==="warn"?"warn":"");
  el.textContent=msg;
  $("#toasts").appendChild(el);
  setTimeout(()=>{el.style.transition="opacity .3s,transform .3s";el.style.opacity="0";el.style.transform="translateX(40px)";setTimeout(()=>el.remove(),320);},3200);
}
function copy(text){ navigator.clipboard?.writeText(text).then(()=>toast("Copié : "+text)).catch(()=>toast("Copie impossible","warn")); }
function confirmModal(title,msg,onYes,danger){
  openModal({title, body:`<p style="margin:0;color:var(--muted);font-weight:600">${esc(msg)}</p>`,
    footer:[{label:"Annuler",cls:"ghost",act:closeModal},{label:danger?"Supprimer":"Confirmer",cls:danger?"":"primary",act:()=>{closeModal();onYes();}}]});
}
/* Modal engine */
function openModal({title,body,footer=[],wide=false}){
  const root=$("#modalRoot");
  const foot=footer.map((b,i)=>`<button class="btn ${b.cls||''}" data-fi="${i}">${esc(b.label)}</button>`).join("");
  root.innerHTML=`<div class="overlay" id="ov"><div class="modal ${wide?'wide':''}" role="dialog">
    <div class="mhead"><h3>${esc(title)}</h3><div class="spacer"></div><button class="btn ghost icon" id="mx" aria-label="Fermer">&times;</button></div>
    <div class="mbody">${body}</div>${footer.length?`<div class="mfoot">${foot}</div>`:''}</div></div>`;
  footer.forEach((b,i)=>$(`[data-fi="${i}"]`,root)?.addEventListener("click",b.act));
  $("#mx",root).onclick=closeModal;
  $("#ov",root).addEventListener("mousedown",e=>{ if(e.target.id==="ov") closeModal(); });
  return root;
}
function closeModal(){ $("#modalRoot").innerHTML=""; }
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeModal(); });

/* ============================================================
   Délégation d'événements — compatible avec la CSP stricte des
   extensions Chrome (MV3), qui interdit les handlers inline.
   On route via data-call="fn('arg')" (parsé sans eval) ou
   data-act="nom" (handler enregistré lisant des data-*).
   ============================================================ */
function parseCall(s){
  const m=/^([a-zA-Z_$][\w$]*)\((.*)\)$/.exec((s||"").trim()); if(!m) return null;
  const argstr=m[2].trim(), args=[];
  if(argstr){ let cur="",q=null;
    for(let i=0;i<argstr.length;i++){ const c=argstr[i];
      if(q){ if(c===q) q=null; else cur+=c; }
      else if(c==="'"||c==='"'){ q=c; }
      else if(c===","){ args.push(cur.trim()); cur=""; }
      else cur+=c; }
    args.push(cur.trim()); }
  return {fn:m[1], args:args.map(a=> a===""?"":a==="null"?null:/^-?\d+(\.\d+)?$/.test(a)?Number(a):a)};
}
const DELEGATED_ACTS = {
  saveContact: el => saveContact(el.dataset.email, el.dataset.name||"", el.dataset.domain||"", +el.dataset.conf||0),
};
document.addEventListener("click", e=>{
  const el=e.target.closest("[data-act],[data-call]"); if(!el) return;
  if(el.dataset.act){ const f=DELEGATED_ACTS[el.dataset.act]; if(f){ e.preventDefault(); f(el,e); } return; }
  const call=parseCall(el.dataset.call);
  if(call && typeof window[call.fn]==="function"){ e.preventDefault(); window[call.fn](...call.args); }
});
window.finderGoto=t=>{ FINDER_TAB=t; VIEWS.finder(); };
window.importLastExtract=()=>importAllContacts(window.__lastExtract||[]);
window.importLastDomain=()=>importAllContacts(window.__lastDomain||[]);

/* ============================================================
   3. MOTEUR CHERCHEUR DE CONTACTS (100% hors-ligne)
   Réplique les techniques cœur des extensions email-finder :
   permutation de patterns, extraction bulk, apprentissage de
   pattern, vérification heuristique. Aucune API, aucun réseau.
   ============================================================ */
/* Bookmarklet « sur toute page » : extrait emails + téléphones (liens mailto/tel
   inclus) de la page courante et les affiche dans une fenêtre. 100% local. */
const BOOKMARKLET="javascript:(function(){var t=document.body.innerText+' '+[].map.call(document.querySelectorAll('a[href^=\"mailto:\"],a[href^=\"tel:\"]'),function(a){return decodeURIComponent(a.getAttribute('href').replace(/^(mailto|tel):/,''))}).join(' ');var e=[...new Set((t.match(/[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}/g)||[]).map(function(x){return x.toLowerCase()}))];var p=[...new Set((t.match(/(?:(?:\\+|00)\\d{1,3}[\\s.\\-]?)?(?:\\(?\\d{1,4}\\)?[\\s.\\-]?){2,5}\\d{2,4}/g)||[]).map(function(x){return x.trim()}).filter(function(x){var d=x.replace(/\\D/g,'');return d.length>=9&&d.length<=15}))];var o='EMAILS ('+e.length+')\\n'+e.join('\\n')+'\\n\\nTELEPHONES ('+p.length+')\\n'+p.join('\\n');var w=window.open('','_blank','width=480,height=600');w.document.write('<title>Contacts</title><pre style=\"font:13px/1.6 monospace;padding:18px;white-space:pre-wrap\">'+o.replace(/[&<]/g,function(c){return c=='&'?'&amp;':'&lt;'})+'</pre>');})();";
const EmailFinder = (()=> {
  const deburr = s => (s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"");
  // patterns d'email d'entreprise les plus fréquents, avec poids de confiance
  const PATTERNS = [
    {id:"f.l",       fn:(f,l)=>`${f}.${l}`,        w:34, lab:"prenom.nom"},
    {id:"fl",        fn:(f,l)=>`${f}${l}`,         w:14, lab:"prenomnom"},
    {id:"fi.l",      fn:(f,l)=>`${f[0]}.${l}`,     w:12, lab:"p.nom"},
    {id:"fil",       fn:(f,l)=>`${f[0]}${l}`,      w:11, lab:"pnom"},
    {id:"f_l",       fn:(f,l)=>`${f}_${l}`,        w:6,  lab:"prenom_nom"},
    {id:"f-l",       fn:(f,l)=>`${f}-${l}`,        w:4,  lab:"prenom-nom"},
    {id:"f",         fn:(f,l)=>`${f}`,             w:5,  lab:"prenom"},
    {id:"l.f",       fn:(f,l)=>`${l}.${f}`,        w:4,  lab:"nom.prenom"},
    {id:"lf",        fn:(f,l)=>`${l}${f}`,         w:2,  lab:"nomprenom"},
    {id:"l",         fn:(f,l)=>`${l}`,             w:2,  lab:"nom"},
    {id:"fli",       fn:(f,l)=>`${f}${l[0]}`,      w:2,  lab:"prenomn"},
    {id:"li.f",      fn:(f,l)=>`${l}.${f[0]}`,     w:1,  lab:"nom.p"},
  ];
  function candidates(first,last,domain){
    const f=deburr(first), l=deburr(last), d=(domain||"").trim().toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/\/.*$/,"");
    if(!d) return [];
    const out=[];
    for(const p of PATTERNS){
      let local; try{ local=p.fn(f,l); }catch(e){ continue; }
      if(!local || local.includes("undefined")) continue;
      out.push({ email:`${local}@${d}`, pattern:p.id, patternLabel:p.lab, score:p.w });
    }
    // normaliser en confiance 0..99 (le pattern dominant reste inférieur à une preuve réelle)
    const max=Math.max(...out.map(o=>o.score));
    out.forEach(o=> o.confidence=Math.round(40 + (o.score/max)*45)); // 40..85
    // dédup
    const seen=new Set();
    return out.filter(o=> seen.has(o.email)?false:(seen.add(o.email),true)).sort((a,b)=>b.confidence-a.confidence);
  }
  // Apprend le pattern à partir d'un email connu -> l'applique à d'autres personnes
  function learnPattern(first,last,knownEmail){
    const f=deburr(first), l=deburr(last);
    const m=/^([^@]+)@(.+)$/.exec((knownEmail||"").trim().toLowerCase());
    if(!m) return null;
    const local=m[1], domain=m[2];
    for(const p of PATTERNS){
      let cand; try{ cand=p.fn(f,l); }catch(e){ continue; }
      if(cand===local) return {pattern:p.id, patternLabel:p.lab, domain, template:p};
    }
    return {pattern:"inconnu", patternLabel:"non reconnu", domain, template:null};
  }
  function applyLearned(learned,first,last){
    if(!learned||!learned.template) return null;
    const f=deburr(first), l=deburr(last);
    return `${learned.template.fn(f,l)}@${learned.domain}`;
  }
  // Extraction bulk : depuis n'importe quel texte de page (résultats de recherche,
  // annuaire, site) -> emails, téléphones, liens sociaux, + heuristique nom/role
  const RE_EMAIL = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
  const RE_PHONE = /(?:(?:\+|00)\d{1,3}[\s.\-]?)?(?:\(?\d{1,4}\)?[\s.\-]?){2,5}\d{2,4}/g;
  const RE_URL   = /\bhttps?:\/\/[^\s"'<>)]+/gi;
  const ROLE_HINTS = ["contact","info","hello","bonjour","sales","vente","commercial","support","admin","direction","rh","recrutement","accueil","secretariat","compta","noreply","no-reply","postmaster","webmaster"];
  const DISPOSABLE = ["mailinator.com","yopmail.com","guerrillamail.com","10minutemail.com","trashmail.com","tempmail.com","getnada.com","sharklasers.com","temp-mail.org"];
  function cleanEmail(e){ return e.toLowerCase().replace(/[.,;:)]+$/,""); }
  function classify(email){
    const [local,domain]=email.split("@");
    const isRole = ROLE_HINTS.some(r=> local===r || local.startsWith(r+".") || local.startsWith(r+"-") || local===r.replace("-",""));
    const isDisp = DISPOSABLE.includes(domain);
    const free = ["gmail.com","yahoo.com","yahoo.fr","hotmail.com","hotmail.fr","outlook.com","outlook.fr","live.fr","orange.fr","free.fr","wanadoo.fr","laposte.net","icloud.com"].includes(domain);
    return {isRole,isDisp,free,domain};
  }
  function extract(text){
    const raw = text||"";
    const emails = [...new Set((raw.match(RE_EMAIL)||[]).map(cleanEmail))];
    // téléphones : filtrer les faux positifs (trop courts)
    const phones = [...new Set((raw.match(RE_PHONE)||[])
      .map(p=>p.trim())
      .filter(p=>{ const d=p.replace(/\D/g,""); return d.length>=9 && d.length<=15; }))];
    const urls = [...new Set(raw.match(RE_URL)||[])];
    const socials = urls.filter(u=>/(linkedin|facebook|instagram|twitter|x\.com|youtube|tiktok)\./i.test(u));
    const sites = urls.filter(u=>!socials.includes(u));
    const contacts = emails.map(e=>{
      const c=classify(e);
      // deviner un nom depuis le local part si prenom.nom
      let guessName="";
      if(!c.isRole && /^[a-z]+[._\-][a-z]+$/.test(e.split("@")[0])){
        const parts=e.split("@")[0].split(/[._\-]/);
        guessName=parts.map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
      }
      return { email:e, domain:c.domain, type:c.isRole?"générique":(c.free?"perso":"nominatif"),
        disposable:c.isDisp, guessName };
    });
    return {emails,phones,sites,socials,contacts};
  }
  // Vérification offline honnête : syntaxe + heuristiques (pas de vrai SMTP possible en navigateur)
  function verify(email){
    const e=(email||"").trim().toLowerCase();
    const okSyntax = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
    if(!okSyntax) return {status:"invalide", reason:"Syntaxe incorrecte", score:0};
    const c=classify(e);
    if(c.isDisp) return {status:"jetable", reason:"Domaine email jetable", score:8};
    if(c.isRole) return {status:"générique", reason:"Adresse de service (non nominative)", score:55};
    if(c.free)   return {status:"perso", reason:"Messagerie personnelle (gmail, etc.)", score:60};
    return {status:"probable", reason:"Format professionnel plausible", score:78};
  }
  // Domain search (façon Hunter) : à partir d'un domaine, propose les adresses
  // de service courantes + les départements. 100% hors-ligne.
  const ROLE_ADDR=[
    ["contact","Général"],["info","Général"],["hello","Général"],["bonjour","Général"],
    ["accueil","Général"],["sales","Commercial"],["commercial","Commercial"],["vente","Commercial"],
    ["marketing","Marketing"],["rh","RH"],["recrutement","RH"],["direction","Direction"],
    ["compta","Finance"],["facturation","Finance"],["support","Support"],["admin","Admin"]
  ];
  function cleanDomain(d){ return (d||"").trim().toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/\/.*$/,"").replace(/\s/g,""); }
  function domainSearch(domain){
    const d=cleanDomain(domain); if(!d) return null;
    const roles=ROLE_ADDR.map(([r,dept])=>({email:`${r}@${d}`, dept, confidence:48}));
    return {domain:d, roles};
  }
  // Recherche en masse : lignes {first,last,domain} -> meilleur email + alternatives
  function bulkFind(rows){
    return rows.map(r=>{
      const c=candidates(r.first,r.last,r.domain);
      return { first:r.first,last:r.last,domain:cleanDomain(r.domain),
        email:c[0]?.email||"", pattern:c[0]?.patternLabel||"", confidence:c[0]?.confidence||0,
        alt:c.slice(1,3).map(x=>x.email).join(" | ") };
    });
  }
  // Parseur de profil (équivalent hors-ligne d'un scraper LinkedIn) : on colle le
  // texte d'un profil / d'une fiche et on en extrait une structure exploitable.
  function parseProfile(text){
    const raw=(text||"").replace(/\r/g,"");
    const lines=raw.split("\n").map(s=>s.trim()).filter(Boolean);
    const emails=[...new Set((raw.match(RE_EMAIL)||[]).map(cleanEmail))];
    const phones=[...new Set((raw.match(RE_PHONE)||[]).map(p=>p.trim()).filter(p=>{const d=p.replace(/\D/g,"");return d.length>=9&&d.length<=15;}))];
    // nom : 1re ligne "prénom nom" plausible (2-3 mots, lettres, pas d'@, pas de chiffre)
    let name="";
    for(const l of lines){
      if(/@|https?:|\d/.test(l)) continue;
      const w=l.split(/\s+/);
      if(w.length>=2 && w.length<=3 && w.every(x=>/^[A-Za-zÀ-ÿ'’\-]{2,}$/.test(x))){ name=l; break; }
    }
    // titre & société : ligne avec " at / chez / @ / - / | "
    let title="", company="";
    const sep=/\s+(?:at|chez|@|\-|\|)\s+/i;
    for(const l of lines){
      if(l===name) continue;
      if(sep.test(l)){ const [t,c]=l.split(sep); title=(t||"").trim(); company=(c||"").trim(); break; }
    }
    const parts=name.split(/\s+/);
    return { name, first:parts[0]||"", last:parts.slice(1).join(" ")||"", title, company,
      email:emails[0]||"", phone:phones[0]||"", allEmails:emails, allPhones:phones };
  }
  function dedupe(list){ const seen=new Set(); return list.filter(c=>{const k=(c.email||"").toLowerCase(); if(!k||seen.has(k))return false; seen.add(k); return true;}); }
  return {candidates,learnPattern,applyLearned,extract,verify,PATTERNS,domainSearch,bulkFind,parseProfile,dedupe,cleanDomain};
})();

/* ============================================================
   3b. SCRAPER (mode extension) — LinkedIn & web multi-pages
   Fonctionne quand l'outil est installé comme extension Chrome
   (accès à chrome.tabs / chrome.scripting). En fichier simple,
   l'onglet propose une solution de repli (bookmarklet + collage).
   ============================================================ */
const IS_EXT = (typeof chrome!=="undefined" && chrome.runtime && chrome.runtime.id && chrome.tabs && chrome.scripting);
/* Fonction injectée DANS la page cible (doit être autonome, sans variable externe) */
function ftPageScrape(){
  try{
    const txt=(document.body&&document.body.innerText)||"";
    const mailtos=[].slice.call(document.querySelectorAll('a[href^="mailto:"]')).map(a=>{try{return decodeURIComponent(a.getAttribute("href").slice(7).split("?")[0]);}catch(e){return "";}});
    const tels=[].slice.call(document.querySelectorAll('a[href^="tel:"]')).map(a=>a.getAttribute("href").slice(4));
    const blob=txt+" "+mailtos.join(" ")+" "+tels.join(" ");
    const emails=Array.from(new Set((blob.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g)||[]).map(e=>e.toLowerCase().replace(/[.,;:)]+$/,"")))).filter(e=>!/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e));
    const phones=Array.from(new Set((blob.match(/(?:(?:\+|00)\d{1,3}[\s.\-]?)?(?:\(?\d{1,4}\)?[\s.\-]?){2,5}\d{2,4}/g)||[]).map(p=>p.trim()).filter(p=>{var d=p.replace(/\D/g,"");return d.length>=9&&d.length<=15;})));
    let name="", headline="", company="";
    const host=location.hostname;
    if(/linkedin\./.test(host)){
      const h1=document.querySelector("h1"); if(h1) name=h1.innerText.trim();
      const hl=document.querySelector(".text-body-medium.break-words, .pv-text-details__left-panel .text-body-medium, .top-card-layout__headline");
      if(hl) headline=hl.innerText.trim();
      const cm=document.querySelector('[aria-label^="Current company"], .pv-text-details__right-panel a[href*="/company/"]');
      if(cm) company=cm.innerText.trim();
    } else {
      const h1=document.querySelector("h1"); if(h1) name=h1.innerText.trim().slice(0,80);
    }
    const links=Array.from(new Set([].slice.call(document.querySelectorAll("a[href]")).map(a=>a.href).filter(h=>/^https?:/.test(h))));
    return {url:location.href, title:document.title, host, name, headline, company, emails, phones, links};
  }catch(e){ return {url:location.href, error:String(e), emails:[], phones:[], links:[]}; }
}
const Scraper = (()=>{
  const appUrl = IS_EXT ? chrome.runtime.getURL("index.html") : "";
  function waitTab(tabId,timeout=18000){ return new Promise(res=>{ const t0=Date.now();
    const iv=setInterval(async()=>{ try{ const tb=await chrome.tabs.get(tabId);
      if(tb.status==="complete"||Date.now()-t0>timeout){ clearInterval(iv); setTimeout(()=>res(tb),600); } }
      catch(e){ clearInterval(iv); res(null); } },400); }); }
  async function scrapeTab(tabId){ try{ const r=await chrome.scripting.executeScript({target:{tabId},func:ftPageScrape}); return r&&r[0]&&r[0].result; }catch(e){ return null; } }
  async function listTabs(){ const tabs=await chrome.tabs.query({}); return tabs.filter(t=>t.url&&/^https?:/.test(t.url)&&!t.url.startsWith(appUrl)); }
  function searchURL(engine,q,page){ q=encodeURIComponent(q);
    return engine==="google" ? `https://www.google.com/search?q=${q}&start=${page*10}` : `https://duckduckgo.com/html/?q=${q}`; }
  function decodeLink(href){ try{ if(/duckduckgo\.com\/l\//.test(href)){ const u=new URL(href); const t=u.searchParams.get("uddg"); if(t) return decodeURIComponent(t); } }catch(e){} return href; }
  const JUNK=/(google\.|gstatic\.|googleusercontent|youtube\.|ytimg|duckduckgo\.|bing\.|microsoft\.|facebook\.com\/tr|w3\.org|schema\.org|gmpg\.org|wordpress\.org)/i;
  function externalLinks(res){ return Array.from(new Set((res.links||[]).map(decodeLink).filter(h=>/^https?:/.test(h)&&!JUNK.test(h)))); }
  function mergeContacts(out,seen,res){
    const src=res.url||"", domain=(res.host||(src.split("/")[2]||"")).replace(/^www\./,"");
    const svc=res.headline||"";
    if((res.emails||[]).length){
      res.emails.forEach(email=>{ if(seen.has(email))return; seen.add(email);
        out.push({email, name:res.name||"", phone:(res.phones&&res.phones[0])||"", company:res.company||domain, service:svc, source:src}); });
    } else if((res.phones||[]).length && (res.name||res.company)){
      res.phones.forEach(ph=>{ const k="tel:"+ph+"|"+domain; if(seen.has(k))return; seen.add(k);
        out.push({email:"", name:res.name||"", phone:ph, company:res.company||domain, service:svc, source:src}); });
    }
  }
  async function crawl(opts,onProgress){
    const {engine,query,pages,perPage,visit}=opts; const out=[], seen=new Set();
    for(let pg=0; pg<pages; pg++){
      onProgress&&onProgress(`Recherche — page ${pg+1}/${pages}`);
      let tab; try{ tab=await chrome.tabs.create({url:searchURL(engine,query,pg),active:false}); }catch(e){ continue; }
      await waitTab(tab.id); const res=await scrapeTab(tab.id);
      if(res){ mergeContacts(out,seen,res);
        if(visit){ const links=externalLinks(res).slice(0,perPage);
          for(let i=0;i<links.length;i++){ onProgress&&onProgress(`Page ${pg+1} — site ${i+1}/${links.length} · ${out.length} contact(s)`);
            let t2; try{ t2=await chrome.tabs.create({url:links[i],active:false}); }catch(e){ continue; }
            await waitTab(t2.id); const r2=await scrapeTab(t2.id); if(r2) mergeContacts(out,seen,r2);
            try{ await chrome.tabs.remove(t2.id); }catch(e){} } } }
      try{ await chrome.tabs.remove(tab.id); }catch(e){}
      if(engine==="duckduckgo") break; // DDG html n'a pas de pagination par start
    }
    return out;
  }
  return {IS_EXT, listTabs, scrapeTab, crawl, mergeContacts, externalLinks};
})();

/* ============================================================
   4. MOTEUR D'AUTOMATISATIONS (remplace Make, côté client)
   Règles simples : QUAND <event> [SI condition] ALORS <actions>.
   Déclenché à chaque mutation d'entité.
   ============================================================ */
const Automations = (()=>{
  const EVENTS = {
    "partner.status": "Statut partenaire changé",
    "project.created":"Projet créé",
    "task.overdue":  "Tâche en retard (au chargement)",
    "participant.created":"Participant ajouté",
  };
  const ACTIONS = {
    "task": "Créer une tâche",
    "toast":"Afficher une notification",
    "flag": "Marquer / étiqueter",
  };
  function run(eventKey, ctx){
    const active = DB.automations.filter(a=>a.on && a.event===eventKey);
    for(const a of active){
      if(a.condField && a.condValue){
        const v = (ctx?.[a.condField] ?? "").toString().toLowerCase();
        if(!v.includes(a.condValue.toLowerCase())) continue;
      }
      applyAction(a, ctx);
      logAct(`Auto « ${a.name} » déclenchée`);
    }
  }
  function applyAction(a, ctx){
    if(a.action==="task"){
      DB.tasks.push({id:uid(), title:tpl(a.actionValue||"Suite à automatisation", ctx),
        status:"À faire", due:Date.now()+3*864e5, priority:"Normale", auto:true});
      save();
    } else if(a.action==="toast"){
      toast(tpl(a.actionValue||"Automatisation déclenchée", ctx),"ok");
    } else if(a.action==="flag"){
      if(ctx?._entity && ctx?._id){
        const arr=DB[ctx._entity]; const it=arr?.find(x=>x.id===ctx._id);
        if(it){ it.flag=a.actionValue||"Prioritaire"; save(); }
      }
    }
  }
  const tpl=(s,ctx)=> (s||"").replace(/\{(\w+)\}/g,(_,k)=> (ctx?.[k]??"").toString());
  return {run,EVENTS,ACTIONS};
})();

/* ============================================================
   5. VUES
   ============================================================ */
const ICONS = {
  dash:'<path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 8h6V4h-6zM4 20h6v-4H4z"/>',
  finder:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  crm:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/>',
  proj:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>',
  people:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  money:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  provider:'<path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3"/>',
  task:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  auto:'<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="3"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  guide:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>'
};
const ic = k => `<svg class="ic" viewBox="0 0 24 24">${ICONS[k]||""}</svg>`;

const NAV = [
  {group:"Pilotage"},
  {id:"dash",   title:"Tableau de bord", sub:"Vue d'ensemble de l'activité", icon:"dash"},
  {id:"finder", title:"Chercheur de contacts", sub:"Emails, téléphones & prospection — 100% hors-ligne", icon:"finder"},
  {group:"Données (comme Airtable)"},
  {id:"partners", title:"T1 · Partenaires & prospection", sub:"CFA, écoles, OPCO, prospects", icon:"crm", entity:"partners"},
  {id:"projects", title:"T2 · Projets & mobilités", sub:"Séjours + conformité R1→R8", icon:"proj", entity:"projects"},
  {id:"participants", title:"T3 · Participants", sub:"Apprenants, documents, assurances", icon:"people", entity:"participants"},
  {id:"finance", title:"T4/T5 · Finances & marges", sub:"Lignes budgétaires + forfaits", icon:"money"},
  {id:"docs", title:"Devis & documents", sub:"Devis, contrats, attestations — imprimables en PDF", icon:"doc"},
  {id:"providers", title:"T6 · Prestataires", sub:"Hôtels, guides, transporteurs", icon:"provider", entity:"providers"},
  {id:"tasks", title:"T7 · Tâches & conformité", sub:"Échéances, rappels, checklist", icon:"task", entity:"tasks"},
  {group:"Système"},
  {id:"automations", title:"Automatisations", sub:"Règles automatiques (remplace Make)", icon:"auto"},
  {id:"guide", title:"Guide & aide", sub:"Comment utiliser chaque écran", icon:"guide"},
  {id:"settings", title:"Réglages & sauvegarde", sub:"Thème, objectifs, export/import", icon:"gear"},
];

let CURRENT="dash";
function renderNav(){
  const counts={ partners:DB.partners.length, projects:DB.projects.length, participants:DB.participants.length,
    providers:DB.providers.length, tasks:DB.tasks.filter(t=>t.status!=="Fait").length };
  $("#nav").innerHTML = NAV.map(n=>{
    if(n.group) return `<div class="nav-group">${esc(n.group)}</div>`;
    const c = n.entity!=null ? counts[n.entity] : null;
    return `<button class="nav-item ${n.id===CURRENT?'active':''}" data-nav="${n.id}">
      ${ic(n.icon)}<span>${esc(n.title.replace(/^T\d[\/\d]* · /,""))}</span>
      ${c? `<span class="badge">${c}</span>`:""}</button>`;
  }).join("");
  $$("#nav [data-nav]").forEach(b=>b.onclick=()=>{ go(b.dataset.nav); $("#sidebar").classList.remove("open"); });
}
function go(id){
  CURRENT=id; const n=NAV.find(x=>x.id===id);
  $("#viewTitle").textContent = n? n.title : "";
  $("#viewSub").textContent = n? n.sub : "";
  renderNav();
  const v=$("#view"); v.classList.remove("view-anim"); void v.offsetWidth; v.classList.add("view-anim");
  (VIEWS[id]||VIEWS.dash)();
}

const VIEWS={};

/* ---------- Assistant : moteur « À faire maintenant » ----------
   Traduit les données en actions concrètes et priorisées. C'est la couche
   que l'Airtable/Make n'avait pas : au lieu de tables à lire, l'outil DIT
   quoi faire. Chaque règle correspond à une friction réelle du process. */
const DAY=864e5;
function nextActions(){
  const now=Date.now(), A=[];
  const add=(pri,icon,title,detail,act)=>A.push({pri,icon,title,detail,act});
  // 1. Prospects à contacter
  DB.partners.filter(p=>["À contacter","Non catégorisée",""].includes(p.status||"")).forEach(p=>
    add(2,"",`Contacter ${p.name}`,`Prospect ${p.type||""} sans premier contact`,{l:"Ouvrir",fn:`openRec('partners','${p.id}')`}));
  // 2. Devis envoyés sans réponse depuis > 7 j -> relancer
  DB.quotes.filter(q=>(q.kind||"devis")==="devis" && q.status==="Envoyé" && (now-(q.date||now))>7*DAY).forEach(q=>
    add(2,"",`Relancer le devis ${q.number}`,`${q.clientName||""} · envoyé il y a ${Math.round((now-q.date)/DAY)} j`,{l:"Relancer",fn:`relanceDevis('${q.id}')`}));
  // 3. Factures en retard
  DB.quotes.filter(q=>q.kind==="facture" && q.status==="Émise" && q.due && q.due<now).forEach(q=>
    add(3,"",`Facture ${q.number} en retard`,`${q.clientName||""} · échéance ${fmtDate(q.due)}`,{l:"Ouvrir",fn:`openQuoteRec('${q.id}')`}));
  // 4. Conventions AVANT départ (R2) — départ proche
  DB.projects.filter(p=>p.start && p.start>now && (p.start-now)<21*DAY && !((p.R||{}).R2)).forEach(p=>
    add(3,"",`Conventions à signer AVANT le départ`,`${p.name} · départ le ${fmtDate(p.start)} — R2 non validé`,{l:"Ouvrir",fn:`openRec('projects','${p.id}')`}));
  // 5. Assurances (R5) — départ dans 6 semaines
  DB.projects.filter(p=>p.start && p.start>now && (p.start-now)<42*DAY && !((p.R||{}).R5)).forEach(p=>
    add(2,"",`Vérifier assurances / CEAM`,`${p.name} · départ le ${fmtDate(p.start)}`,{l:"Ouvrir",fn:`openRec('projects','${p.id}')`}));
  // 6. Dossiers participants incomplets
  DB.participants.filter(p=>["Incomplet","En cours",""].includes(p.status||"")).forEach(p=>
    add(1,"",`Compléter le dossier de ${p.name}`,`Statut : ${p.status||"Incomplet"}`,{l:"Ouvrir",fn:`openRec('participants','${p.id}')`}));
  // 7. Tâches en retard
  DB.tasks.filter(t=>t.status!=="Fait" && t.due && t.due<now).forEach(t=>
    add(3,"⏰",`Tâche en retard : ${t.title}`,`Échéance ${fmtDate(t.due)}`,{l:"Ouvrir",fn:`openRec('tasks','${t.id}')`}));
  // 8. Amorçage si vide
  if(!DB.partners.length) add(1,"","Ajoutez votre premier prospect","Le CRM T1 est vide — commencez la prospection",{l:"Ajouter",fn:`openRec('partners',null)`});
  // 9. Rappel de sauvegarde (protège vos données en cas de désinstallation / changement d'ordinateur)
  const hasData = DB.partners.length||DB.projects.length||DB.participants.length||DB.contacts.length||DB.quotes.length;
  const lb=DB.settings.lastBackup||0;
  if(hasData && (!lb || (now-lb)>7*DAY))
    add(2,"","Exporter une sauvegarde",lb?`Dernière sauvegarde il y a ${Math.round((now-lb)/DAY)} jours — protégez vos données`:"Aucune sauvegarde encore — indispensable pour ne rien perdre",{l:"Sauvegarder",fn:`exportDB()`});
  return A.sort((a,b)=>b.pri-a.pri);
}
window.openRec=(entity,id)=>{ go(entity); if(id||id===null) editEntity(entity,id==="null"?null:id); };
window.openQuoteRec=id=>{ go("docs"); DOCS_KIND="facture"; VIEWS.docs(); editQuote(id); };
window.relanceDevis=id=>{ const q=DB.quotes.find(x=>x.id===id); if(!q)return;
  DB.tasks.unshift({id:uid(),title:`Relancer ${q.clientName||""} — devis ${q.number}`,status:"À faire",priority:"Haute",due:Date.now()+2*DAY,linked:q.number,auto:true});
  logAct(`Relance planifiée : devis ${q.number}`); save(); renderNav(); VIEWS.dash(); toast("Relance ajoutée aux tâches"); };
const priColor=p=>p>=3?"var(--bad)":p>=2?"var(--warn)":"var(--brand)";

/* ---------- Dashboard ---------- */
VIEWS.dash=()=>{
  const acts=nextActions();
  const P=DB.partners, prj=DB.projects, part=DB.participants;
  const marge = DB.budget.reduce((s,b)=>s+(Number(b.margin)||0),0)
    + DB.projects.reduce((s,p)=>s+(Number(p.margin)||0),0);
  const enCours = prj.filter(p=>(p.status||"")!=="Clôturé").length;
  const auth = prj.reduce((s,p)=>{ const r=compliance(p); return s+(r.done<r.total?1:0); },0);
  const overdue = DB.tasks.filter(t=>t.status!=="Fait" && t.due && t.due<Date.now());
  const s=DB.settings;
  const prospects = P.length;
  const funnel = [
    {k:"Prospects", v:prospects},
    {k:"Contactés", v:P.filter(x=>["Contacté","Devis envoyé","Partenaire actif","En discussion"].includes(x.status)).length},
    {k:"En discussion", v:P.filter(x=>x.status==="En discussion").length},
    {k:"Devis envoyé", v:P.filter(x=>x.status==="Devis envoyé").length},
    {k:"Actifs", v:P.filter(x=>x.status==="Partenaire actif").length},
  ];
  const fmax=Math.max(1,...funnel.map(f=>f.v));
  // reverse CA
  const target=Number(s.caTarget)||0, panier=Number(s.panier)||1;
  const nbVentes=Math.ceil(target/panier);
  const nbDevis=Math.ceil(nbVentes/(s.convDevis||.3));
  const nbRdv=Math.ceil(nbDevis/(s.convRdv||.25));
  const nbProspects=Math.ceil(nbRdv/(s.convContact||.35));

  $("#view").innerHTML=`
  <div class="card" style="margin-bottom:18px;border-left:4px solid var(--brand)">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:${acts.length?'14px':'0'}">
      <div class="section-title" style="margin:0">À faire maintenant</div>
      <span class="tag ${acts.length?'b':'g'}">${acts.length||"0"} action${acts.length>1?'s':''}</span>
      <div class="spacer"></div><span class="muted" style="font-size:12px;font-weight:600">Mis à jour en direct depuis vos données</span>
    </div>
    ${acts.length? acts.slice(0,8).map(a=>`<div class="result-row" style="border-color:var(--line)">
      <span class="meter-dot" style="background:${priColor(a.pri)};width:10px;height:10px"></span>
      <div style="flex:1;min-width:0"><div class="cell-strong">${esc(a.title)}</div><div class="muted" style="font-size:12.5px">${esc(a.detail)}</div></div>
      <button class="btn sm primary" data-call="${a.act.fn}">${esc(a.act.l)}</button></div>`).join("")
      + (acts.length>8?`<div class="muted" style="font-size:12px;font-weight:600;margin-top:8px">+ ${acts.length-8} autre(s) action(s)…</div>`:"")
      : `<div class="muted" style="font-weight:600">Tout est à jour — aucune action urgente. Continuez la prospection ou préparez vos prochains séjours.</div>`}
  </div>
  <div class="grid cards">
    ${kpi("Marge totale", eur(marge), "money", "var(--ok)")}
    ${kpi("Projets en cours", enCours, "proj", "var(--brand)")}
    ${kpi("Autorisations à obtenir", auth, "task", "var(--warn)")}
    ${kpi("Participants", part.length, "people", "var(--accent)")}
    ${kpi("Prospects (T1)", prospects, "crm", "var(--brand)")}
    ${kpi("Tâches en retard", overdue.length, "task", overdue.length?"var(--bad)":"var(--ok)")}
  </div>

  <div class="grid" style="grid-template-columns:1.3fr 1fr;margin-top:16px">
    <div class="card">
      <div class="section-title" style="margin-top:0">Entonnoir de prospection</div>
      ${funnel.map(f=>`<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:5px"><span>${f.k}</span><span>${f.v}</span></div>
        <div class="progress"><i style="width:${(f.v/fmax*100).toFixed(0)}%"></i></div>
      </div>`).join("")}
    </div>
    <div class="card">
      <div class="section-title" style="margin-top:0">Objectif → prospection (calcul inverse)</div>
      <p class="muted" style="margin:0 0 12px;font-weight:600">Pour atteindre <b style="color:var(--ink)">${eur(target)}</b> à ${eur(panier)}/vente :</p>
      ${revLine("Ventes nécessaires", nbVentes)}
      ${revLine("Devis à envoyer", nbDevis)}
      ${revLine("Rendez-vous à obtenir", nbRdv)}
      ${revLine("Prospects à contacter", nbProspects)}
      <button class="btn sm ghost" style="margin-top:10px" data-call="go('settings')">Modifier les hypothèses →</button>
    </div>
  </div>

  <div class="section-title">Activité récente</div>
  <div class="card">
    ${DB.activity.length? DB.activity.slice(0,10).map(a=>`<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--line)">
      <span class="muted mono" style="font-size:12px;white-space:nowrap">${fmtDate(a.t)}</span><span style="font-weight:600">${esc(a.m)}</span></div>`).join("")
      : `<div class="empty"><svg viewBox="0 0 24 24"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg><div>Aucune activité pour l'instant. Commencez par ajouter un prospect ou chercher un contact.</div></div>`}
  </div>`;
};
const kpi=(lab,val,icon,color)=>`<div class="card hover kpi">
  <div class="lab"><span class="dot" style="background:${color}"></span>${esc(lab)}</div>
  <div class="val">${val}</div></div>`;
const revLine=(l,v)=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)"><span class="muted" style="font-weight:600">${l}</span><b style="font-size:16px">${v.toLocaleString("fr-FR")}</b></div>`;

/* ---------- Chercheur de contacts (module phare) ---------- */
let FINDER_TAB="scrape";
let SCRAPE_MODE="tab";
let SCRAPE_ROWS=[];
function finderScrape(){
  if(!IS_EXT){
    $("#finderBody").innerHTML=`
    <div class="helpbox">${ic2("info")}<div><b>Le scraping direct (LinkedIn & web) nécessite d'installer l'outil comme extension Chrome</b> (5 minutes, gratuit, une seule fois). Voir l'onglet « Guide & aide » → « Installer l'extension ». En attendant, deux solutions fonctionnent tout de suite ci-dessous.</div></div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px;align-items:start">
      <div class="card"><div class="section-title" style="margin-top:0">Solution 1 — Bookmarklet « sur toute page »</div>
        <p class="muted" style="font-weight:600;margin-top:0">Glissez ce bouton dans votre barre de favoris, puis cliquez-le sur n'importe quel site (LinkedIn, annuaire, Google…) pour récupérer emails et téléphones de la page.</p>
        <a class="btn accent" id="sc_bm" href="#" draggable="true" style="text-decoration:none">Extracteur de contacts</a></div>
      <div class="card"><div class="section-title" style="margin-top:0">Solution 2 — Coller le contenu</div>
        <p class="muted" style="font-weight:600;margin-top:0">Sélectionnez tout sur une page (Ctrl+A, Ctrl+C) et collez dans l'onglet « Extraire d'une page ».</p>
        <button class="btn" data-call="finderGoto('extract')">Ouvrir « Extraire d'une page »</button></div>
    </div>`;
    $("#sc_bm").href=BOOKMARKLET;
    $("#sc_bm").onclick=e=>{e.preventDefault();toast("Glissez ce bouton dans votre barre de favoris.","warn");};
    return;
  }
  $("#finderBody").innerHTML=`
  <div class="pill-tabs" style="margin-bottom:16px">
    <button data-sm="tab" class="${SCRAPE_MODE==='tab'?'active':''}">Onglet actif (LinkedIn / site)</button>
    <button data-sm="web" class="${SCRAPE_MODE==='web'?'active':''}">Recherche web multi-pages</button>
  </div><div id="scBody"></div>`;
  $$("#finderBody [data-sm]").forEach(b=>b.onclick=()=>{SCRAPE_MODE=b.dataset.sm;finderScrape();});
  (SCRAPE_MODE==="tab"?scrapeTabUI:scrapeWebUI)();
}
async function scrapeTabUI(){
  $("#scBody").innerHTML=`<div class="card"><div style="display:flex;align-items:center"><div class="section-title" style="margin:0">Vos onglets ouverts</div><div class="spacer"></div><button class="btn sm ghost" id="sc_refresh">Rafraîchir</button></div>
    <p class="muted" style="font-weight:600">Ouvrez un profil LinkedIn (ou tout site/annuaire) dans un onglet, puis cliquez « Scraper » ici. Les emails, téléphones et le nom sont extraits.</p>
    <div id="sc_tabs" class="muted">Chargement…</div></div><div id="sc_out" style="margin-top:16px"></div>`;
  $("#sc_refresh").onclick=scrapeTabUI;
  let tabs=[]; try{ tabs=await Scraper.listTabs(); }catch(e){}
  $("#sc_tabs").innerHTML= tabs.length? tabs.map(t=>`<div class="result-row">
    <div style="flex:1;min-width:0"><div class="cell-strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title||t.url)}</div>
    <div class="muted" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.url)}</div></div>
    <button class="btn sm primary" data-tab="${t.id}">Scraper</button></div>`).join("")
    : `<div class="empty">Aucun onglet web ouvert. Ouvrez une page dans un autre onglet, puis « Rafraîchir ».</div>`;
  $$("#sc_tabs [data-tab]").forEach(b=>b.onclick=async()=>{ b.textContent="…";
    const res=await Scraper.scrapeTab(+b.dataset.tab); b.textContent="Scraper";
    if(!res){ toast("Impossible de lire cet onglet","bad"); return; }
    const out=[], seen=new Set(); Scraper.mergeContacts(out,seen,res);
    SCRAPE_ROWS=out; renderScrapeResults($("#sc_out"), res); });
}
function renderScrapeResults(container,res){
  const rows=[], seen=new Set(); Scraper.mergeContacts(rows,seen,res); SCRAPE_ROWS=rows;
  container.innerHTML=`<div class="card">
    <div class="grid cards" style="margin-bottom:12px">
      ${kpi("Emails",(res.emails||[]).length,"finder","var(--brand)")}
      ${kpi("Téléphones",(res.phones||[]).length,"finder","var(--accent)")}
      ${kpi("Contacts",rows.length,"finder","var(--ok)")}</div>
    ${res.name?`<p style="font-weight:700;margin:0 0 8px">${esc(res.name)}${res.headline?` — <span class="muted">${esc(res.headline)}</span>`:""}</p>`:""}
    ${rows.length?scrapeTable(rows):`<div class="empty">Aucun email/téléphone exploitable sur cette page.</div>`}
    ${(res.phones||[]).length?`<div class="divider"></div><div class="muted" style="font-weight:700;font-size:11px;text-transform:uppercase;margin-bottom:6px">Téléphones détectés</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${res.phones.map(p=>`<span class="tag b copybtn" data-call="copy('${p.replace(/'/g,"")}')">${esc(p)}</span>`).join("")}</div>`:""}
  </div>`;
  wireScrapeTable(container);
}
function scrapeTable(rows){
  return `<div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn sm primary" id="scr_import">Ajouter tout au CRM (${rows.length})</button>
    <button class="btn sm ghost" id="scr_csv">Exporter CSV</button></div>
  <div class="tbl-wrap"><table><thead><tr><th>Email</th><th>Nom</th><th>Téléphone</th><th>Société / domaine</th><th>Service</th></tr></thead>
  <tbody>${rows.map(r=>`<tr><td class="mono cell-strong">${esc(r.email||"—")}</td><td>${esc(r.name||"—")}</td>
    <td>${esc(r.phone||"—")}</td><td class="muted">${esc(r.company||"—")}</td><td class="muted">${esc((r.service||"").slice(0,40))}</td></tr>`).join("")}</tbody></table></div>`;
}
function wireScrapeTable(container){
  const imp=$("#scr_import",container), csv=$("#scr_csv",container);
  imp&&(imp.onclick=()=>importScraped(SCRAPE_ROWS));
  csv&&(csv.onclick=()=>exportCSV("scraping",["email","name","phone","company","service","source"],SCRAPE_ROWS));
}
function importScraped(rows){
  let n=0; for(const r of rows){ const key=r.email||("tel:"+r.phone);
    if(!key||key==="tel:") continue;
    if(DB.contacts.some(c=>(r.email&&c.email===r.email)||(!r.email&&r.phone&&c.phone===r.phone))) continue;
    DB.contacts.unshift({id:uid(),email:r.email||"",name:r.name||"",domain:r.company||"",phone:r.phone||"",
      service:r.service||"",sourceUrl:r.source||"",confidence:"",source:"scraper",added:Date.now(),tags:[]}); n++; }
  logAct(`${n} contacts importés (scraper)`); save(); renderNav(); toast(n+" contact(s) ajouté(s) au CRM");
}
async function scrapeWebUI(){
  $("#scBody").innerHTML=`
  <div class="helpbox">${ic2("info")}<div>Tapez une recherche, choisissez le nombre de pages et lancez : l'outil ouvre les résultats, visite les sites et récupère <b>emails, téléphones, noms</b> automatiquement. Tout reste en local.</div></div>
  <div class="card">
    <div class="row2"><div class="field"><label>Recherche (ex : « CFA coiffure Occitanie »)</label><input class="input" id="sw_q" placeholder="Votre requête"></div>
      <div class="field"><label>Moteur</label><select id="sw_eng"><option value="google">Google</option><option value="duckduckgo">DuckDuckGo (plus permissif)</option></select></div></div>
    <div class="row3">
      <div class="field"><label>Pages de résultats</label><input class="input" type="number" id="sw_pages" value="2" min="1" max="10"></div>
      <div class="field"><label>Sites à visiter / page</label><input class="input" type="number" id="sw_per" value="5" min="0" max="15"></div>
      <div class="field"><label>Visiter les sites ?</label><select id="sw_visit"><option value="1">Oui (recommandé)</option><option value="0">Non (SERP seulement)</option></select></div>
    </div>
    <button class="btn primary" id="sw_go" style="width:100%">Lancer le run</button>
    <div id="sw_prog" class="muted" style="font-weight:600;margin-top:12px"></div>
  </div>
  <div id="sw_out" style="margin-top:16px"></div>`;
  $("#sw_go").onclick=async()=>{
    const q=$("#sw_q").value.trim(); if(!q){toast("Entrez une recherche","warn");return;}
    const opts={engine:$("#sw_eng").value,query:q,pages:Math.max(1,+$("#sw_pages").value||1),perPage:+$("#sw_per").value||0,visit:$("#sw_visit").value==="1"};
    const go=$("#sw_go"); go.disabled=true; go.textContent="Run en cours…";
    const prog=$("#sw_prog");
    try{
      const rows=await Scraper.crawl(opts,msg=>prog.textContent=msg);
      SCRAPE_ROWS=rows; prog.textContent=`Terminé — ${rows.length} contact(s) trouvé(s).`;
      $("#sw_out").innerHTML= rows.length?`<div class="card">${scrapeTable(rows)}</div>`:`<div class="card"><div class="empty">Aucun contact trouvé. Essayez plus de pages, ou activez « Visiter les sites », ou changez de moteur.</div></div>`;
      wireScrapeTable($("#sw_out"));
    }catch(e){ prog.textContent="Erreur : "+e.message; }
    go.disabled=false; go.textContent="Lancer le run";
  };
}
VIEWS.finder=()=>{
  $("#view").innerHTML=`
  <div class="helpbox">${ic2("info")}
    <div>Ce module reproduit hors-ligne le cœur des extensions type Skrapp / Hunter / Snov : il <b>devine les emails</b> à partir d'un nom + domaine, <b>extrait tous les contacts</b> d'une page collée (emails, téléphones, réseaux), <b>apprend un modèle</b> d'email et <b>vérifie</b> la validité. Aucune donnée ne quitte votre navigateur — il n'y a pas d'envoi réseau, donc pas de coût, pas de blocage, pas de dépendance.</div></div>
  <div class="pill-tabs" style="margin-bottom:18px;flex-wrap:wrap">
    ${[["scrape","Scraper LinkedIn / Web"],["find","Deviner par nom"],["domain","Par domaine"],["bulk","En masse"],["extract","Extraire d'une page"],["profile","Profil / LinkedIn"],["learn","Modèle"],["verify","Vérifier"],["saved","Contacts ("+DB.contacts.length+")"]]
      .map(([k,l])=>`<button data-ft="${k}" class="${FINDER_TAB===k?'active':''}">${esc(l)}</button>`).join("")}
  </div>
  <div id="finderBody"></div>`;
  $$("#view [data-ft]").forEach(b=>b.onclick=()=>{FINDER_TAB=b.dataset.ft;VIEWS.finder();});
  ({scrape:finderScrape,find:finderFind,domain:finderDomain,bulk:finderBulk,extract:finderExtract,profile:finderProfile,learn:finderLearn,verify:finderVerify,saved:finderSaved}[FINDER_TAB]||finderScrape)();
};
const ic2=k=>`<svg viewBox="0 0 24 24" ${''}><g fill="none" stroke="currentColor" stroke-width="2">${k==="info"?'<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>':ICONS[k]||""}</g></svg>`;

function finderFind(){
  $("#finderBody").innerHTML=`
  <div class="grid" style="grid-template-columns:1fr 1.2fr;gap:20px;align-items:start">
    <div class="card">
      <div class="row2"><div class="field"><label>Prénom</label><input class="input" id="ff_first" placeholder="Marie"></div>
      <div class="field"><label>Nom</label><input class="input" id="ff_last" placeholder="Dupont"></div></div>
      <div class="field"><label>Domaine de l'entreprise</label><input class="input" id="ff_domain" placeholder="entreprise.fr"></div>
      <button class="btn primary" id="ff_go" style="width:100%">Générer les emails probables</button>
      <p class="muted" style="font-size:12px;margin:12px 0 0;font-weight:600">Astuce : le domaine se trouve dans l'adresse du site web du partenaire (ex. formaskills.fr).</p>
    </div>
    <div id="ff_res"></div>
  </div>`;
  const run=()=>{
    const f=$("#ff_first").value.trim(),l=$("#ff_last").value.trim(),d=$("#ff_domain").value.trim();
    if(!f||!l||!d){ toast("Renseignez prénom, nom et domaine","warn"); return; }
    const cand=EmailFinder.candidates(f,l,d);
    $("#ff_res").innerHTML=`<div class="card"><div class="section-title" style="margin-top:0">${cand.length} adresses classées par probabilité</div>
    ${cand.map(c=>`<div class="result-row">
      <div style="flex:1;min-width:0"><div class="mono cell-strong" style="word-break:break-all">${esc(c.email)}</div>
        <div class="muted" style="font-size:12px">modèle <code class="k">${esc(c.patternLabel)}</code></div></div>
      ${scoreBar(c.confidence)}
      <button class="btn sm ghost" data-call="copy('${c.email}')">Copier</button>
      <button class="btn sm" data-act="saveContact" data-email="${esc(c.email)}" data-name="${esc(f+' '+l)}" data-domain="${esc(d)}" data-conf="${c.confidence}">+ CRM</button>
    </div>`).join("")}
    <p class="muted" style="font-size:12px;margin:12px 0 0;font-weight:600"> Ce sont des <b>probabilités</b> (aucune vérification serveur n'est possible hors-ligne). Confirmez la meilleure par un envoi test ou l'onglet « Apprendre un modèle » si vous connaissez déjà un email de la boîte.</p></div>`;
  };
  $("#ff_go").onclick=run;
  $$("#ff_first,#ff_last,#ff_domain").forEach(i=>i.addEventListener("keydown",e=>{if(e.key==="Enter")run();}));
}
function finderDomain(){
  $("#finderBody").innerHTML=`
  <div class="card" style="max-width:560px">
    <div class="field"><label>Domaine de l'entreprise</label><input class="input" id="fd_dom" placeholder="entreprise.fr"></div>
    <button class="btn primary" id="fd_go" style="width:100%">Lister les adresses probables du domaine</button>
    <p class="muted" style="font-size:12px;margin:12px 0 0;font-weight:600">Comme le « Domain Search » de Hunter : génère les adresses de service courantes (contact@, sales@, rh@…), par département. Idéal quand vous n'avez pas de nom précis.</p>
  </div>
  <div id="fd_res" style="margin-top:16px"></div>`;
  const run=()=>{
    const r=EmailFinder.domainSearch($("#fd_dom").value);
    if(!r){toast("Renseignez un domaine","warn");return;}
    const byDept={}; r.roles.forEach(x=>{(byDept[x.dept]=byDept[x.dept]||[]).push(x);});
    window.__lastDomain=r.roles.map(x=>({email:x.email,guessName:"",domain:r.domain}));
    $("#fd_res").innerHTML=`<div class="card"><div style="display:flex;align-items:center;margin-bottom:8px"><div class="section-title" style="margin:0">Adresses probables · ${esc(r.domain)}</div><div class="spacer"></div>
      <button class="btn sm" data-call="importLastDomain()">Tout ajouter</button></div>
    ${Object.entries(byDept).map(([dept,list])=>`<div style="margin-bottom:6px"><div class="muted" style="font-weight:800;font-size:11px;text-transform:uppercase;margin:10px 0 6px">${esc(dept)}</div>
      ${list.map(x=>`<div class="result-row"><div class="mono cell-strong" style="flex:1">${esc(x.email)}</div><span class="tag w">générique</span>
        <button class="btn sm ghost" data-call="copy('${x.email}')">Copier</button>
        <button class="btn sm" data-act="saveContact" data-email="${esc(x.email)}" data-domain="${esc(r.domain)}" data-conf="48">+</button></div>`).join("")}</div>`).join("")}
    <p class="muted" style="font-size:12px;margin:12px 0 0;font-weight:600">Ce sont des adresses de service typiques — toutes n'existent pas forcément. Pour une personne précise, utilisez « Par nom » ou « Modèle ».</p></div>`;
  };
  $("#fd_go").onclick=run; $("#fd_dom").addEventListener("keydown",e=>{if(e.key==="Enter")run();});
}

let BULK_RESULT=[];
function finderBulk(){
  $("#finderBody").innerHTML=`
  <div class="helpbox">${ic2("info")}<div>Collez une liste (une personne par ligne, séparée par virgule ou tabulation) : <code class="k">Prénom, Nom, domaine.fr</code>. L'outil génère le meilleur email pour chacun, puis exporte en CSV. Vous pouvez coller directement depuis un tableur.</div></div>
  <div class="card">
    <div class="field"><label>Liste (Prénom, Nom, Domaine — une par ligne)</label>
    <textarea id="fb_in" style="min-height:150px" placeholder="Marie, Dupont, entreprise.fr&#10;Jean, Martin, boite.com&#10;Sofia, Rossi, azienda.it"></textarea></div>
    <div class="toolbar" style="margin:0"><button class="btn primary" id="fb_go">Générer les emails</button>
    <button class="btn ghost" id="fb_ex" disabled>Exporter CSV</button>
    <button class="btn ghost" id="fb_save" disabled>Tout ajouter au CRM</button></div>
  </div>
  <div id="fb_res" style="margin-top:16px"></div>`;
  $("#fb_go").onclick=()=>{
    const rows=$("#fb_in").value.split("\n").map(l=>l.trim()).filter(Boolean).map(l=>{
      const p=l.split(/[,\t;]+/).map(s=>s.trim()); return {first:p[0]||"",last:p[1]||"",domain:p[2]||""};
    }).filter(r=>r.first&&r.last&&r.domain);
    if(!rows.length){toast("Format attendu : Prénom, Nom, Domaine","warn");return;}
    BULK_RESULT=EmailFinder.bulkFind(rows);
    $("#fb_ex").disabled=false; $("#fb_save").disabled=false;
    $("#fb_res").innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>Prénom</th><th>Nom</th><th>Email probable</th><th>Confiance</th><th>Alternatives</th></tr></thead>
    <tbody>${BULK_RESULT.map(r=>`<tr><td>${esc(r.first)}</td><td>${esc(r.last)}</td>
      <td class="mono cell-strong">${esc(r.email)}</td><td>${scoreBar(r.confidence)}</td>
      <td class="muted mono" style="font-size:12px">${esc(r.alt)}</td></tr>`).join("")}</tbody></table></div>`;
    toast(BULK_RESULT.length+" emails générés");
  };
  $("#fb_ex").onclick=()=>exportCSV("emails-en-masse",["first","last","domain","email","confidence","alt"],BULK_RESULT);
  $("#fb_save").onclick=()=>importAllContacts(BULK_RESULT.filter(r=>r.email).map(r=>({email:r.email,guessName:r.first+" "+r.last,domain:r.domain})));
}

function finderProfile(){
  $("#finderBody").innerHTML=`
  <div class="helpbox">${ic2("info")}<div>Équivalent hors-ligne d'un « scraper de profil » : collez le texte d'un profil LinkedIn (ou d'une fiche/annuaire) et l'outil en extrait le nom, le poste, la société, l'email et le téléphone — puis devine l'email pro si absent.</div></div>
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px;align-items:start">
    <div class="card"><div class="field"><label>Texte du profil</label>
      <textarea id="fp_in" style="min-height:220px" placeholder="Collez ici le contenu d'un profil (Ctrl+A, Ctrl+C sur la page, puis collez)."></textarea></div>
      <button class="btn primary" id="fp_go" style="width:100%">Analyser</button></div>
    <div id="fp_res"></div>
  </div>`;
  $("#fp_go").onclick=()=>{
    const p=EmailFinder.parseProfile($("#fp_in").value);
    if(!p.name && !p.email){toast("Aucune donnée reconnue dans ce texte","warn");return;}
    const guess = (!p.email && p.first && p.last && p.company) ? EmailFinder.candidates(p.first,p.last,EmailFinder.cleanDomain(p.company)+".com") : [];
    $("#fp_res").innerHTML=`<div class="card">
      ${row("Nom",p.name||"—")}${row("Poste",p.title||"—")}${row("Société",p.company||"—")}
      ${row("Email",p.email?`<span class="mono">${esc(p.email)}</span>`:'<span class="muted">non trouvé</span>')}
      ${row("Téléphone",p.phone||'<span class="muted">non trouvé</span>')}
      ${p.email?`<button class="btn sm" style="margin-top:10px" data-act="saveContact" data-email="${esc(p.email)}" data-name="${esc(p.name)}" data-domain="${esc((p.email.split('@')[1]||''))}" data-conf="85">+ Ajouter au CRM</button>`:''}
      ${(!p.email&&guess.length)?`<div class="divider"></div><div class="muted" style="font-size:12px;font-weight:700;margin-bottom:6px">Email probable (deviné) :</div>
        <div class="result-row"><div class="mono cell-strong" style="flex:1">${esc(guess[0].email)}</div>${scoreBar(guess[0].confidence)}<button class="btn sm ghost" data-call="copy('${guess[0].email}')">Copier</button></div>
        <p class="muted" style="font-size:11px;margin:6px 0 0">Domaine deviné depuis le nom de société — vérifiez le vrai domaine du site.</p>`:''}
    </div>`;
  };
}
const row=(l,v)=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line)"><span class="muted" style="font-weight:700">${l}</span><span style="text-align:right">${v}</span></div>`;

const scoreBar=c=>{
  const col=c>=75?"var(--ok)":c>=55?"var(--warn)":"var(--bad)";
  return `<span class="scorebar"><span class="track"><i style="width:${c}%;background:${col}"></i></span><b style="color:${col};font-size:13px">${c}%</b></span>`;
};
window.saveContact=(email,name,domain,conf)=>{
  if(DB.contacts.some(c=>c.email===email)){ toast("Déjà dans les contacts","warn"); return; }
  DB.contacts.unshift({id:uid(),email,name,domain,confidence:conf||"",source:"finder",added:Date.now(),phone:"",note:""});
  logAct(`Contact ajouté : ${email}`); save(); renderNav(); toast("Contact enregistré");
};

function finderExtract(){
  $("#finderBody").innerHTML=`
  <div class="card">
    <div class="field"><label>Collez ici le contenu d'une page (résultats de recherche, annuaire, page contact, liste de sociétés…)</label>
    <textarea id="fx_in" style="min-height:180px" placeholder="Sélectionnez tout le texte d'une page web (Ctrl+A, Ctrl+C) puis collez-le ici. L'outil extraira automatiquement tous les emails, téléphones, sites et réseaux sociaux — site par site, sans LinkedIn requis."></textarea></div>
    <div class="toolbar" style="margin:0"><button class="btn primary" id="fx_go">Extraire les contacts</button>
    <button class="btn ghost" id="fx_clear">Effacer</button></div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="section-title" style="margin-top:0">Bonus : outil « sur toute page » (comme une extension, sans en installer)</div>
    <p class="muted" style="font-weight:600;margin-top:0">Glissez ce bouton dans votre barre de favoris. Ensuite, sur <b>n'importe quel site</b> (annuaire, résultats de recherche…), cliquez-le : il récupère tous les emails et téléphones de la page — y compris les liens masqués — dans une fenêtre. 100% local, aucun envoi.</p>
    <a class="btn accent" id="fx_bm" href="#" draggable="true" style="text-decoration:none">Extracteur de contacts</a>
    <button class="btn ghost sm" id="fx_bmcopy" style="margin-left:8px">Copier le code</button>
  </div>
  <div id="fx_res" style="margin-top:16px"></div>`;
  $("#fx_bm").href=BOOKMARKLET;
  $("#fx_bm").onclick=e=>{e.preventDefault();toast("Glissez ce bouton dans votre barre de favoris pour l'utiliser sur d'autres sites.","warn");};
  $("#fx_bmcopy").onclick=()=>copy(BOOKMARKLET);
  $("#fx_clear").onclick=()=>{$("#fx_in").value="";$("#fx_res").innerHTML="";};
  $("#fx_go").onclick=()=>{
    const r=EmailFinder.extract($("#fx_in").value);
    if(!r.emails.length && !r.phones.length){ $("#fx_res").innerHTML=`<div class="card"><div class="empty">Aucun email ni téléphone trouvé dans ce texte.</div></div>`; return; }
    window.__lastExtract=r.contacts;
    $("#fx_res").innerHTML=`
    <div class="grid cards" style="margin-bottom:16px">
      ${kpi("Emails",r.emails.length,"finder","var(--brand)")}
      ${kpi("Téléphones",r.phones.length,"finder","var(--accent)")}
      ${kpi("Sites",r.sites.length,"finder","var(--ok)")}
      ${kpi("Réseaux",r.socials.length,"finder","var(--warn)")}
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><div class="section-title" style="margin:0">Contacts extraits</div><div class="spacer"></div>
      <button class="btn sm" data-call="importLastExtract()">Tout ajouter au CRM</button></div>
      ${r.contacts.map(c=>`<div class="result-row">
        <div style="flex:1;min-width:0"><div class="mono cell-strong" style="word-break:break-all">${esc(c.email)}</div>
        <div class="muted" style="font-size:12px">${c.guessName?esc(c.guessName)+" · ":""}${esc(c.domain)}</div></div>
        <span class="tag ${c.type==='nominatif'?'g':c.type==='générique'?'w':'n'}">${c.type}</span>
        ${c.disposable?'<span class="tag r">jetable</span>':''}
        <button class="btn sm ghost" data-call="copy('${c.email}')">Copier</button>
        <button class="btn sm" data-act="saveContact" data-email="${esc(c.email)}" data-name="${esc(c.guessName)}" data-domain="${esc(c.domain)}" data-conf="70">+</button>
      </div>`).join("")}
      ${r.phones.length?`<div class="divider"></div><div class="section-title" style="margin-top:0">Téléphones</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${r.phones.map(p=>`<span class="tag b copybtn" data-call="copy('${p.replace(/'/g,"")}')">${esc(p)}</span>`).join("")}</div>`:""}
      ${r.sites.length?`<div class="divider"></div><div class="section-title" style="margin-top:0">Sites</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${r.sites.slice(0,40).map(u=>`<a class="tag n" href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//,'').slice(0,42))}</a>`).join("")}</div>`:""}
    </div>`;
  };
}
window.importAllContacts=(list)=>{
  let n=0; for(const c of list){ if(!DB.contacts.some(x=>x.email===c.email)){ DB.contacts.unshift({id:uid(),email:c.email,name:c.guessName||"",domain:c.domain,confidence:70,source:"extract",added:Date.now(),phone:"",note:""}); n++; } }
  logAct(`${n} contacts importés (extraction)`); save(); renderNav(); toast(n+" contacts ajoutés au CRM");
};

function finderLearn(){
  $("#finderBody").innerHTML=`
  <div class="helpbox">${ic2("info")}<div>Si vous connaissez <b>un seul</b> email d'une entreprise, l'outil devine le modèle utilisé, puis génère les adresses de <b>toutes les autres personnes</b> de la même boîte — de façon fiable.</div></div>
  <div class="card">
    <div class="section-title" style="margin-top:0">1. Renseignez un contact connu</div>
    <div class="row3">
      <div class="field"><label>Prénom connu</label><input class="input" id="fl_f" placeholder="Jean"></div>
      <div class="field"><label>Nom connu</label><input class="input" id="fl_l" placeholder="Martin"></div>
      <div class="field"><label>Son email connu</label><input class="input" id="fl_e" placeholder="j.martin@boite.fr"></div>
    </div>
    <button class="btn primary" id="fl_detect">Détecter le modèle</button>
    <div id="fl_out" style="margin-top:14px"></div>
  </div>`;
  $("#fl_detect").onclick=()=>{
    const f=$("#fl_f").value.trim(),l=$("#fl_l").value.trim(),e=$("#fl_e").value.trim();
    if(!f||!l||!e){toast("Renseignez les trois champs","warn");return;}
    const learned=EmailFinder.learnPattern(f,l,e);
    if(!learned){toast("Email invalide","bad");return;}
    if(!learned.template){
      $("#fl_out").innerHTML=`<div class="tag w">Modèle non reconnu pour ${esc(e)} — utilisez plutôt l'onglet « Deviner ».</div>`;return;
    }
    $("#fl_out").innerHTML=`<div class="tag g" style="margin-bottom:14px">Modèle détecté : <code class="k" style="margin-left:6px">${esc(learned.patternLabel)}</code> @ ${esc(learned.domain)}</div>
    <div class="section-title" style="margin-top:0">2. Appliquez à d'autres personnes</div>
    <div class="row2"><div class="field"><label>Prénom</label><input class="input" id="fl_nf" placeholder="Sophie"></div>
    <div class="field"><label>Nom</label><input class="input" id="fl_nl" placeholder="Bernard"></div></div>
    <button class="btn accent" id="fl_apply">Générer l'email</button>
    <div id="fl_applied" style="margin-top:12px"></div>`;
    const learnedRef=learned;
    $("#fl_apply").onclick=()=>{
      const nf=$("#fl_nf").value.trim(),nl=$("#fl_nl").value.trim();
      if(!nf||!nl){toast("Prénom + nom requis","warn");return;}
      const em=EmailFinder.applyLearned(learnedRef,nf,nl);
      $("#fl_applied").innerHTML=`<div class="result-row"><div class="mono cell-strong" style="flex:1">${esc(em)}</div>
        ${scoreBar(92)}<button class="btn sm ghost" data-call="copy('${em}')">Copier</button>
        <button class="btn sm" data-act="saveContact" data-email="${esc(em)}" data-name="${esc(nf+' '+nl)}" data-domain="${esc(learnedRef.domain)}" data-conf="92">+ CRM</button></div>`;
    };
  };
}

function finderVerify(){
  $("#finderBody").innerHTML=`
  <div class="card">
    <div class="field"><label>Une ou plusieurs adresses (une par ligne)</label>
    <textarea id="fv_in" placeholder="marie.dupont@entreprise.fr&#10;contact@boite.com&#10;test@mailinator.com"></textarea></div>
    <button class="btn primary" id="fv_go">Vérifier</button>
  </div><div id="fv_res" style="margin-top:16px"></div>`;
  $("#fv_go").onclick=()=>{
    const list=$("#fv_in").value.split(/[\n,;]+/).map(s=>s.trim()).filter(Boolean);
    if(!list.length){toast("Ajoutez au moins une adresse","warn");return;}
    const cols={invalide:"r",jetable:"r",générique:"w",perso:"w",probable:"g"};
    $("#fv_res").innerHTML=`<div class="card">${list.map(e=>{const v=EmailFinder.verify(e);
      return `<div class="result-row"><div class="mono cell-strong" style="flex:1;word-break:break-all">${esc(e)}</div>
      <span class="tag ${cols[v.status]||'n'}">${v.status}</span>
      <span class="muted" style="font-size:12px;min-width:180px;text-align:right">${esc(v.reason)}</span></div>`;}).join("")}
      <p class="muted" style="font-size:12px;margin:12px 0 0;font-weight:600">Vérification hors-ligne = syntaxe + heuristiques (jetable, générique, format pro). La confirmation « boîte réelle » nécessiterait un serveur — évitée volontairement pour rester 100% autonome et gratuit.</p></div>`;
  };
}

let CS_TAG="";
function finderSaved(){
  const list=DB.contacts;
  const tags=[...new Set(list.flatMap(c=>c.tags||[]))];
  $("#finderBody").innerHTML=`
  <div class="toolbar">
    <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input class="input" id="cs_q" placeholder="Rechercher un contact…"></div>
    ${tags.length?`<select id="cs_tag" class="input" style="max-width:180px"><option value="">Toutes les listes</option>${tags.map(t=>`<option ${CS_TAG===t?'selected':''}>${esc(t)}</option>`).join("")}</select>`:""}
    <div class="spacer"></div>
    <button class="btn ghost sm" id="cs_imp">Importer CSV</button>
    <input type="file" id="cs_file" accept=".csv,text/csv" style="display:none">
    <button class="btn ghost sm" id="cs_dedupe">Dédupliquer</button>
    <button class="btn ghost sm" id="cs_exp">Exporter CSV</button>
  </div>
  <div id="cs_tbl"></div>`;
  const draw=()=>{
    const q=($("#cs_q").value||"").toLowerCase();
    const rows=list.filter(c=>(!q||(c.email+(c.name||"")+(c.domain||"")).toLowerCase().includes(q))&&(!CS_TAG||(c.tags||[]).includes(CS_TAG)));
    $("#cs_tbl").innerHTML= rows.length?`<div class="tbl-wrap"><table>
      <thead><tr><th>Email</th><th>Nom</th><th>Domaine</th><th>Listes</th><th>Source</th><th></th></tr></thead>
      <tbody>${rows.map(c=>`<tr>
        <td class="mono cell-strong">${esc(c.email)}</td><td>${esc(c.name||"—")}</td>
        <td class="muted">${esc(c.domain||"—")}</td>
        <td>${(c.tags||[]).map(t=>`<span class="tag a" style="margin:1px">${esc(t)}</span>`).join("")||'<span class="muted">—</span>'}</td>
        <td><span class="tag n">${esc(c.source||"—")}</span></td>
        <td class="rowact"><button class="btn sm ghost" data-call="tagContact('${c.id}')">Liste</button>
        <button class="btn sm ghost" data-call="copy('${c.email}')">Copier</button>
        <button class="btn sm ghost" data-call="delContact('${c.id}')">✕</button></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="card"><div class="empty"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><div>Aucun contact. Utilisez les onglets de recherche ou importez un CSV.</div></div></div>`;
  };
  $("#cs_q").oninput=draw;
  $("#cs_tag")&&($("#cs_tag").onchange=e=>{CS_TAG=e.target.value;draw();});
  $("#cs_exp").onclick=()=>exportCSV("contacts",["email","name","domain","phone","confidence","source","tags"],list.map(c=>({...c,tags:(c.tags||[]).join(" ")})));
  $("#cs_imp").onclick=()=>$("#cs_file").click();
  $("#cs_file").onchange=importContactsCSV;
  $("#cs_dedupe").onclick=()=>{const before=list.length;DB.contacts=EmailFinder.dedupe(list);const n=before-DB.contacts.length;save();renderNav();VIEWS.finder();toast(n?n+" doublon(s) supprimé(s)":"Aucun doublon");};
  draw();
}
window.delContact=id=>{ DB.contacts=DB.contacts.filter(c=>c.id!==id); save(); renderNav(); VIEWS.finder(); };
window.tagContact=id=>{ const c=DB.contacts.find(x=>x.id===id); if(!c)return;
  openModal({title:"Listes / étiquettes",body:`<div class="field"><label>Listes (séparées par des virgules)</label>
    <input class="input" id="tg_in" value="${esc((c.tags||[]).join(", "))}" placeholder="Prospects Espagne, Salon 2026"></div>`,
    footer:[{label:"Annuler",cls:"ghost",act:closeModal},{label:"Enregistrer",cls:"primary",act:()=>{
      c.tags=$("#tg_in").value.split(",").map(s=>s.trim()).filter(Boolean); save(); closeModal(); VIEWS.finder(); toast("Listes mises à jour");}}]});
};
function importContactsCSV(e){
  const f=e.target.files[0]; if(!f)return; const rd=new FileReader();
  rd.onload=()=>{ try{
    const lines=rd.result.replace(/^﻿/,"").split(/\r?\n/).filter(l=>l.trim());
    if(!lines.length){toast("Fichier vide","warn");return;}
    const head=splitCSV(lines[0]).map(h=>h.trim().toLowerCase());
    const col=n=>head.findIndex(h=>h.includes(n));
    const iE=col("email")>=0?col("email"):0, iN=col("nom")>=0?col("nom"):col("name"), iD=col("domain")>=0?col("domain"):col("domaine"), iP=col("phone")>=0?col("phone"):col("tel");
    let n=0; for(let i=1;i<lines.length;i++){ const cols=splitCSV(lines[i]);
      const email=(cols[iE]||"").trim().toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      if(DB.contacts.some(c=>c.email===email)) continue;
      DB.contacts.unshift({id:uid(),email,name:(iN>=0?cols[iN]:"")||"",domain:(iD>=0?cols[iD]:email.split("@")[1])||"",phone:(iP>=0?cols[iP]:"")||"",confidence:"",source:"import",added:Date.now(),tags:[]}); n++;
    }
    logAct(`${n} contacts importés (CSV)`); save(); renderNav(); VIEWS.finder(); toast(n+" contacts importés");
  }catch(err){toast("CSV illisible","bad");} };
  rd.readAsText(f);
}
function splitCSV(line){ const out=[];let cur="",q=false;
  for(let i=0;i<line.length;i++){const ch=line[i];
    if(q){ if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;} else if(ch==='"'){q=false;} else cur+=ch; }
    else { if(ch==='"')q=true; else if(ch===","||ch===";"){out.push(cur);cur="";} else cur+=ch; } }
  out.push(cur); return out;
}

/* ---------- Générique : tables entités ---------- */
const SCHEMAS={
  partners:{ label:"Partenaire", statuses:["Non catégorisée","À contacter","Contacté","En discussion","Devis envoyé","Partenaire actif"],
    fields:[
      {k:"name",l:"Nom du partenaire",req:true},
      {k:"type",l:"Type",type:"select",opts:["CFA","École","Entreprise","OPCO","ONG","Organisme d'accueil","Autre"]},
      {k:"country",l:"Pays"},{k:"oid",l:"Identifiant Erasmus (OID)"},
      {k:"contactName",l:"Contact (Nom Prénom)"},{k:"email",l:"Email",type:"email"},{k:"phone",l:"Téléphone"},
      {k:"status",l:"Statut relation",type:"select",optsFrom:"statuses"},
      {k:"potential",l:"Valeur potentielle (€)",type:"number"},
      {k:"lastContact",l:"Dernier contact",type:"date"},{k:"notes",l:"Notes",type:"textarea"},
    ],
    cols:["name","type","status","contactName","email","potential"], kanbanBy:"status" },
  projects:{ label:"Projet",
    fields:[
      {k:"name",l:"Nom du projet",req:true},
      {k:"direction",l:"Sens",type:"select",opts:["Sortant (on envoie)","Entrant (on reçoit)"]},
      {k:"country",l:"Pays de destination"},{k:"city",l:"Ville d'accueil"},
      {k:"start",l:"Date de début",type:"date"},{k:"end",l:"Date de fin",type:"date"},
      {k:"grant",l:"Subvention Erasmus (€)",type:"number"},{k:"convention",l:"N° de convention Erasmus"},
      {k:"status",l:"Avancement",type:"select",opts:["Cadrage","Conventions","Préparation","En cours","Reconnaissance","Reporting","Clôturé"]},
      {k:"margin",l:"Marge (€)",type:"number"},{k:"notes",l:"Notes",type:"textarea"},
    ],
    cols:["name","direction","country","status","start","margin"] },
  participants:{ label:"Participant",
    fields:[
      {k:"name",l:"Nom Prénom",req:true},{k:"birth",l:"Date de naissance",type:"date"},
      {k:"nationality",l:"Nationalité"},{k:"email",l:"Email",type:"email"},{k:"phone",l:"Téléphone"},
      {k:"project",l:"Projet lié"},{k:"minor",l:"Mineur ?",type:"select",opts:["Non","Oui"]},
      {k:"insurance",l:"Assurances OK ?",type:"select",opts:["Non","En cours","Oui"]},
      {k:"ceam",l:"Carte CEAM ?",type:"select",opts:["Non","Oui"]},
      {k:"status",l:"Statut dossier",type:"select",opts:["Incomplet","En cours","Complet"]},
      {k:"notes",l:"Notes",type:"textarea"},
    ],
    cols:["name","project","minor","insurance","status"] },
  providers:{ label:"Prestataire",
    fields:[
      {k:"name",l:"Nom du prestataire",req:true},
      {k:"type",l:"Type",type:"select",opts:["Hébergement","Restauration","Transport","Activité","Guide","Autre"]},
      {k:"city",l:"Ville"},{k:"contactName",l:"Contact"},{k:"email",l:"Email",type:"email"},{k:"phone",l:"Téléphone"},
      {k:"price",l:"Prix estimé (€/groupe/jour)",type:"number"},
      {k:"contract",l:"Contrat ?",type:"select",opts:["Non","À signer","Signé"]},
      {k:"notes",l:"Notes",type:"textarea"},
    ],
    cols:["name","type","city","price","contract"] },
  tasks:{ label:"Tâche",
    fields:[
      {k:"title",l:"Intitulé",req:true},
      {k:"status",l:"Statut",type:"select",opts:["À faire","En cours","Fait"]},
      {k:"priority",l:"Priorité",type:"select",opts:["Basse","Normale","Haute","Urgente"]},
      {k:"due",l:"Échéance",type:"date"},{k:"linked",l:"Lié à (projet/partenaire)"},
      {k:"notes",l:"Détails",type:"textarea"},
    ],
    cols:["title","status","priority","due","linked"], kanbanBy:"status" },
};
function customCols(entity){ return (DB.customFields&&DB.customFields[entity])||[]; }
function fieldsOf(entity){ return SCHEMAS[entity].fields.concat(customCols(entity)); }
function labelOf(entity,k){ return fieldsOf(entity).find(f=>f.k===k)?.l || k; }
function statusField(entity){ return SCHEMAS[entity].fields.find(f=>f.k==="status"); }
function cellRender(entity,item,k){
  const f=fieldsOf(entity).find(x=>x.k===k); const v=item[k];
  if(k==="status"){ return statusTag(entity,v); }
  if(f?.type==="number"){ return k.match(/margin|potential|price|grant/)? eur(v): (v??"—"); }
  if(f?.type==="date"){ return `<span class="muted">${fmtDate(v)}</span>`; }
  if(k==="name"||k==="title"){ return `<span class="cell-strong">${item.flag?item.flag+" ":""}${esc(v||"(sans nom)")}</span>`; }
  if(k==="email"&&v){ return `<span class="mono" style="font-size:12.5px">${esc(v)}</span>`; }
  return v?esc(v):`<span class="muted">—</span>`;
}
function statusTag(entity,v){
  if(!v) return `<span class="tag n">—</span>`;
  const map={ "Partenaire actif":"g","Complet":"g","Fait":"g","Signé":"g","Clôturé":"g","Oui":"g",
    "En discussion":"b","En cours":"b","Contacté":"b","Préparation":"b","Reporting":"b",
    "Devis envoyé":"a","Conventions":"a","Reconnaissance":"a",
    "À contacter":"w","À signer":"w","À faire":"w","Incomplet":"w","Cadrage":"w",
    "Urgente":"r","Haute":"r","Non":"n","Non catégorisée":"n",
    "Accepté":"g","Envoyé":"b","Brouillon":"n","Refusé":"r",
    "Payée":"g","Émise":"b","En retard":"r","Annulée":"n" };
  return `<span class="tag ${map[v]||'n'}">${esc(v)}</span>`;
}
let ENTITY_VIEW={}; // per-entity: {mode, q, filter, sel:Set}
function entityView(entity){
  const s=SCHEMAS[entity]; const st=ENTITY_VIEW[entity]||(ENTITY_VIEW[entity]={mode:s.kanbanBy?"kanban":"table",q:"",filter:"",sel:new Set()});
  if(!st.sel) st.sel=new Set();
  const canKanban=!!s.kanbanBy; const sf=statusField(entity);
  const filterOpts = sf ? (s.statuses||sf.opts||[]) : [];
  $("#view").innerHTML=`
  <div class="toolbar">
    <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input class="input" id="ev_q" placeholder="Rechercher…" value="${esc(st.q)}"></div>
    ${sf?`<select class="input" id="ev_filter" style="max-width:190px"><option value="">Tous les statuts</option>${filterOpts.map(o=>`<option ${st.filter===o?'selected':''}>${esc(o)}</option>`).join("")}</select>`:""}
    ${canKanban?`<div class="pill-tabs"><button data-mode="kanban" class="${st.mode==='kanban'?'active':''}">Kanban</button><button data-mode="table" class="${st.mode==='table'?'active':''}">Tableau</button></div>`:""}
    <div class="spacer"></div>
    <button class="btn ghost sm" id="ev_cols">Colonnes</button>
    <button class="btn ghost sm" id="ev_exp">Exporter CSV</button>
    <button class="btn primary" id="ev_add">+ ${esc(s.label)}</button>
  </div>
  <div id="ev_bulk"></div>
  <div id="ev_body"></div>`;
  $("#ev_q").oninput=e=>{st.q=e.target.value;drawEntity(entity);};
  $("#ev_filter")&&($("#ev_filter").onchange=e=>{st.filter=e.target.value;drawEntity(entity);});
  $("#ev_add").onclick=()=>editEntity(entity,null);
  $("#ev_cols").onclick=()=>manageColumns(entity);
  $("#ev_exp").onclick=()=>exportCSV(entity, fieldsOf(entity).map(f=>f.k), DB[entity]);
  $$("#view [data-mode]").forEach(b=>b.onclick=()=>{st.mode=b.dataset.mode;entityView(entity);});
  drawEntity(entity);
}
function filteredRows(entity){
  const s=SCHEMAS[entity], st=ENTITY_VIEW[entity]; const q=(st.q||"").toLowerCase();
  return DB[entity].filter(it=>(!q||JSON.stringify(it).toLowerCase().includes(q)) && (!st.filter||(it.status||"")===st.filter));
}
function drawEntity(entity){
  const s=SCHEMAS[entity], st=ENTITY_VIEW[entity];
  let rows=filteredRows(entity);
  const body=$("#ev_body");
  drawBulkBar(entity);
  if(!rows.length){ body.innerHTML=`<div class="card"><div class="empty"><svg viewBox="0 0 24 24">${ICONS.people}</svg><div>Aucun élément${st.q||st.filter?" pour ce filtre":""}. ${st.q||st.filter?"":`Cliquez « + ${esc(s.label)} » pour commencer.`}</div></div></div>`; return; }
  if(st.mode==="kanban"&&s.kanbanBy){
    const col=s.kanbanBy; const groups=(s.statuses||s.fields.find(f=>f.k===col).opts);
    body.innerHTML=`<div class="kanban">${groups.map(g=>{
      const items=rows.filter(r=>(r[col]||groups[0])===g);
      return `<div class="kcol" data-col="${esc(g)}"><h4>${statusTag(entity,g)}<span class="spacer"></span><span class="muted">${items.length}</span></h4>
      ${items.map(it=>kanbanCard(entity,it)).join("")}</div>`;}).join("")}</div>`;
    wireKanban(entity,col);
  } else {
    const cols=s.cols.concat(customCols(entity).map(f=>f.k));
    const allSel=rows.length&&rows.every(r=>st.sel.has(r.id));
    body.innerHTML=`<div class="tbl-wrap"><table><thead><tr>
      <th style="width:34px"><span class="chk ${allSel?'on':''}" id="ev_all" style="width:18px;height:18px"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></span></th>
      ${cols.map(c=>`<th>${esc(labelOf(entity,c))}</th>`).join("")}<th></th></tr></thead>
    <tbody>${rows.map(it=>`<tr data-id="${it.id}" class="${st.sel.has(it.id)?'selrow':''}">
      <td><span class="chk ${st.sel.has(it.id)?'on':''}" data-sel="${it.id}" style="width:18px;height:18px"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></span></td>
      ${cols.map(c=>`<td data-open="${it.id}" style="cursor:pointer">${cellRender(entity,it,c)}</td>`).join("")}
      <td class="rowact"><button class="btn sm ghost" data-edit="${it.id}">Ouvrir</button><button class="btn sm ghost" data-del="${it.id}">✕</button></td></tr>`).join("")}</tbody></table></div>`;
    $$("#ev_body [data-edit]").forEach(b=>b.onclick=e=>{e.stopPropagation();editEntity(entity,b.dataset.edit);});
    $$("#ev_body [data-del]").forEach(b=>b.onclick=e=>{e.stopPropagation();delEntity(entity,b.dataset.del);});
    $$("#ev_body [data-open]").forEach(td=>td.onclick=()=>editEntity(entity,td.dataset.open));
    $$("#ev_body [data-sel]").forEach(c=>c.onclick=e=>{e.stopPropagation();const id=c.dataset.sel; st.sel.has(id)?st.sel.delete(id):st.sel.add(id); drawEntity(entity);});
    $("#ev_all").onclick=()=>{ if(allSel) rows.forEach(r=>st.sel.delete(r.id)); else rows.forEach(r=>st.sel.add(r.id)); drawEntity(entity); };
  }
}
function drawBulkBar(entity){
  const st=ENTITY_VIEW[entity]; const bar=$("#ev_bulk"); if(!bar) return;
  const n=st.sel?st.sel.size:0;
  if(!n){ bar.innerHTML=""; return; }
  bar.innerHTML=`<div class="card" style="display:flex;align-items:center;gap:12px;margin-bottom:14px;border-left:4px solid var(--brand);padding:12px 16px">
    <b>${n} sélectionné${n>1?'s':''}</b><div class="spacer"></div>
    <button class="btn sm" id="bulk_edit">Modifier en masse</button>
    <button class="btn sm ghost" id="bulk_del" style="color:var(--bad)">Supprimer</button>
    <button class="btn sm ghost" id="bulk_clear">Annuler la sélection</button></div>`;
  $("#bulk_clear").onclick=()=>{st.sel.clear();drawEntity(entity);};
  $("#bulk_del").onclick=()=>{ confirmModal("Supprimer la sélection ?",`${n} élément(s) seront supprimés définitivement.`,()=>{
    DB[entity]=DB[entity].filter(x=>!st.sel.has(x.id)); logAct(`${n} ${SCHEMAS[entity].label}(s) supprimé(s)`); st.sel.clear(); save(); renderNav(); entityView(entity);
  },true); };
  $("#bulk_edit").onclick=()=>bulkEdit(entity);
}
function bulkEdit(entity){
  const st=ENTITY_VIEW[entity]; const fields=fieldsOf(entity).filter(f=>f.type!=="textarea"||true);
  const opts=fields.map(f=>`<option value="${f.k}">${esc(f.l)}</option>`).join("");
  openModal({title:`Modifier ${st.sel.size} élément(s)`,
    body:`<div class="field"><label>Champ à modifier</label><select id="be_field">${opts}</select></div>
    <div class="field" id="be_valwrap"><label>Nouvelle valeur</label><input class="input" id="be_val"></div>`,
    footer:[{label:"Annuler",cls:"ghost",act:closeModal},{label:"Appliquer",cls:"primary",act:()=>{
      const k=$("#be_field").value; const el=$("#be_val"); let v=el.value;
      const f=fieldsOf(entity).find(x=>x.k===k); if(f?.type==="date"&&v) v=new Date(v).getTime();
      let n=0; DB[entity].forEach(it=>{ if(st.sel.has(it.id)){ it[k]=v; n++; } });
      logAct(`${n} ${SCHEMAS[entity].label}(s) modifié(s) en masse`); save(); renderNav(); closeModal(); entityView(entity); toast(n+" élément(s) modifié(s)");
    }}]});
  const sync=()=>{ const f=fieldsOf(entity).find(x=>x.k===$("#be_field").value); const w=$("#be_valwrap");
    if(f?.type==="select"){ const o=f.optsFrom?SCHEMAS[entity][f.optsFrom]:f.opts; w.innerHTML=`<label>Nouvelle valeur</label><select class="input" id="be_val"><option value="">—</option>${o.map(x=>`<option>${esc(x)}</option>`).join("")}</select>`; }
    else { w.innerHTML=`<label>Nouvelle valeur</label><input class="input" id="be_val" type="${f?.type==="number"?"number":f?.type==="date"?"date":"text"}">`; } };
  $("#be_field").onchange=sync; sync();
}
function manageColumns(entity){
  const cols=customCols(entity);
  openModal({title:"Colonnes personnalisées", wide:true,
    body:`<p class="muted" style="font-weight:600;margin-top:0">Ajoutez vos propres colonnes à ce tableau. Elles apparaissent dans la fiche et dans le tableau, et sont sauvegardées.</p>
    <div id="mc_list">${cols.length?cols.map(f=>`<div class="result-row"><div style="flex:1"><b>${esc(f.l)}</b> <span class="muted">(${f.type})</span></div>
      <button class="btn sm ghost" data-delcol="${f.k}">Supprimer</button></div>`).join(""):'<div class="muted" style="font-weight:600;padding:6px 0">Aucune colonne personnalisée pour l’instant.</div>'}</div>
    <div class="divider"></div>
    <div class="row3"><div class="field"><label>Nom de la colonne</label><input class="input" id="mc_name" placeholder="Ex : Ville, Budget, Référent"></div>
      <div class="field"><label>Type</label><select id="mc_type"><option value="text">Texte</option><option value="number">Nombre</option><option value="date">Date</option><option value="textarea">Texte long</option></select></div>
      <div class="field" style="just-content:flex-end"><label>&nbsp;</label><button class="btn primary" id="mc_add">Ajouter la colonne</button></div></div>`,
    footer:[{label:"Fermer",cls:"primary",act:()=>{closeModal();entityView(entity);}}]});
  $$("#mc_list [data-delcol]").forEach(b=>b.onclick=()=>{ DB.customFields[entity]=customCols(entity).filter(f=>f.k!==b.dataset.delcol); save(); manageColumns(entity); });
  $("#mc_add").onclick=()=>{ const name=$("#mc_name").value.trim(); if(!name){toast("Nom requis","warn");return;}
    const k="c_"+name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")+"_"+Math.random().toString(36).slice(2,5);
    DB.customFields[entity]=customCols(entity); DB.customFields[entity].push({k,l:name,type:$("#mc_type").value});
    save(); manageColumns(entity); toast("Colonne ajoutée"); };
}
function kanbanCard(entity,it){
  const s=SCHEMAS[entity]; const title=it.name||it.title||"(sans nom)";
  const sub=entity==="partners"? (it.contactName||it.type||"") : entity==="tasks"? (it.due?fmtDate(it.due):"") : (it.country||it.project||"");
  const extra=entity==="partners"&&it.potential? `<span class="tag g" style="margin-top:8px">${eur(it.potential)}</span>`:
    entity==="tasks"&&it.priority? statusTag(entity,it.priority):"";
  return `<div class="kcard" draggable="true" data-id="${it.id}">
    <div class="cell-strong">${it.flag?it.flag+" ":""}${esc(title)}</div>
    ${sub?`<div class="muted" style="font-size:12.5px;margin-top:3px">${esc(sub)}</div>`:""}
    ${extra?`<div style="margin-top:6px">${extra}</div>`:""}</div>`;
}
function wireKanban(entity,col){
  let dragId=null;
  $$("#ev_body .kcard").forEach(c=>{
    c.addEventListener("dragstart",()=>{dragId=c.dataset.id;c.classList.add("drag");});
    c.addEventListener("dragend",()=>c.classList.remove("drag"));
    c.addEventListener("click",()=>editEntity(entity,c.dataset.id));
  });
  $$("#ev_body .kcol").forEach(kc=>{
    kc.addEventListener("dragover",e=>{e.preventDefault();kc.classList.add("over");});
    kc.addEventListener("dragleave",()=>kc.classList.remove("over"));
    kc.addEventListener("drop",e=>{e.preventDefault();kc.classList.remove("over");
      const it=DB[entity].find(x=>x.id===dragId); if(it){ const old=it[col]; it[col]=kc.dataset.col;
        if(entity==="partners"&&col==="status") Automations.run("partner.status",{...it,_entity:entity,_id:it.id});
        logAct(`${SCHEMAS[entity].label} « ${it.name||it.title} » : ${old} → ${it[col]}`);
        save();renderNav();drawEntity(entity);toast("Déplacé vers "+kc.dataset.col);}});
  });
}
function fieldHTML(entity,it,f){
  const s=SCHEMAS[entity]; const v=it[f.k]??"";
  const val=f.type==="date"&&v? new Date(v).toISOString().slice(0,10):v;
  if(f.type==="textarea") return `<div class="field" style="grid-column:1/-1"><label>${esc(f.l)}</label><textarea data-f="${f.k}">${esc(v)}</textarea></div>`;
  if(f.type==="select"){ const opts=f.optsFrom?s[f.optsFrom]:f.opts;
    return `<div class="field"><label>${esc(f.l)}</label><select data-f="${f.k}"><option value="">—</option>${opts.map(o=>`<option ${o===v?'selected':''}>${esc(o)}</option>`).join("")}</select></div>`; }
  const t=f.type==="number"?"number":f.type==="date"?"date":f.type==="email"?"email":"text";
  return `<div class="field"><label>${esc(f.l)}${f.req?' *':''}</label><input class="input" type="${t}" data-f="${f.k}" value="${esc(val)}"></div>`;
}
function editEntity(entity,id){
  const s=SCHEMAS[entity]; const it = id? DB[entity].find(x=>x.id===id) : {};
  const body=`<div class="row2" style="align-items:start">${fieldsOf(entity).map(f=>fieldHTML(entity,it,f)).join("")}</div>`;
  openModal({ title:(id?"Modifier ":"Nouveau ")+s.label, wide:true, body,
    footer:[ ...(id?[{label:"Supprimer",cls:"ghost",act:()=>{closeModal();delEntity(entity,id);}}]:[]),
      {label:"Annuler",cls:"ghost",act:closeModal},
      {label:"Enregistrer",cls:"primary",act:()=>saveEntity(entity,id)} ] });
}
function saveEntity(entity,id){
  const s=SCHEMAS[entity]; const data={}; const allF=fieldsOf(entity);
  $$(".mbody [data-f]").forEach(el=>{ let v=el.value; const f=allF.find(x=>x.k===el.dataset.f);
    if(f?.type==="date"&&v) v=new Date(v).getTime(); data[el.dataset.f]=v; });
  const req=s.fields.find(f=>f.req);
  if(req && !data[req.k]?.toString().trim()){ toast(req.l+" est obligatoire","warn"); return; }
  if(id){ const it=DB[entity].find(x=>x.id===id); Object.assign(it,data); logAct(`${s.label} modifié : ${data[req.k]||it[req.k]}`); }
  else{ const nw={id:uid(),...data}; DB[entity].push(nw); logAct(`${s.label} créé : ${data[req.k]||""}`);
    if(entity==="projects") Automations.run("project.created",{...nw,_entity:entity,_id:nw.id});
    if(entity==="participants") Automations.run("participant.created",{...nw,_entity:entity,_id:nw.id}); }
  save(); renderNav(); closeModal(); toast(id?"Modifié":"Créé");
  if(VIEWS[CURRENT]) VIEWS[CURRENT](); else entityView(entity);
}
function delEntity(entity,id){
  const s=SCHEMAS[entity]; const it=DB[entity].find(x=>x.id===id);
  confirmModal("Supprimer ?", `« ${it?.name||it?.title||"cet élément"} » sera définitivement supprimé.`, ()=>{
    DB[entity]=DB[entity].filter(x=>x.id!==id); logAct(`${s.label} supprimé`); save(); renderNav();
    if(CURRENT===entity) entityView(entity);
  }, true);
}
VIEWS.partners=()=>entityView("partners");
VIEWS.participants=()=>entityView("participants");
VIEWS.providers=()=>entityView("providers");
VIEWS.tasks=()=>{ renderTasksExtra(); };

/* Projects view with compliance R1..R8 */
const R_LABELS=[
  ["R1","Durée & type d'activité conformes"],
  ["R2","Toutes les conventions signées AVANT le départ"],
  ["R3","Présence réelle prouvée (émargement)"],
  ["R4","Archive conservée 5 ans"],
  ["R5","Assurances OK (RC, rapatriement, CEAM)"],
  ["R6","Cœur pédagogique réel vérifié"],
  ["R7","Statut social maintenu (CPAM/MSA si apprenti)"],
  ["R8","Pays / partenaire unique identifié (OID)"],
];
function compliance(p){ const r=p.R||{}; const done=R_LABELS.filter(([k])=>r[k]).length; return {done,total:R_LABELS.length,r}; }
VIEWS.projects=()=>{
  const st=ENTITY_VIEW.projects||(ENTITY_VIEW.projects={mode:"table",q:""});
  entityView("projects");
  // add a compliance panel button per row via override of table: we augment after draw
  const body=$("#ev_body");
  // Insert compliance quick access: clicking a project opens editor; add compliance section there.
};
// Extend editEntity for projects: append compliance checklist R1..R8.
// The checkboxes write directly into __pendingR, which the wrapped
// saveEntity reads and merges onto the project after saving.
const _editEntity=editEntity;
editEntity=function(entity,id){
  window.__pendingR=null;
  _editEntity(entity,id);
  if(entity==="projects"){
    const it = id? DB.projects.find(x=>x.id===id):null;
    const mb=$(".mbody"); if(!mb) return;
    const r={...((it&&it.R)||{})};
    window.__pendingR=r;
    const box=document.createElement("div");
    box.innerHTML=`<div class="divider"></div><div class="section-title" style="margin-top:0">Conformité Erasmus (R1 → R8)</div>
      ${R_LABELS.map(([k,l])=>`<div class="checkline"><div class="chk ${r[k]?'on':''}" data-r="${k}"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></div>
        <div><b>${k}</b> · ${esc(l)}</div></div>`).join("")}
      <p class="muted" style="font-size:12px;font-weight:600;margin:4px 0 0">Cochez au fur et à mesure. Un projet « prêt pour l'audit » a ses 8 cases vertes.</p>`;
    mb.appendChild(box);
    $$(".chk[data-r]",box).forEach(c=>c.onclick=()=>{ const k=c.dataset.r; r[k]=!r[k]; c.classList.toggle("on",r[k]); });
  }
};
const _saveEntity=saveEntity;
saveEntity=function(entity,id){
  const pending = entity==="projects" ? window.__pendingR : null;
  const idsBefore = entity==="projects" ? new Set(DB.projects.map(x=>x.id)) : null;
  _saveEntity(entity,id); // this closes the modal + re-renders
  if(pending){
    const it = id? DB.projects.find(x=>x.id===id) : DB.projects.find(x=>!idsBefore.has(x.id));
    if(it){ it.R=pending; save(); if(VIEWS[CURRENT]) VIEWS[CURRENT](); }
    window.__pendingR=null;
  }
};

/* Tasks extra: overdue banner + reminders */
function renderTasksExtra(){
  entityView("tasks");
  const overdue=DB.tasks.filter(t=>t.status!=="Fait"&&t.due&&t.due<Date.now());
  if(overdue.length){
    const b=document.createElement("div"); b.className="helpbox"; b.style.background="var(--bad-soft)"; b.style.color="var(--bad)";
    b.innerHTML=`${ic2("info")}<div><b>${overdue.length} tâche(s) en retard.</b> ${overdue.slice(0,3).map(t=>esc(t.title)).join(" · ")}${overdue.length>3?"…":""}</div>`;
    $("#view").insertBefore(b, $("#view").firstChild.nextSibling);
  }
}

/* ---------- Finances ---------- */
VIEWS.finance=()=>{
  const b=DB.budget;
  const totalRev=b.reduce((s,x)=>s+(Number(x.revenue)||0),0);
  const totalCost=b.reduce((s,x)=>s+(Number(x.cost)||0),0);
  const totalMargin=totalRev-totalCost;
  $("#view").innerHTML=`
  <div class="grid cards">
    ${kpi("Revenus",eur(totalRev),"money","var(--brand)")}
    ${kpi("Coûts",eur(totalCost),"money","var(--warn)")}
    ${kpi("Marge",eur(totalMargin),"money",totalMargin>=0?"var(--ok)":"var(--bad)")}
    ${kpi("Taux de marge",(totalRev?Math.round(totalMargin/totalRev*100):0)+"%","money","var(--accent)")}
  </div>
  <div class="card" style="margin-top:16px">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <div class="section-title" style="margin:0">Enveloppe Erasmus (T9)</div><div class="spacer"></div>
      <label class="muted" style="font-weight:700;font-size:12px">Subvention totale (€)</label>
      <input class="input" type="number" id="ee_total" value="${esc(DB.settings.erasmusEnvelope||0)}" style="max-width:160px">
      <button class="btn sm primary" id="ee_save">Enregistrer</button>
    </div>
    <div id="ee_body" style="margin-top:14px"></div>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:16px">
    <div class="card">
      <div class="section-title" style="margin-top:0">Calculateur de marge séjour</div>
      <div class="row2"><div class="field"><label>Prix de vente / pers (€)</label><input class="input" type="number" id="mc_price" value="790"></div>
      <div class="field"><label>Nb participants</label><input class="input" type="number" id="mc_n" value="10"></div></div>
      <div class="field"><label>Coût FLE (€/heure)</label><input class="input" type="number" id="mc_fle" value="30"></div>
      <div class="row2"><div class="field"><label>Heures de cours</label><input class="input" type="number" id="mc_h" value="20"></div>
      <div class="field"><label>Autres coûts / pers (héberg., activités…)</label><input class="input" type="number" id="mc_other" value="450"></div></div>
      <button class="btn primary" id="mc_go" style="width:100%">Calculer</button>
      <div id="mc_out" style="margin-top:14px"></div>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center"><div class="section-title" style="margin:0">Lignes budgétaires</div><div class="spacer"></div><button class="btn sm primary" id="bl_add">+ Ligne</button></div>
      <div id="bl_tbl" style="margin-top:12px"></div>
    </div>
  </div>`;
  const calc=()=>{
    const price=+$("#mc_price").value||0,n=+$("#mc_n").value||1,fle=+$("#mc_fle").value||0,h=+$("#mc_h").value||0,other=+$("#mc_other").value||0;
    const flePer=(fle*h)/n; const costPer=flePer+other; const marginPer=price-costPer;
    const totM=marginPer*n;
    $("#mc_out").innerHTML=`
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span class="muted">Coût FLE / pers</span><b>${eur(flePer)}</b></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span class="muted">Coût total / pers</span><b>${eur(costPer)}</b></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span class="muted">Marge / participant</span><b style="color:${marginPer>=0?'var(--ok)':'var(--bad)'}">${eur(marginPer)}</b></div>
      <div style="display:flex;justify-content:space-between;padding:10px 0"><span style="font-weight:800">Marge totale groupe</span><b style="font-size:20px;color:${totM>=0?'var(--ok)':'var(--bad)'}">${eur(totM)}</b></div>`;
  };
  $("#mc_go").onclick=calc; calc();
  $("#bl_add").onclick=()=>editBudget(null);
  drawBudget();
  drawErasmus();
  $("#ee_save").onclick=()=>{ DB.settings.erasmusEnvelope=+$("#ee_total").value||0; save(); drawErasmus(); toast("Enveloppe Erasmus enregistrée"); };
};
function drawErasmus(){
  const total=Number(DB.settings.erasmusEnvelope)||0;
  const engaged=DB.projects.reduce((s,p)=>s+(Number(p.grant)||0),0);
  const remaining=total-engaged; const pct=total?Math.min(100,Math.round(engaged/total*100)):0;
  const byProj=DB.projects.filter(p=>Number(p.grant)>0);
  $("#ee_body").innerHTML=`
  <div class="grid cards" style="margin-bottom:12px">
    ${kpi("Subvention totale",eur(total),"money","var(--brand)")}
    ${kpi("Engagé (projets)",eur(engaged),"money","var(--warn)")}
    ${kpi("Disponible",eur(remaining),"money",remaining>=0?"var(--ok)":"var(--bad)")}
  </div>
  <div class="progress" style="margin-bottom:6px"><i style="width:${pct}%;${remaining<0?'background:var(--bad)':''}"></i></div>
  <div class="muted" style="font-size:12px;font-weight:600">${pct}% de l'enveloppe engagée${remaining<0?' —  dépassement !':''}</div>
  ${byProj.length?`<div class="divider"></div><div class="muted" style="font-weight:700;font-size:11px;text-transform:uppercase;margin-bottom:6px">Déduction automatique par projet</div>
    ${byProj.map(p=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line)"><span>${esc(p.name)}</span><b>${eur(p.grant)}</b></div>`).join("")}`
    :`<p class="muted" style="font-size:12px;font-weight:600;margin:10px 0 0">Renseignez la « Subvention Erasmus (€) » dans vos projets (T2) : elle se déduira automatiquement ici.</p>`}`;
}
function drawBudget(){
  const b=DB.budget;
  $("#bl_tbl").innerHTML=b.length?`<div class="tbl-wrap"><table><thead><tr><th>Libellé</th><th>Revenus</th><th>Coûts</th><th>Marge</th><th></th></tr></thead>
    <tbody>${b.map(x=>{const m=(+x.revenue||0)-(+x.cost||0);return `<tr><td class="cell-strong">${esc(x.label||"—")}</td><td>${eur(x.revenue)}</td><td>${eur(x.cost)}</td>
    <td style="color:${m>=0?'var(--ok)':'var(--bad)'};font-weight:700">${eur(m)}</td>
    <td class="rowact"><button class="btn sm ghost" data-call="editBudget('${x.id}')">Ouvrir</button><button class="btn sm ghost" data-call="delBudget('${x.id}')">✕</button></td></tr>`;}).join("")}</tbody></table></div>`
    :`<div class="empty"><div>Aucune ligne. Ajoutez vos revenus/coûts par séjour.</div></div>`;
}
window.editBudget=id=>{ const it=id?DB.budget.find(x=>x.id===id):{};
  openModal({title:id?"Modifier la ligne":"Nouvelle ligne budgétaire",
    body:`<div class="field"><label>Libellé *</label><input class="input" id="b_label" value="${esc(it.label||"")}"></div>
    <div class="row2"><div class="field"><label>Revenus (€)</label><input class="input" type="number" id="b_rev" value="${esc(it.revenue||"")}"></div>
    <div class="field"><label>Coûts (€)</label><input class="input" type="number" id="b_cost" value="${esc(it.cost||"")}"></div></div>`,
    footer:[{label:"Annuler",cls:"ghost",act:closeModal},{label:"Enregistrer",cls:"primary",act:()=>{
      const label=$("#b_label").value.trim(); if(!label){toast("Libellé requis","warn");return;}
      const rev=+$("#b_rev").value||0,cost=+$("#b_cost").value||0,margin=rev-cost;
      if(id){Object.assign(it,{label,revenue:rev,cost,margin});}else{DB.budget.push({id:uid(),label,revenue:rev,cost,margin});}
      save();closeModal();VIEWS.finance();toast("Enregistré");}}]});
};
window.delBudget=id=>{ DB.budget=DB.budget.filter(x=>x.id!==id); save(); VIEWS.finance(); };

/* ---------- Devis & documents ---------- */
function co(){ return DB.settings.company||{}; }
function ds(){ return DB.settings.docStyle||{accent:"#1d5fd6",footerMode:"auto"}; }
function darken(hex,amt){ try{ let h=hex.replace("#",""); if(h.length===3)h=h.split("").map(c=>c+c).join("");
  const n=parseInt(h,16); let r=(n>>16)-amt,g=((n>>8)&255)-amt,b=(n&255)-amt;
  r=Math.max(0,r);g=Math.max(0,g);b=Math.max(0,b);
  return "#"+((r<<16)|(g<<8)|b).toString(16).padStart(6,"0"); }catch(e){ return hex; } }
function printDocument(title, inner){
  const w=window.open("","_blank","width=820,height=920");
  if(!w){ toast("Autorisez les fenêtres pop-up pour imprimer / exporter en PDF","warn"); return; }
  const a=ds().accent||"#1d5fd6", ad=darken(a,60);
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
  *{box-sizing:border-box} body{font:13px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a2233;margin:0;background:#eef1f6}
  .sheet{background:#fff;max-width:800px;margin:24px auto;padding:44px 48px;box-shadow:0 6px 30px rgba(0,0,0,.12)}
  .dhead{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:3px solid ${a};padding-bottom:16px}
  .dhead .co b{font-size:20px;color:${ad};letter-spacing:.3px} .dhead .co div{font-size:11.5px;color:#556}
  .dhead .co img{max-height:64px;max-width:220px;margin-bottom:8px;display:block}
  .dtitle{text-align:right} .dtitle h1{margin:0;font-size:26px;letter-spacing:2px;color:${a}} .dtitle .num{font-weight:700;font-size:14px} .dtitle .dt{font-size:12px;color:#667}
  .blocks{display:flex;justify-content:space-between;gap:24px;margin:26px 0}
  .block{flex:1} .block h4{margin:0 0 6px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#889} .block .bd{font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:8px} th{background:${a};color:#fff;text-align:left;padding:9px 12px;font-size:11px;letter-spacing:.5px;text-transform:uppercase}
  th.r,td.r{text-align:right} td{padding:9px 12px;border-bottom:1px solid #e3e9f2}
  .totals{margin-top:16px;margin-left:auto;width:280px} .totals div{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eef}
  .totals .grand{border:0;border-top:2px solid ${a};margin-top:4px;padding-top:10px;font-size:17px;font-weight:800;color:${ad}}
  .conditions{margin-top:26px;font-size:12px;color:#445;white-space:pre-wrap}
  .foot{margin-top:30px;padding-top:14px;border-top:1px solid #dde;font-size:10.5px;color:#889;text-align:center;line-height:1.7;white-space:pre-wrap}
  .doc-body{white-space:pre-wrap;font-size:13.5px;line-height:1.8;margin-top:20px}
  .sign{display:flex;justify-content:space-between;margin-top:40px;gap:40px} .sign div{flex:1;font-size:12px} .sign .line{margin-top:44px;border-top:1px solid #99a}
  .noprint{position:fixed;bottom:20px;right:20px;display:flex;gap:10px}
  .noprint button{background:${a};color:#fff;border:0;padding:12px 20px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
  .noprint button.g{background:#556}
  @media print{ body{background:#fff} .sheet{box-shadow:none;margin:0;max-width:none;padding:0} .noprint{display:none} }
  </style></head><body><div class="sheet">${inner}</div>
  <div class="noprint"><button class="g" id="ftClose">Fermer</button><button id="ftPrint">Imprimer / PDF</button></div>
  </body></html>`);
  w.document.close();
  try{ w.document.getElementById("ftPrint").onclick=()=>w.print(); w.document.getElementById("ftClose").onclick=()=>w.close(); }catch(e){}
}
function coHeaderHTML(){ const c=co(), s=ds();
  return `<div class="co">${s.logo?`<img src="${s.logo}" alt="logo">`:""}<b>${esc(c.name||"")}</b>
    <div>${esc(c.legal||"")}</div><div>${esc(c.addr1||"")}</div><div>${esc(c.addr2||"")}</div>
    <div>${esc(c.phone||"")} · ${esc(c.email||"")} · ${esc(c.web||"")}</div>
    ${s.headerExtra?`<div>${esc(s.headerExtra)}</div>`:""}</div>`;
}
function coFooterHTML(){ const c=co(), s=ds();
  if(s.footerMode==="custom") return `<div class="foot">${esc(s.footerText||"")}</div>`;
  const bits=[c.legal,c.atout?("Atout France "+c.atout):"",c.rcp?("RCP "+c.rcp):"",c.garantie?("Garantie financière "+c.garantie):"",c.tvaMention].filter(Boolean);
  const bank=s.showBank!==false?`\nIBAN ${c.iban||""} · BIC ${c.bic||""}`:"";
  return `<div class="foot">${esc((c.name||"")+" — "+bits.join(" · ")+bank)}</div>`; }
function quoteTotals(q){ const ht=(q.items||[]).reduce((s,it)=>s+(Number(it.qty)||0)*(Number(it.unit)||0),0);
  const tva=ht*(Number(q.tvaRate)||0)/100; return {ht,tva,ttc:ht+tva}; }
function quoteDocHTML(q){ const t=quoteTotals(q); const c=co(); const isInv=q.kind==="facture";
  return `<div class="dhead">${coHeaderHTML()}<div class="dtitle"><h1>${isInv?"FACTURE":"DEVIS"}</h1><div class="num">${esc(q.number||"")}</div>
    <div class="dt">Date : ${fmtDate(q.date)}<br>${isInv?("Échéance : "+(q.due?fmtDate(q.due):esc(q.validity||"30")+" jours")):("Validité : "+esc(q.validity||"30")+" jours")}</div></div></div>
  <div class="blocks">
    <div class="block"><h4>Client</h4><div class="bd"><b>${esc(q.clientName||"—")}</b><br>${esc(q.clientAddr||"").replace(/\n/g,"<br>")}
      ${q.clientContact?"<br>À l'attention de "+esc(q.clientContact):""}${q.clientEmail?"<br>"+esc(q.clientEmail):""}</div></div>
    <div class="block"><h4>Objet</h4><div class="bd">${esc(q.object||"Organisation de séjour")}</div></div>
  </div>
  <table><thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">P.U. (€)</th><th class="r">Total (€)</th></tr></thead>
  <tbody>${(q.items||[]).map(it=>`<tr><td>${esc(it.label||"")}</td><td class="r">${Number(it.qty)||0}</td>
    <td class="r">${(Number(it.unit)||0).toLocaleString("fr-FR",{minimumFractionDigits:2})}</td>
    <td class="r">${((Number(it.qty)||0)*(Number(it.unit)||0)).toLocaleString("fr-FR",{minimumFractionDigits:2})}</td></tr>`).join("")}</tbody></table>
  <div class="totals">
    <div><span>Total HT</span><b>${t.ht.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</b></div>
    ${q.tvaRate?`<div><span>TVA ${q.tvaRate}%</span><b>${t.tva.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</b></div>`:`<div><span>TVA</span><b>${esc(c.tvaMention||"—")}</b></div>`}
    <div class="grand"><span>Total ${q.tvaRate?"TTC":"net"}</span><span>${t.ttc.toLocaleString("fr-FR",{minimumFractionDigits:2})} €</span></div>
  </div>
  ${q.conditions?`<div class="conditions"><b>Conditions</b>\n${esc(q.conditions)}</div>`:""}
  <div class="sign"><div>Pour ${esc(c.name||"")}<div class="line"></div></div>
    <div>Bon pour accord (date, signature, cachet)<div class="line"></div></div></div>
  ${coFooterHTML()}`;
}

let DOCS_TAB="quotes";
VIEWS.docs=()=>{
  $("#view").innerHTML=`
  <div class="pill-tabs" style="margin-bottom:18px">
    ${[["quotes","Devis & Factures"],["templates","Modèles de documents"],["company","Fiche société"],["style","Mise en page"]]
      .map(([k,l])=>`<button data-dt="${k}" class="${DOCS_TAB===k?'active':''}">${l}</button>`).join("")}
  </div><div id="docsBody"></div>`;
  $$("#view [data-dt]").forEach(b=>b.onclick=()=>{DOCS_TAB=b.dataset.dt;VIEWS.docs();});
  ({quotes:docsQuotes,templates:docsTemplates,company:docsCompany,style:docsStyle}[DOCS_TAB])();
};
let DOCS_KIND="devis";
function docsQuotes(){
  const q=DB.quotes.filter(x=>(x.kind||"devis")===DOCS_KIND);
  const isInv=DOCS_KIND==="facture";
  $("#docsBody").innerHTML=`
  <div class="toolbar">
    <div class="pill-tabs"><button data-k="devis" class="${!isInv?'active':''}">Devis</button><button data-k="facture" class="${isInv?'active':''}">Factures</button></div>
    <div class="spacer"></div><button class="btn primary" id="dq_add">+ ${isInv?"Nouvelle facture":"Nouveau devis"}</button></div>
  ${q.length?`<div class="tbl-wrap"><table><thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Montant</th><th>Statut</th><th></th></tr></thead>
    <tbody>${q.map(x=>{const t=quoteTotals(x);return `<tr>
      <td class="cell-strong mono">${esc(x.number)}</td><td>${esc(x.clientName||"—")}</td><td class="muted">${fmtDate(x.date)}</td>
      <td class="cell-strong">${eur(t.ttc)}</td><td>${statusTag("_",x.status)}</td>
      <td class="rowact"><button class="btn sm ghost" data-call="printQuote('${x.id}')">Imprimer</button>
      ${!isInv?`<button class="btn sm ghost" data-call="convertToInvoice('${x.id}')">→ Facture</button>`:""}
      <button class="btn sm ghost" data-call="editQuote('${x.id}')">Ouvrir</button>
      <button class="btn sm ghost" data-call="delQuote('${x.id}')">✕</button></td></tr>`;}).join("")}</tbody></table></div>`
    :`<div class="card"><div class="empty"><svg viewBox="0 0 24 24">${ICONS.doc}</svg><div>Aucun ${isInv?"e facture":" devis"}. ${isInv?"Créez-en une, ou convertissez un devis accepté.":"Créez votre premier devis — imprimable en PDF, pré-rempli avec votre fiche société."}</div></div></div>`}`;
  $$("#docsBody [data-k]").forEach(b=>b.onclick=()=>{DOCS_KIND=b.dataset.k;VIEWS.docs();});
  $("#dq_add").onclick=()=>editQuote(null,DOCS_KIND);
}
window.convertToInvoice=id=>{
  const d=DB.quotes.find(x=>x.id===id); if(!d)return;
  const inv={...structuredClone(d),id:uid(),kind:"facture",number:nextQuoteNumber("facture"),status:"Émise",date:Date.now(),
    due:Date.now()+30*864e5, sourceQuote:d.number};
  DB.quotes.unshift(inv); DB.settings.invoiceSeq=(DB.settings.invoiceSeq||1)+1;
  logAct(`Facture ${inv.number} créée depuis le devis ${d.number}`); save();
  DOCS_KIND="facture"; VIEWS.docs(); toast("Facture "+inv.number+" créée");
};
window.delQuote=id=>{ const q=DB.quotes.find(x=>x.id===id); confirmModal("Supprimer le devis ?",`« ${q?.number} » sera supprimé.`,()=>{DB.quotes=DB.quotes.filter(x=>x.id!==id);save();VIEWS.docs();},true); };
window.printQuote=id=>{ const q=DB.quotes.find(x=>x.id===id); if(q) printDocument("Devis "+q.number, quoteDocHTML(q)); };
function editQuote(id,kind){
  const k = id? (DB.quotes.find(x=>x.id===id)?.kind||"devis") : (kind||"devis");
  const isInv=k==="facture";
  const q = id? structuredClone(DB.quotes.find(x=>x.id===id)) : {
    kind:k, number:nextQuoteNumber(k), date:Date.now(), validity:"30", due:Date.now()+30*864e5,
    status:isInv?"Émise":"Brouillon",
    clientName:"",clientAddr:"",clientContact:"",clientEmail:"",object:"Organisation de séjour",
    items:[{label:"",qty:1,unit:0}], tvaRate:DB.settings.tvaDefault||0,
    conditions:isInv?"Règlement à réception, par virement (coordonnées bancaires en pied de page).":"Acompte de 30% à la commande, solde avant le départ.\nOffre valable pour la durée de validité indiquée." };
  const statusOpts = isInv? ["Émise","Payée","En retard","Annulée"] : ["Brouillon","Envoyé","Accepté","Refusé"];
  const partnerOpts=`<option value="">— Choisir un partenaire (T1) —</option>`+DB.partners.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  openModal({title:(id?"Modifier ":"Nouveau/nouvelle ")+(isInv?"facture":"devis"), wide:true,
    body:`<div class="row2">
      <div class="field"><label>N° ${isInv?"de facture":"de devis"}</label><input class="input" id="q_num" value="${esc(q.number)}"></div>
      <div class="field"><label>Statut</label><select id="q_status">${statusOpts.map(s=>`<option ${q.status===s?'selected':''}>${s}</option>`).join("")}</select></div>
    </div>
    <div class="field"><label>Pré-remplir depuis un partenaire</label><select id="q_partner">${partnerOpts}</select></div>
    <div class="row2">
      <div class="field"><label>Client (nom / raison sociale)</label><input class="input" id="q_cn" value="${esc(q.clientName)}"></div>
      <div class="field"><label>Contact</label><input class="input" id="q_cc" value="${esc(q.clientContact)}"></div>
    </div>
    <div class="row2">
      <div class="field"><label>Email client</label><input class="input" id="q_ce" value="${esc(q.clientEmail)}"></div>
      <div class="field"><label>Objet</label><input class="input" id="q_obj" value="${esc(q.object)}"></div>
    </div>
    <div class="field"><label>Adresse client</label><textarea id="q_ca" style="min-height:52px">${esc(q.clientAddr)}</textarea></div>
    <div class="row3">
      <div class="field"><label>Date</label><input class="input" type="date" id="q_date" value="${new Date(q.date).toISOString().slice(0,10)}"></div>
      <div class="field"><label>Validité (jours)</label><input class="input" id="q_val" value="${esc(q.validity)}"></div>
      <div class="field"><label>TVA (%)</label><input class="input" type="number" id="q_tva" value="${esc(q.tvaRate)}"></div>
    </div>
    <div class="section-title" style="margin-top:6px">Lignes du devis</div>
    <div id="q_items"></div>
    <button class="btn sm ghost" id="q_addline">+ Ajouter une ligne</button>
    <div id="q_total" style="text-align:right;font-weight:800;font-size:16px;margin-top:10px"></div>
    <div class="field" style="margin-top:12px"><label>Conditions</label><textarea id="q_cond" style="min-height:70px">${esc(q.conditions)}</textarea></div>`,
    footer:[{label:"Annuler",cls:"ghost",act:closeModal},
      {label:"Aperçu / Imprimer",cls:"",act:()=>{const nq=readQuoteForm(q);printDocument("Devis "+nq.number,quoteDocHTML(nq));}},
      {label:"Enregistrer",cls:"primary",act:()=>saveQuote(id)}]});
  // items editor
  let items=structuredClone(q.items||[]);
  const drawItems=()=>{
    $("#q_items").innerHTML=items.map((it,i)=>`<div class="row3" style="grid-template-columns:1fr 70px 90px 30px;gap:8px;margin-bottom:6px">
      <input class="input q_l" data-i="${i}" placeholder="Désignation" value="${esc(it.label)}">
      <input class="input q_q" data-i="${i}" type="number" placeholder="Qté" value="${esc(it.qty)}">
      <input class="input q_u" data-i="${i}" type="number" placeholder="P.U." value="${esc(it.unit)}">
      <button class="btn sm ghost q_x" data-i="${i}">✕</button></div>`).join("");
    $$("#q_items .q_l").forEach(el=>el.oninput=e=>{items[+e.target.dataset.i].label=e.target.value;});
    $$("#q_items .q_q").forEach(el=>el.oninput=e=>{items[+e.target.dataset.i].qty=e.target.value;upTot();});
    $$("#q_items .q_u").forEach(el=>el.oninput=e=>{items[+e.target.dataset.i].unit=e.target.value;upTot();});
    $$("#q_items .q_x").forEach(el=>el.onclick=()=>{items.splice(+el.dataset.i,1);drawItems();upTot();});
  };
  const upTot=()=>{ const t=quoteTotals({items,tvaRate:+$("#q_tva").value||0});
    $("#q_total").innerHTML=`Total ${(+$("#q_tva").value)?"TTC":"net"} : <span style="color:var(--brand-ink)">${eur(t.ttc)}</span>`; };
  $("#q_addline").onclick=()=>{items.push({label:"",qty:1,unit:0});drawItems();};
  $("#q_tva").oninput=upTot;
  $("#q_partner").onchange=e=>{ const p=DB.partners.find(x=>x.id===e.target.value); if(p){ $("#q_cn").value=p.name||""; $("#q_cc").value=p.contactName||""; $("#q_ce").value=p.email||""; } };
  drawItems(); upTot();
  // expose current draft + items for read
  editQuote._draft=q;
  editQuote._items=()=>items;
}
function readQuoteForm(base){
  return { ...base,
    number:$("#q_num").value, status:$("#q_status").value, clientName:$("#q_cn").value, clientContact:$("#q_cc").value,
    clientEmail:$("#q_ce").value, object:$("#q_obj").value, clientAddr:$("#q_ca").value,
    date:new Date($("#q_date").value||Date.now()).getTime(), validity:$("#q_val").value, tvaRate:+$("#q_tva").value||0,
    items:editQuote._items?editQuote._items():base.items, conditions:$("#q_cond").value };
}
function saveQuote(id){
  const base=id?DB.quotes.find(x=>x.id===id):(editQuote._draft||{kind:"devis"});
  const data=readQuoteForm(base);
  if(!data.clientName.trim()){ toast("Le nom du client est requis","warn"); return; }
  const label=data.kind==="facture"?"Facture":"Devis";
  if(id){ Object.assign(DB.quotes.find(x=>x.id===id),data); logAct(label+" modifié : "+data.number); }
  else{ DB.quotes.unshift({id:uid(),...data});
    if(data.kind==="facture") DB.settings.invoiceSeq=(DB.settings.invoiceSeq||1)+1; else DB.settings.quoteSeq=(DB.settings.quoteSeq||1)+1;
    logAct(label+" créé : "+data.number); }
  save(); closeModal(); DOCS_KIND=data.kind||"devis"; VIEWS.docs(); toast(label+" enregistré");
}
function nextQuoteNumber(kind){ const y=new Date().getFullYear();
  const seq = kind==="facture" ? (DB.settings.invoiceSeq||1) : (DB.settings.quoteSeq||1);
  return `${kind==="facture"?"F":"D"}-${y}-${String(seq).padStart(3,"0")}`; }

/* Document templates (free text with {{variables}}) */
const BUILTIN_TEMPLATES=[
  {id:"attestation", name:"Attestation de présence",
    body:`ATTESTATION DE PRÉSENCE\n\nJe soussigné(e), représentant {{societe}}, atteste que :\n\n{{participant}}\n\na bien participé au séjour / à la mobilité organisé(e) à {{lieu}},\ndu {{date_debut}} au {{date_fin}}.\n\nCette attestation est délivrée pour faire valoir ce que de droit.\n\nFait à {{fait_a}}, le {{fait_le}}.`,
    fields:[["participant","Participant (Nom Prénom)"],["lieu","Lieu du séjour"],["date_debut","Date de début"],["date_fin","Date de fin"],["fait_a","Fait à"],["fait_le","Le"]]},
  {id:"prospection", name:"Email de prospection (partenaire)",
    body:`Objet : Séjours immersifs à Sète pour vos apprenants\n\nBonjour {{contact}},\n\nJe me permets de vous contacter au nom de {{societe}}. Nous organisons des séjours linguistiques et culturels immersifs dans le Sud de la France (Sète / Montpellier), pour des groupes d'apprenants.\n\nSeriez-vous disponible pour un court échange afin d'étudier une collaboration pour {{periode}} ?\n\nBien cordialement,\n{{signataire}}\n{{societe}}`,
    fields:[["contact","Contact"],["periode","Période envisagée"],["signataire","Votre nom"]]},
  {id:"engagement", name:"Conditions de prise en charge (participant)",
    body:`CONDITIONS DE PRISE EN CHARGE — {{societe}}\n\nParticipant : {{participant}}\nSéjour : {{lieu}}, du {{date_debut}} au {{date_fin}}.\n\nCE QUI EST COMPRIS : hébergement, repas prévus au programme, activités et visites prévues, transports collectifs du programme, encadrement pédagogique.\n\nCE QUI N'EST PAS PRIS EN CHARGE : dépenses personnelles, repas hors programme, frais de santé (couverts par la carte CEAM et l'assurance), amendes ou dégradations.\n\nRÈGLE D'OR : toute dépense non prévue doit être validée PAR ÉCRIT par {{societe}} AVANT d'être engagée.\n\nFait à {{fait_a}}, le {{fait_le}}.\nSignature du participant (ou représentant légal si mineur) :`,
    fields:[["participant","Participant"],["lieu","Lieu"],["date_debut","Date de début"],["date_fin","Date de fin"],["fait_a","Fait à"],["fait_le","Le"]]},
];
function allTemplates(){ return [...BUILTIN_TEMPLATES, ...(DB.docs||[])]; }
function docsTemplates(){
  $("#docsBody").innerHTML=`
  <div class="helpbox">${ic2("info")}<div>Choisissez un modèle : les champs société se remplissent tout seuls, vous complétez le reste, puis vous imprimez / exportez en PDF. Tous les modèles sont <b>modifiables</b> — même ceux fournis (bouton « Personnaliser »). Créez les vôtres avec des variables <code class="k">{{ma_variable}}</code>.</div></div>
  <div class="toolbar"><div class="spacer"></div><button class="btn ghost sm" id="dt_new">+ Nouveau modèle</button></div>
  <div class="grid cards">${allTemplates().map(t=>`<div class="card hover">
    <div style="display:flex;align-items:center;gap:8px"><div class="cell-strong" style="font-size:15px">${esc(t.name)}</div>${t.custom?'<span class="tag a">perso</span>':'<span class="tag n">fourni</span>'}</div>
    <div class="muted" style="font-size:12px;margin:6px 0 12px">${esc((t.body||"").slice(0,80))}…</div>
    <button class="btn sm primary" data-call="fillTemplate('${t.id}')">Utiliser</button>
    ${t.custom?`<button class="btn sm ghost" data-call="editTemplate('${t.id}')">Modifier</button><button class="btn sm ghost" data-call="delTemplate('${t.id}')">Supprimer</button>`
      :`<button class="btn sm ghost" data-call="personalizeTemplate('${t.id}')">Personnaliser</button>`}</div>`).join("")}</div>`;
  $("#dt_new").onclick=()=>editTemplate();
}
window.delTemplate=id=>{ confirmModal("Supprimer le modèle ?","Ce modèle personnalisé sera supprimé.",()=>{DB.docs=(DB.docs||[]).filter(t=>t.id!==id); save(); VIEWS.docs();},true); };
window.personalizeTemplate=id=>{ const b=BUILTIN_TEMPLATES.find(t=>t.id===id); if(!b)return;
  DB.docs=DB.docs||[]; const copy={id:uid(),name:b.name+" (copie)",body:b.body,custom:true,fields:b.fields}; DB.docs.push(copy);
  save(); editTemplate(copy.id); };
function editTemplate(id){
  const t=id?(DB.docs||[]).find(x=>x.id===id):null;
  openModal({title:t?"Modifier le modèle":"Nouveau modèle", wide:true,
    body:`<div class="field"><label>Nom du modèle *</label><input class="input" id="tp_name" value="${esc(t?.name||"")}" placeholder="Ma lettre type"></div>
    <div class="field"><label>Contenu (utilisez {{variable}} pour les champs à remplir ; {{societe}} est automatique)</label>
    <textarea id="tp_body" style="min-height:240px" placeholder="Cher {{contact}}, ...">${esc(t?.body||"")}</textarea></div>
    <p class="muted" style="font-size:12px;font-weight:600;margin:0">L'en-tête (logo, coordonnées) et le pied de page sont appliqués automatiquement, et se règlent dans l'onglet « Mise en page ».</p>`,
    footer:[{label:"Annuler",cls:"ghost",act:closeModal},{label:t?"Enregistrer":"Créer",cls:"primary",act:()=>{
      const name=$("#tp_name").value.trim(),body=$("#tp_body").value;
      if(!name||!body){toast("Nom et contenu requis","warn");return;}
      const vars=[...new Set((body.match(/\{\{(\w+)\}\}/g)||[]).map(v=>v.slice(2,-2)))].filter(v=>v!=="societe");
      const fields=vars.map(v=>[v,v.replace(/_/g," ")]);
      if(t){ Object.assign(t,{name,body,fields}); } else { DB.docs=DB.docs||[]; DB.docs.push({id:uid(),name,body,custom:true,fields}); }
      save();closeModal();VIEWS.docs();toast("Modèle enregistré");}}]});
}
function docsStyle(){
  const s=ds();
  $("#docsBody").innerHTML=`
  <div class="helpbox">${ic2("info")}<div>L'en-tête et le pied de page de <b>tous</b> vos documents (devis, attestations…). Modifiable à tout moment — les changements s'appliquent partout, immédiatement.</div></div>
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px;align-items:start">
    <div class="card">
      <div class="section-title" style="margin-top:0">Logo & couleur</div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
        <div style="width:120px;height:60px;border:1px dashed var(--line);border-radius:10px;display:grid;place-items:center;overflow:hidden;background:var(--panel-2)">
          ${s.logo?`<img src="${s.logo}" style="max-width:100%;max-height:100%">`:'<span class="muted" style="font-size:11px">Aucun logo</span>'}</div>
        <div><button class="btn sm" id="st_logo">Choisir un logo</button>
        ${s.logo?'<button class="btn sm ghost" id="st_logo_x">Retirer</button>':''}
        <input type="file" id="st_logofile" accept="image/*" style="display:none"></div>
      </div>
      <div class="field"><label>Couleur d'accent</label>
        <div style="display:flex;gap:10px;align-items:center"><input type="color" id="st_accent" value="${esc(s.accent||"#1d5fd6")}" style="width:52px;height:38px;border:1px solid var(--line);border-radius:8px;background:none;cursor:pointer">
        <input class="input" id="st_accent2" value="${esc(s.accent||"#1d5fd6")}" style="max-width:120px"></div></div>
      <div class="field"><label>Ligne d'en-tête supplémentaire (optionnel)</label><input class="input" id="st_hx" value="${esc(s.headerExtra||"")}" placeholder="Ex : Tour-opérateur réceptif · Sète"></div>
    </div>
    <div class="card">
      <div class="section-title" style="margin-top:0">Pied de page</div>
      <div class="field"><label>Type de pied de page</label>
        <select id="st_fmode"><option value="auto" ${s.footerMode!=="custom"?"selected":""}>Automatique (mentions légales + IBAN)</option>
        <option value="custom" ${s.footerMode==="custom"?"selected":""}>Personnalisé (texte libre)</option></select></div>
      <div class="field"><label>Texte du pied de page personnalisé</label><textarea id="st_ftext" style="min-height:70px" placeholder="Votre mention de pied de page…">${esc(s.footerText||"")}</textarea></div>
      <div class="checkline" style="cursor:pointer" id="st_bankline"><div class="chk ${s.showBank!==false?'on':''}" id="st_bank"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></div><div>Afficher l'IBAN / BIC dans le pied automatique</div></div>
    </div>
  </div>
  <div class="toolbar" style="margin-top:16px"><button class="btn primary" id="st_save">Enregistrer la mise en page</button>
    <button class="btn ghost" id="st_preview">Aperçu (document exemple)</button></div>`;
  const pick=()=>$("#st_logofile").click();
  $("#st_logo").onclick=pick;
  $("#st_logo_x")&&($("#st_logo_x").onclick=()=>{ DB.settings.docStyle.logo=""; save(); VIEWS.docs(); });
  $("#st_logofile").onchange=e=>{ const f=e.target.files[0]; if(!f)return;
    if(f.size>600000){ toast("Logo trop lourd (max ~500 Ko)","warn"); return; }
    const rd=new FileReader(); rd.onload=()=>{ DB.settings.docStyle.logo=rd.result; save(); VIEWS.docs(); toast("Logo enregistré"); }; rd.readAsDataURL(f); };
  $("#st_accent").oninput=e=>$("#st_accent2").value=e.target.value;
  $("#st_accent2").oninput=e=>{ if(/^#[0-9a-fA-F]{6}$/.test(e.target.value)) $("#st_accent").value=e.target.value; };
  $("#st_bankline").onclick=()=>{ const c=$("#st_bank"); c.classList.toggle("on"); };
  $("#st_save").onclick=()=>{ Object.assign(DB.settings.docStyle,{ accent:$("#st_accent").value, headerExtra:$("#st_hx").value,
    footerMode:$("#st_fmode").value, footerText:$("#st_ftext").value, showBank:$("#st_bank").classList.contains("on") });
    save(); toast("Mise en page enregistrée"); };
  $("#st_preview").onclick=()=>{ Object.assign(DB.settings.docStyle,{ accent:$("#st_accent").value, headerExtra:$("#st_hx").value,
    footerMode:$("#st_fmode").value, footerText:$("#st_ftext").value, showBank:$("#st_bank").classList.contains("on") });
    const demo={number:"D-2026-000",date:Date.now(),validity:"30",clientName:"Client Exemple",clientAddr:"12 rue de la Démo\n34200 Sète",object:"Séjour d'exemple",items:[{label:"Séjour immersif 8 jours",qty:10,unit:790}],tvaRate:0,conditions:"Acompte de 30% à la commande."};
    printDocument("Aperçu",quoteDocHTML(demo)); };
}
window.fillTemplate=id=>{
  const t=allTemplates().find(x=>x.id===id); if(!t)return;
  openModal({title:t.name, wide:true,
    body:`${(t.fields||[]).map(([k,l])=>`<div class="field"><label>${esc(l)}</label><input class="input" data-tf="${k}"></div>`).join("")||'<p class="muted">Ce modèle n\'a pas de champ à remplir.</p>'}`,
    footer:[{label:"Annuler",cls:"ghost",act:closeModal},{label:"Aperçu / Imprimer",cls:"primary",act:()=>{
      const vals={societe:co().name||""}; $$(".mbody [data-tf]").forEach(el=>vals[el.dataset.tf]=el.value);
      let out=t.body.replace(/\{\{(\w+)\}\}/g,(_,k)=>vals[k]!=null&&vals[k]!==""?vals[k]:"________");
      const inner=`<div class="dhead">${coHeaderHTML()}<div class="dtitle"><h1 style="font-size:20px;letter-spacing:1px">${esc(t.name.toUpperCase())}</h1></div></div>
        <div class="doc-body">${esc(out)}</div>${coFooterHTML()}`;
      printDocument(t.name,inner);
    }}]});
};

function docsCompany(){
  const c=co();
  const f=(k,l,ta)=> ta? `<div class="field" style="grid-column:1/-1"><label>${l}</label><textarea data-c="${k}" style="min-height:44px">${esc(c[k]||"")}</textarea></div>`
    : `<div class="field"><label>${l}</label><input class="input" data-c="${k}" value="${esc(c[k]||"")}"></div>`;
  $("#docsBody").innerHTML=`
  <div class="helpbox">${ic2("info")}<div>Ces informations alimentent <b>automatiquement</b> tous vos devis et documents — vous ne les ressaisissez jamais. Pré-rempli avec les données trouvées ; vérifiez et complétez (surtout Atout France, RCP et garantie financière, laissés vides à dessein).</div></div>
  <div class="card"><div class="row2">
    ${f("name","Nom / raison sociale")}${f("phone","Téléphone")}
    ${f("email","Email")}${f("web","Site web")}
    ${f("legal","Forme juridique & RCS",true)}
    ${f("addr1","Adresse (siège)",true)}${f("addr2","Adresse (bureau)",true)}
    ${f("iban","IBAN")}${f("bic","BIC")}
    ${f("atout","N° Atout France")}${f("rcp","Assurance RC Pro")}
    ${f("garantie","Garantie financière")}${f("tvaMention","Mention TVA",true)}
  </div>
  <button class="btn primary" id="dc_save" style="margin-top:8px">Enregistrer la fiche société</button></div>`;
  $("#dc_save").onclick=()=>{ const nc={...co()}; $$("#docsBody [data-c]").forEach(el=>nc[el.dataset.c]=el.value);
    DB.settings.company=nc; save(); toast("Fiche société enregistrée"); };
}

/* ---------- Automatisations ---------- */
VIEWS.automations=()=>{
  $("#view").innerHTML=`
  <div class="helpbox">${ic2("info")}<div>Créez des règles <b>QUAND … ALORS …</b> qui s'exécutent automatiquement dans l'outil, sans Make ni Zapier. Ex : « Quand un partenaire passe en <i>Devis envoyé</i>, alors créer une tâche de relance ».</div></div>
  <div class="toolbar"><div class="spacer"></div><button class="btn primary" id="au_add">+ Automatisation</button></div>
  <div id="au_list"></div>`;
  $("#au_add").onclick=()=>editAuto(null);
  drawAutos();
};
function drawAutos(){
  const a=DB.automations;
  $("#au_list").innerHTML=a.length? a.map(x=>`<div class="card" style="display:flex;align-items:center;gap:14px;margin-bottom:10px">
    <div class="switch ${x.on?'on':''}" data-toggle="${x.id}"><i></i></div>
    <div style="flex:1">
      <div class="cell-strong">${esc(x.name)}</div>
      <div class="muted" style="font-size:12.5px;margin-top:2px">QUAND <b>${esc(Automations.EVENTS[x.event]||x.event)}</b>${x.condField?` · SI ${esc(x.condField)} contient « ${esc(x.condValue)} »`:""} → <b>${esc(Automations.ACTIONS[x.action]||x.action)}</b>${x.actionValue?` : ${esc(x.actionValue)}`:""}</div>
    </div>
    <button class="btn sm ghost" data-edit="${x.id}">Modifier</button>
    <button class="btn sm ghost" data-del="${x.id}">✕</button></div>`).join("")
    : `<div class="card"><div class="empty"><svg viewBox="0 0 24 24">${ICONS.auto}</svg><div>Aucune automatisation. Créez votre première règle.</div></div></div>`;
  $$("#au_list [data-toggle]").forEach(b=>b.onclick=()=>{const x=DB.automations.find(y=>y.id===b.dataset.toggle);x.on=!x.on;save();drawAutos();toast(x.on?"Activée":"Désactivée");});
  $$("#au_list [data-edit]").forEach(b=>b.onclick=()=>editAuto(b.dataset.edit));
  $$("#au_list [data-del]").forEach(b=>b.onclick=()=>{DB.automations=DB.automations.filter(y=>y.id!==b.dataset.del);save();drawAutos();});
}
function editAuto(id){
  const it=id?DB.automations.find(x=>x.id===id):{on:true,event:"partner.status",action:"task"};
  const evOpts=Object.entries(Automations.EVENTS).map(([k,v])=>`<option value="${k}" ${it.event===k?'selected':''}>${esc(v)}</option>`).join("");
  const acOpts=Object.entries(Automations.ACTIONS).map(([k,v])=>`<option value="${k}" ${it.action===k?'selected':''}>${esc(v)}</option>`).join("");
  openModal({title:id?"Modifier l'automatisation":"Nouvelle automatisation", wide:true,
    body:`<div class="field"><label>Nom de la règle *</label><input class="input" id="a_name" value="${esc(it.name||"")}" placeholder="Relance après devis"></div>
    <div class="row2"><div class="field"><label>QUAND (déclencheur)</label><select id="a_ev">${evOpts}</select></div>
    <div class="field"><label>ALORS (action)</label><select id="a_ac">${acOpts}</select></div></div>
    <div class="row2"><div class="field"><label>SI (champ, optionnel)</label><input class="input" id="a_cf" value="${esc(it.condField||"")}" placeholder="status"></div>
    <div class="field"><label>… contient</label><input class="input" id="a_cv" value="${esc(it.condValue||"")}" placeholder="Devis"></div></div>
    <div class="field"><label>Valeur de l'action (texte de la tâche / notification). Variables : {name}, {status}…</label><input class="input" id="a_av" value="${esc(it.actionValue||"")}" placeholder="Relancer {name} sur le devis"></div>`,
    footer:[{label:"Annuler",cls:"ghost",act:closeModal},{label:"Enregistrer",cls:"primary",act:()=>{
      const name=$("#a_name").value.trim(); if(!name){toast("Nom requis","warn");return;}
      const obj={name,event:$("#a_ev").value,action:$("#a_ac").value,condField:$("#a_cf").value.trim(),condValue:$("#a_cv").value.trim(),actionValue:$("#a_av").value.trim(),on:it.on!==false};
      if(id){Object.assign(it,obj);}else{DB.automations.push({id:uid(),...obj});}
      save();closeModal();drawAutos();toast("Automatisation enregistrée");}}]});
}

/* ---------- Guide ---------- */
VIEWS.guide=()=>{
  const cards=[
    ["Scraper LinkedIn / Web","Récupérez emails et téléphones directement depuis un profil LinkedIn ou en lançant une recherche web multi-pages (nécessite d'installer l'extension — voir ci-dessous)."],
    ["Chercheur de contacts","Devinez des emails (nom + domaine), extrayez les contacts d'une page collée, apprenez le modèle d'une boîte, vérifiez la validité. Hors-ligne."],
    ["T1 Partenaires","Votre CRM de prospection : CFA, écoles, OPCO. Glissez les cartes dans le Kanban pour changer de statut."],
    ["T2 Projets","Chaque mobilité + sa conformité R1→R8. Ouvrez un projet pour cocher les 8 cases audit."],
    ["T3 Participants","Apprenants, mineurs, assurances, statut de dossier."],
    ["Finances","Calculateur de marge séjour + lignes budgétaires + enveloppe Erasmus. La marge remonte au tableau de bord."],
    ["Devis & documents","Devis, factures, attestations, modèles — pré-remplis, personnalisables, imprimables en PDF."],
    ["Automatisations","Règles QUAND/ALORS qui remplacent Make. Elles tournent dans l'outil, sans service externe."],
    ["Sauvegarde","Tout est enregistré en continu. Exportez régulièrement un fichier de sauvegarde (Réglages)."],
  ];
  $("#view").innerHTML=`
  <div class="helpbox">${ic2("info")}<div>Cet outil est <b>100% autonome</b> : aucun serveur, aucune API, aucun abonnement. Il fonctionne même sans connexion et ne dépend d'aucun autre logiciel — donc il ne peut pas « tomber en panne » à cause d'un service tiers. Pensez seulement à exporter une sauvegarde de temps en temps.</div></div>
  <div class="card" style="margin-bottom:16px;border-left:4px solid var(--accent)">
    <div class="section-title" style="margin-top:0">Installer l'extension (pour le scraping LinkedIn & web)</div>
    <ol style="margin:0;padding-left:20px;line-height:1.9;font-weight:600">
      <li>Téléchargez le dossier de l'outil (ZIP) et décompressez-le.</li>
      <li>Ouvrez Chrome → <code class="k">chrome://extensions</code> → activez « Mode développeur » (en haut à droite).</li>
      <li>Cliquez « Charger l'extension non empaquetée » et sélectionnez le dossier décompressé (celui qui contient directement <code class="k">manifest.json</code>).</li>
      <li>Cliquez l'icône de l'extension pour ouvrir l'outil. L'onglet « Scraper LinkedIn / Web » est alors actif.</li>
    </ol>
    <p class="muted" style="font-weight:600;margin:10px 0 0">Sans extension, l'outil fonctionne quand même : utilisez le bookmarklet ou « Extraire d'une page ».</p>
  </div>
  <div class="grid cards">${cards.map(([t,d])=>`<div class="card hover"><div class="cell-strong" style="margin:0 0 4px;font-size:15px">${esc(t)}</div><div class="muted" style="font-weight:600">${esc(d)}</div></div>`).join("")}</div>
  <div class="section-title">Où va quoi (rappel Erasmus)</div>
  <div class="card"><table style="min-width:auto"><tbody>
    <tr><td class="cell-strong">Vers Erasmus (en ligne)</td><td>Rapport participant + données de mobilité (Beneficiary Module). Le reste : à garder 5 ans, montré seulement en cas de contrôle.</td></tr>
    <tr><td class="cell-strong">Vers l'OPCO</td><td>(Apprenti) convention de mise à disposition + avenant + factures.</td></tr>
    <tr><td class="cell-strong">Vers CPAM/MSA</td><td>(Apprenti) déclaration de maintien de sécurité sociale.</td></tr>
    <tr><td class="cell-strong">Vous recevez de l'Agence</td><td>Accréditation + convention de subvention → à classer.</td></tr>
  </tbody></table></div>`;
};

/* ---------- Settings ---------- */
VIEWS.settings=()=>{
  const s=DB.settings;
  $("#view").innerHTML=`
  <div class="grid" style="grid-template-columns:1fr 1fr">
    <div class="card">
      <div class="section-title" style="margin-top:0">Objectifs & hypothèses (calcul inverse)</div>
      <div class="field"><label>Objectif de CA (€)</label><input class="input" type="number" id="s_ca" value="${esc(s.caTarget)}"></div>
      <div class="field"><label>Panier moyen / vente (€)</label><input class="input" type="number" id="s_panier" value="${esc(s.panier)}"></div>
      <div class="row3">
        <div class="field"><label>Taux devis→vente</label><input class="input" type="number" step="0.01" id="s_cd" value="${esc(s.convDevis)}"></div>
        <div class="field"><label>Taux rdv→devis</label><input class="input" type="number" step="0.01" id="s_cr" value="${esc(s.convRdv)}"></div>
        <div class="field"><label>Taux contact→rdv</label><input class="input" type="number" step="0.01" id="s_cc" value="${esc(s.convContact)}"></div>
      </div>
      <button class="btn primary" id="s_save">Enregistrer</button>
    </div>
    <div class="card">
      <div class="section-title" style="margin-top:0">Sauvegarde & données</div>
      <p class="muted" style="font-weight:600;margin-top:0">Vos données sont enregistrées <b>dans ce navigateur / cette extension</b>, sur cet ordinateur. Elles restent après fermeture et redémarrage. <b>Mais</b> si vous désinstallez l'extension ou changez d'ordinateur, elles ne suivent pas toutes seules.</p>
      <p class="muted" style="font-weight:600">La solution sûre, sans dépendre d'aucun service : <b>exportez un fichier de sauvegarde</b> et gardez-le (sur votre Drive, une clé USB…). Pour changer d'ordinateur ou après une réinstallation : <b>importez</b> ce fichier.</p>
      <div style="font-size:12.5px;font-weight:600;color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:12px">Dernière sauvegarde : <b>${DB.settings.lastBackup?fmtDate(DB.settings.lastBackup):"jamais — à faire dès maintenant"}</b></div>
      <button class="btn primary" id="s_exp" style="width:100%;margin-bottom:10px">Exporter toutes les données (fichier de sauvegarde)</button>
      <button class="btn" id="s_imp" style="width:100%;margin-bottom:10px">Importer une sauvegarde</button>
      <input type="file" id="s_file" accept="application/json" style="display:none">
      <div class="divider"></div>
      <div class="stat-mini muted" style="font-weight:600">Contenu actuel :</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
        ${["partners","projects","participants","providers","budget","tasks","contacts","automations"].map(k=>`<span class="tag n">${k} : ${DB[k].length}</span>`).join("")}
      </div>
      <div class="divider"></div>
      <button class="btn ghost" id="s_reset" style="color:var(--bad)">Réinitialiser toutes les données</button>
    </div>
  </div>`;
  $("#s_save").onclick=()=>{ Object.assign(DB.settings,{caTarget:+$("#s_ca").value||0,panier:+$("#s_panier").value||1,
    convDevis:+$("#s_cd").value||.3,convRdv:+$("#s_cr").value||.25,convContact:+$("#s_cc").value||.35}); save(); toast("Réglages enregistrés"); };
  $("#s_exp").onclick=exportDB;
  $("#s_imp").onclick=()=>$("#s_file").click();
  $("#s_file").onchange=importDB;
  $("#s_reset").onclick=()=>confirmModal("Tout réinitialiser ?","Toutes vos données seront effacées de ce navigateur. Exportez d'abord une sauvegarde !",()=>{DB=structuredClone(DEFAULT_DB);saveNow();renderNav();go("dash");toast("Réinitialisé");},true);
};

/* ---------- Export / Import ---------- */
function exportDB(){
  DB.settings.lastBackup=Date.now(); saveNow();
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=`formaskills-travel-os_${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(a.href); toast("Sauvegarde exportée — conservez ce fichier en lieu sûr");
  renderNav(); if(CURRENT==="dash"||CURRENT==="settings") VIEWS[CURRENT]();
}
function importDB(e){
  const f=e.target.files[0]; if(!f) return; const rd=new FileReader();
  rd.onload=()=>{ try{ const d=migrate(JSON.parse(rd.result)); DB=d; saveNow(); renderNav(); go("dash"); toast("Sauvegarde importée"); }
    catch(err){ toast("Fichier invalide","bad"); } };
  rd.readAsText(f);
}
function exportCSV(name,cols,rows){
  const head=cols.join(",");
  const esc=v=>{ v=(v==null?"":String(v)).replace(/"/g,'""'); return /[",\n]/.test(v)?`"${v}"`:v; };
  const body=rows.map(r=>cols.map(c=>esc(r[c])).join(",")).join("\n");
  const blob=new Blob(["﻿"+head+"\n"+body],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${name}.csv`; a.click();
  URL.revokeObjectURL(a.href); toast("CSV exporté");
}

/* ============================================================
   6. AMORÇAGE
   ============================================================ */
function applyTheme(){ const dark=DB.settings.theme==="dark"; document.documentElement.setAttribute("data-theme",dark?"dark":"light");
  $("#themeBtn").textContent=dark?"Thème clair":"Thème sombre"; }
$("#themeBtn").onclick=()=>{ DB.settings.theme=DB.settings.theme==="dark"?"light":"dark"; save(); applyTheme(); };
$("#backupBtn").onclick=exportDB;
$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
$("#quickAdd").onclick=()=>{
  const map={partners:"partners",projects:"projects",participants:"participants",providers:"providers",tasks:"tasks"};
  if(map[CURRENT]) return editEntity(CURRENT,null);
  if(CURRENT==="finance") return editBudget(null);
  if(CURRENT==="docs"){ DOCS_TAB="quotes"; return editQuote(null); }
  if(CURRENT==="automations") return editAuto(null);
  if(CURRENT==="finder"){ FINDER_TAB="find"; return go("finder"); }
  // default: quick partner
  editEntity("partners",null);
};

// check overdue tasks on load (task.overdue automations)
function checkOverdue(){ const od=DB.tasks.filter(t=>t.status!=="Fait"&&t.due&&t.due<Date.now());
  od.forEach(t=>Automations.run("task.overdue",{...t,_entity:"tasks",_id:t.id})); }

// Seed demo activity note on very first run
if(!localStorage.getItem(KEY)){ logAct("Bienvenue — Travel OS initialisé."); saveNow(); }

applyTheme();
renderNav();
go("dash");
checkOverdue();
hydrateFromChrome();
window.addEventListener("beforeunload",saveNow);
