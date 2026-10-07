/* ============================================================
   FORMASKILLS TRAVEL OS — suite de non-régression (versionnée)
   ============================================================
   Lancer :  node tests/regression.mjs
   - Sert l'app avec l'entête CSP MV3 (script-src 'self') et vérifie
     chaque module + ZÉRO pageerror + ZÉRO violation CSP.
   - Les pages Google / Maps sont simulées sous le vrai hostname
     www.google.com (interception réseau) : aucun accès Internet requis.
   - Le réseau (Gmail, Nominatim, OSRM) est simulé : 100% hors-ligne.
   Variables optionnelles : CHROMIUM=/chemin/chrome  PLAYWRIGHT=/chemin/playwright/index.js
   Ce fichier est versionné exprès : il survit à toute réinitialisation
   de l'environnement (rien ne doit se perdre — même les tests). */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PW = process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright/index.js";
const CHROME = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const pw = (await import(pathToFileURL(PW).href)).default;
const { chromium } = pw;
const MIME = { ".html":"text/html", ".js":"text/javascript", ".json":"application/json", ".png":"image/png", ".css":"text/css" };

const server = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split("?")[0]); if(p==="/") p="/index.html";
  res.setHeader("Content-Security-Policy","script-src 'self'; object-src 'self'");
  fs.readFile(path.join(ROOT,p),(err,data)=>{ if(err){res.writeHead(404);res.end("nf");return;}
    res.setHeader("Content-Type", MIME[path.extname(p)]||"application/octet-stream"); res.writeHead(200); res.end(data); });
});
await new Promise(r=>server.listen(0,r));
const PORT = server.address().port, APP = `http://localhost:${PORT}/index.html`;
const SCRAPECORE = fs.readFileSync(path.join(ROOT,"scrape-core.js"),"utf8");

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
const errors=[], csp=[];
page.on("pageerror",e=>errors.push(String(e)));
page.on("console",m=>{ const t=m.text(); if(/Content Security Policy|Refused to/i.test(t)) csp.push(t); });

let PASS=0, FAIL=0, SECTION="";
const ok=(c,m)=>{ if(c) PASS++; else { FAIL++; console.log(`  FAIL [${SECTION}] ${m}`); } };
const section=n=>{ SECTION=n; };
const ev=(fn,arg)=>page.evaluate(fn,arg);
const fresh=async()=>{ await page.goto(APP,{waitUntil:"networkidle"}); await page.waitForTimeout(200); };
const closeM=()=>ev(()=>{ try{ closeModal(); }catch(e){} });
const clickLastFooter=()=>ev(()=>{ const b=[...document.querySelectorAll(".mfoot .btn")]; b[b.length-1].click(); });

/* ---------- 1. Scraping (fixtures Google / Maps sous hostname réel) ---------- */
section("scrape");
const SERP=`<!doctype html><html><head><meta charset="utf-8"><title>écoles sète - Recherche Google</title></head><body>
<div class="g"><a href="https://www.lycee-valery.fr/f"><h3>Lycée Paul Valéry — Sète</h3></a></div>
<div class="g"><a href="https://ecole-abc.fr/"><h3>École ABC - Langues</h3></a></div>
<div class="g"><a href="https://www.youtube.com/watch?v=x"><h3>Vidéo</h3></a></div>
<div class="g"><a href="https://www.facebook.com/l"><h3>FB</h3></a></div>
<p>Contact : direction [at] lycee-valery [dot] fr — RH : rh &#64;lycee-valery&#46;fr — Standard 04 67 00 11 22 — SIRET 000225039 — 2026 2025</p>
</body></html>`;
const MAPS=`<!doctype html><html><head><meta charset="utf-8"><title>restaurants - Google Maps</title></head><body><div role="feed">
<div role="article"><div role="heading">Restaurant Le Sud</div><span>12 rue Danton, Sète</span><a href="tel:+33467001122">x</a><a href="https://www.le-sud-sete.fr">Site</a></div>
<div role="article"><div role="heading">La Table Marine</div><span>3 quai Durand</span><a href="tel:0467334455">x</a></div></div></body></html>`;
await page.route(/https:\/\/www\.google\.com\/.*/, r=>r.fulfill({status:200,contentType:"text/html",body:/\/maps/.test(r.request().url())?MAPS:SERP}));
await page.goto("https://www.google.com/search?q=ecoles",{waitUntil:"domcontentloaded"});
await page.addScriptTag({content:SCRAPECORE});
const s = await ev(()=>window.ftPageScrape());
const doms=(s.results||[]).map(r=>r.domain);
ok(s.isSerp===true, "SERP détectée");
ok(doms.includes("lycee-valery.fr") && doms.includes("ecole-abc.fr"), "SERP: entreprises extraites");
ok(!doms.some(d=>/youtube|facebook|google/.test(d)), "SERP: bruit filtré");
ok(s.emails.includes("direction@lycee-valery.fr") && s.emails.includes("rh@lycee-valery.fr"), "dé-obfuscation emails");
ok(s.phones.includes("04 67 00 11 22") && !s.phones.some(p=>/000225039|2026/.test(p)), "téléphones stricts (rejet SIRET/années)");
await page.goto("https://www.google.com/maps/search/resto",{waitUntil:"domcontentloaded"});
await page.addScriptTag({content:SCRAPECORE});
const m = await ev(()=>window.ftPageScrape());
const sud=(m.businesses||[]).find(b=>b.name==="Restaurant Le Sud");
ok(m.isMaps && (m.businesses||[]).length===2, "Maps: 2 fiches entreprise");
ok(sud && sud.phone==="04 67 00 11 22" && /le-sud-sete/.test(sud.website) && /Danton/.test(sud.address), "Maps: tél normalisé + site + adresse");
await page.unroute(/https:\/\/www\.google\.com\/.*/);

/* ---------- 2. App : toutes les vues sous CSP ---------- */
await fresh();
section("vues");
await ev(()=>{ const now=Date.now(), day=864e5;
  DB.partners=[{id:"pt1",name:"Lycée Valéry",type:"École",status:"En discussion"}];
  DB.projects=[{id:"pr1",name:"Immersion Sète 2026",city:"Sète",country:"France",start:now+15*day,end:now+19*day}];
  DB.participants=[{id:"pa1",name:"Marco Rossi",project:"Immersion Sète 2026",status:"Incomplet"}];
  DB.providers=[{id:"pv1",name:"Hôtel",type:"Hébergement"}];
  DB.tasks=[{id:"tk1",title:"Conventions",status:"À faire",due:now-day}];
  DB.contacts=[{id:"c1",name:"Alice",company:"École X",email:"alice@x.fr",stage:"En discussion",value:4000,tags:["Écoles"]}];
  DB.quotes=[{id:"q1",kind:"devis",number:"D-2026-001",date:now,status:"Envoyé",clientName:"École X",items:[{label:"Séjour",qty:10,unit:790}],tvaRate:0}];
  DB.experiences=[{id:"e1",name:"Musée Fabre",category:"Musée",city:"Montpellier",price:8,lat:43.61,lng:3.88}];
  DB.itineraries=[{id:"it1",name:"Séjour A",participants:10,days:[{id:"d1",label:"Jour 1",items:[{expId:"e1",mode:"walk"}]}]}];
  DB.docRegistry=[{id:"dr1",dossier:"Général",title:"RC Pro",status:"Manquant"}];
  save(); });
const navIds = await ev(()=>NAV.filter(n=>n.id).map(n=>n.id));
for(const id of navIds){ await ev(i=>go(i),id); await page.waitForTimeout(40); }
ok(navIds.length>=18, `nav complète (${navIds.length} vues)`);
ok(errors.length===0, "toutes les vues rendues sans erreur");
await ev(()=>{ go("projects"); editEntity("projects","pr1"); }); await closeM();
await ev(()=>openDocGen("projects","pr1")); await closeM();
await ev(()=>{ go("docs"); editQuote("q1"); }); await closeM();
await ev(()=>{ go("finder"); FINDER_TAB="saved"; VIEWS.finder(); openContactCard("c1"); }); await closeM();
await ev(()=>{ go("experiences"); openExpEntry("e1"); }); await closeM();
await ev(()=>{ go("participants"); openParticipantIntake(); }); await closeM();
ok(errors.length===0, "modaux clés ouverts sans erreur");
const dup = await ev(()=>{ const c={},d=[]; document.querySelectorAll("[id]").forEach(e=>{ c[e.id]=(c[e.id]||0)+1; if(c[e.id]===2) d.push(e.id); }); return d; });
ok(dup.length===0, "aucun ID HTML dupliqué "+JSON.stringify(dup));
ok(await ev(()=>nextActions().length>0), "assistant « À faire maintenant » alimenté");

/* ---------- 3. Import CRM Drive + intake participants ---------- */
section("import");
const imp = await ev(()=>{ DB.contacts=[];
  const rows=parseTable(["Type de relation\tNom de l'entité\tContact principal\tE-mail\tSite web\tStatut\tResponsable\tNotes\tAdresse",
    "Lycée\tLycée Paul Valéry\tMarie Dupont\tmarie@lycee-valery.fr\twww.lycee-valery.fr\tEn discussion\tCamille\tHistorique\t1 rue Danton",
    "Agence de voyage\tItalytour\tPaolo\tpaolo@italytour.it\titalytour.it\tClient\tCamille\t\t"].join("\n"));
  const d=detectMapping(rows); const r=smartImport(rows,d,"Reprise");
  const a=DB.contacts.find(c=>c.email==="marie@lycee-valery.fr"), b=DB.contacts.find(c=>c.email==="paolo@italytour.it");
  return {n:r.n, comp:a.company, name:a.name, cat:a.category, st:a.stage, bst:b.stage, owner:a.owner, dom:a.domain, note:a.note};
});
ok(imp.n===2 && imp.comp==="Lycée Paul Valéry" && imp.name==="Marie Dupont", "CRM Drive: entité→société, contact→nom");
ok(imp.cat==="Lycée / École" && imp.st==="En discussion" && imp.bst==="Gagné", "type→nature, statut normalisé");
ok(imp.owner==="Camille" && imp.dom==="lycee-valery.fr" && /Danton/.test(imp.note), "responsable, domaine, adresse en notes");
ok(await ev(()=>normStage("À contacter")==="À contacter" && normStage("Contacté par mail")==="Contacté" && normStage("Perdu")==="Perdu"), "normStage (accents)");
const intake = await ev(()=>{ DB.participants=[];
  const rows=parseTable("Nom complet\tAdresse e-mail\tDate de naissance\tMineur ?\nMarco Rossi\tmarco@x.it\t2009-05-04\tOui\nMarco Bis\tmarco@x.it\t\tNon");
  const r=importParticipants(rows,detectParticipantMapping(rows),"Immersion Sète 2026");
  const p=DB.participants[0]; return {n:r.n, minor:p.minor, birth:typeof p.birth, proj:p.project}; });
ok(intake.n===1 && intake.minor==="Oui" && intake.birth==="number" && intake.proj==="Immersion Sète 2026", "intake participants (+ dédup email)");

/* ---------- 4. Documents participants pré-remplis ---------- */
section("documents");
const doc = await ev(()=>{ DB.settings.company={name:"Formaskills Travel",city:"Sète"};
  DB.projects=[{id:"pr1",name:"Immersion",city:"Sète",country:"France",start:Date.UTC(2026,4,4),end:Date.UTC(2026,4,15)}];
  DB.participants=[{id:"a",name:"Marco",project:"Immersion"},{id:"b",name:"Lena",project:"Immersion"}];
  const ctx=projectDocCtx(DB.projects[0]); window.__p=""; window.open=()=>({document:{write:s=>window.__p+=s,close:()=>{},getElementById:()=>({})}});
  openDocGen("projects","pr1"); const b=[...document.querySelectorAll(".mfoot .btn")]; b[b.length-1].click();
  return {lieu:ctx.lieu, tpl:participantDocTemplates().map(t=>t.id).includes("attestation"), sheets:(window.__p.match(/class="dhead"/g)||[]).length}; });
ok(doc.lieu==="Sète, France" && doc.tpl, "contexte projet + modèles participant");
ok(doc.sheets===2, "1 document par participant");

/* ---------- 5. Registre, planning, pipeline ---------- */
section("modules");
const reg = await ev(()=>{ DB.docRegistry=[]; seedRegistry(); document.querySelector("#sr_doss").value="Immersion"; const b=[...document.querySelectorAll(".mfoot .btn")]; b[b.length-1].click(); return DB.docRegistry.length; });
ok(reg===10, "registre: dossier Erasmus seedé (10 pièces)");
const plan = await ev(()=>{ const p={start:Date.UTC(2026,4,4,12),end:Date.UTC(2026,4,8,12)}; return {d:planDays(p).length, in:projSpansDay(p,Date.UTC(2026,4,6,10)), out:projSpansDay(p,Date.UTC(2026,4,20))}; });
ok(plan.d===5 && plan.in && !plan.out, "planning: jours + période");
const pipe = await ev(()=>{ DB.contacts=[{id:"o1",stage:"En discussion",value:10000},{id:"o2",stage:"Contacté",value:4000},{id:"o3",stage:"Gagné",value:8000},{id:"o4",stage:"À contacter",value:0}];
  const o=pipelineOpps(); const open=o.filter(c=>["À contacter","Contacté","Relancé","En discussion"].includes(c.stage));
  return {n:o.length, w:open.reduce((s,c)=>s+c.value*STAGE_WEIGHTS[c.stage],0)}; });
ok(pipe.n===3 && pipe.w===7000, "pipeline: opportunités + pondéré");

/* ---------- 6. Expériences, itinéraire, géo gratuite, devis ---------- */
section("itineraire");
const it = await ev(async()=>{ DB.experiences=[]; DB.itineraries=[]; DB.quotes=[]; DB.settings.quoteSeq=1;
  seedExperiences(); const fabre=DB.experiences.find(e=>e.name==="Musée Fabre"), resto=DB.experiences.find(e=>e.category==="Restaurant"), free=DB.experiences.find(e=>Number(e.price)===0&&e.lat);
  newItinerary(); const t=DB.itineraries[0]; t.participants=4; t.client="Lycée X";
  addExpToDay(t.id,t.days[0].id,fabre.id); addExpToDay(t.id,t.days[0].id,resto.id); addExpToDay(t.id,t.days[0].id,free.id);
  const T=itinTotals(t); const sug=suggestNext(t);
  const km=haversineKm({lat:43.408,lng:3.697},{lat:43.611,lng:3.879});
  Geo.roadDistance=async()=>({km:2.3,carMin:7}); ITIN_CUR=t.id; await itinComputeRoutes();
  const L=legFor(fabre,resto,{mode:"car",osrm:t.days[0].items[1].osrm});
  itinToQuote(); const q=DB.quotes[0];
  return {events:DB.experiences.filter(e=>e.date).length, price:T.price, expect:(Number(fabre.price)+Number(resto.price))*4, sug:sug.length,
    km:Math.round(km), real:L.real&&L.min===7, qTotal:quoteTotals(q).ttc, qLines:q.items.length}; });
await closeM();
ok(it.events>=2, "expériences: événements datés seedés");
ok(it.price===it.expect, "itinéraire: prix = Σ prix × participants");
ok(it.sug>=1, "suggestions de la suite");
ok(it.km>=25 && it.km<=30, "distance Haversine Sète↔Montpellier");
ok(it.real, "OSRM (simulé): distance réelle prioritaire");
ok(it.qTotal===it.price && it.qLines===3, "devis depuis itinéraire = total itinéraire");
const geo = await ev(async()=>{ DB.experiences=[{id:"g",name:"A",address:"1 rue A",city:"Sète"}]; Geo.geocode=async()=>({lat:43.41,lng:3.69}); await geocodeMissing(); return DB.experiences[0].lat; });
ok(geo===43.41, "géocodage gratuit (Nominatim simulé)");

/* ---------- 7. Email : Gmail RFC 2822 + mailing séquencé ---------- */
section("email");
const raw = await ev(()=>{ const r=buildRawEmail({from:"me@x.fr",to:"a@b.fr",subject:"Réunion été",body:"Bonjour"}); const s=r.replace(/-/g,"+").replace(/_/g,"/"); const d=decodeURIComponent(escape(atob(s)));
  return /^[A-Za-z0-9_-]+$/.test(r) && /To: a@b\.fr/.test(d) && /=\?UTF-8\?B\?/.test(d); });
ok(raw, "message Gmail base64url + objet UTF-8");
const mail = await ev(async()=>{ window.gmailSend=async()=>true; DB.settings.gmail={clientId:"x",connected:true,token:"t",email:"me@x.fr",expiry:Date.now()+6e4}; DB.settings.maxRelances=3;
  DB.contacts=[{id:"a",name:"A",email:"a@x.fr",tags:["Lycées"]},{id:"c",name:"C",email:"",tags:["Lycées"]}]; DB.emailTemplates=[{id:"tp",name:"1er",subject:"Bonjour",body:"x",cc:"",bcc:""}]; DB.tasks=[];
  await runMailing("Lycées","tp"); const a=DB.contacts.find(x=>x.id==="a"), c=DB.contacts.find(x=>x.id==="c");
  return {moved:a.tags.includes(relanceListName(1))&&!a.tags.includes("Lycées"), stays:c.tags.includes("Lycées"), stage:a.stage}; });
ok(mail.moved && mail.stays && mail.stage==="Contacté", "mailing: envoyés déplacés, sans-email restent");

/* ---------- 8. Anti-perte : fusion, CSV Drive, instantanés ---------- */
section("anti-perte");
ok(await ev(()=>{ const r=mergeDB({contacts:[{id:"a"}],experiences:[{id:"x"}],docRegistry:[{id:"r"}]},{contacts:[{id:"b"}],experiences:[{id:"y"}],docRegistry:[]}); return r.contacts.length===2&&r.experiences.length===2&&r.docRegistry.length===1; }), "mergeDB: union sans perte");
ok(await ev(()=>{ const d=migrate({}); return Array.isArray(d.experiences)&&Array.isArray(d.itineraries)&&Array.isArray(d.docRegistry); }), "migrate: toutes les clés");
const csv = await ev(async()=>{ DB.contacts=[{id:"1",name:"Avec, virgule",company:'Guillemet "x"',email:"e@x.fr",tags:["L1"]}];
  const t=contactsCsvText(); let w=""; CSV_HANDLE={queryPermission:async()=>"granted",createWritable:async()=>({write:async s=>{w=s;},close:async()=>{}})};
  const okw=await writeCsvFile(); CSV_HANDLE=null; return {bom:t.startsWith("﻿"), esc:/"Avec, virgule"/.test(t)&&/"Guillemet ""x"""/.test(t), okw:okw&&w.length>0}; });
ok(csv.bom && csv.esc && csv.okw, "export CSV Drive (BOM, échappement, écriture)");
const snap = await ev(async()=>{ const ks=(await idbKeys()).filter(k=>String(k).startsWith("snap:")); for(const k of ks) await idbDel(k);
  DB.settings.lastSnap=""; await snapshotDaily(); const n1=(await listSnapshots()).length; await snapshotDaily(); return {n1, n2:(await listSnapshots()).length}; });
ok(snap.n1===1 && snap.n2===1, "instantané quotidien (sans doublon)");

/* ---------- 8b. Bulle → app : nouveaux contacts déclenchent les automatisations ---------- */
section("bulle");
const bub = await ev(()=>{ DB.contacts=[{id:"old",name:"Ancien",email:"o@x.fr",tags:[]}]; saveNow();
  const fired=[]; const _run=Automations.run; Automations.run=(evn,ctx)=>{ fired.push(evn+":"+ctx._id); };
  const nv=JSON.parse(JSON.stringify(DB)); nv.contacts.push({id:"nw",name:"Lycée Victor Hugo",email:"vh@lycee.fr",source:"linkedin",tags:["Prospection LinkedIn"]});
  const n1=onExtensionStorageChange(nv); const n2=onExtensionStorageChange(JSON.parse(JSON.stringify(DB)));
  Automations.run=_run; const c=DB.contacts.find(x=>x.id==="nw");
  return {n1, n2, fired, cat:c&&c.category, kept:DB.contacts.some(x=>x.id==="old")}; });
ok(bub.n1===1 && bub.fired.length===1 && bub.fired[0]==="contact.created:nw", "contact reçu de la bulle → automatisation « contact ajouté »");
ok(bub.n2===0, "pas de re-déclenchement sur une synchro identique");
ok(bub.cat==="Lycée / École" && bub.kept, "nature déduite + contacts existants conservés");

/* ---------- 9. Recherche globale ---------- */
section("recherche");
const gs = await ev(()=>{ DB.contacts=[{id:"c",name:"Marie Valéry",email:"m@x.fr",tags:[]}]; DB.experiences=[{id:"e",name:"Musée Fabre",category:"Musée"}];
  return {acc:globalSearchResults("valery").some(r=>r.t==="Contact"&&/Marie/.test(r.label)), exp:(globalSearchResults("fabre")[0]||{}).t, short:globalSearchResults("v").length}; });
ok(gs.acc===true && gs.exp==="Expérience" && gs.short===0, "recherche globale (sans accents, ≥2 caractères) "+JSON.stringify(gs));
await page.keyboard.press("Control+k"); await page.waitForTimeout(80);
ok(!!(await page.$("#gs_q")), "Ctrl+K ouvre la recherche"); await closeM();

/* ---------- 10. Devis & factures : remise, acompte/solde, encaissements, mentions ---------- */
section("factures");
await fresh();
const tot = await ev(()=>{ const a=quoteTotals({items:[{qty:10,unit:100}],tvaRate:0,discount:10}); const b=quoteTotals({items:[{qty:2,unit:50}],tvaRate:20});
  return {brut:a.brut,remise:a.remise,ht:a.ht,ttc:a.ttc, compat:b.ht===100&&b.tva===20&&b.ttc===120}; });
ok(tot.brut===1000 && tot.remise===100 && tot.ht===900 && tot.ttc===900, "remise % sur le HT brut");
ok(tot.compat, "totaux sans remise inchangés (compat)");
const flow = await ev(()=>{ DB.quotes=[]; DB.settings.quoteSeq=1; DB.settings.invoiceSeq=1;
  DB.quotes=[{id:"d1",kind:"devis",number:"D-2026-001",date:Date.now(),status:"Accepté",clientName:"Lycée X",object:"Séjour",items:[{label:"Séjour",qty:10,unit:790}],tvaRate:0,pax:10}];
  go("docs"); DOCS_TAB="quotes"; DOCS_KIND="devis"; VIEWS.docs();
  invoiceDeposit("d1"); document.querySelector("#dep_pct").value="30"; const b=[...document.querySelectorAll(".mfoot .btn")]; b[b.length-1].click();
  const dep=DB.quotes.find(x=>x.invType==="acompte");
  let blocked=false; const _t=window.toast; window.toast=(m)=>{ if(/Solde|entièrement/.test(m)) blocked=true; };
  convertToInvoice("d1"); const blockedConvert=blocked; blocked=false;
  invoiceBalance("d1"); const sol=DB.quotes.find(x=>x.invType==="solde");
  invoiceBalance("d1"); const blockedSecond=blocked; window.toast=_t;
  return { depHT:quoteTotals(dep).ht, depSrc:dep.sourceQuote, solHT:quoteTotals(sol).ht, solLbl:sol.items[0].label, depNum:dep.number,
    blockedConvert, blockedSecond, nInv:DB.quotes.filter(x=>x.kind==="facture").length }; });
ok(flow.depHT===2370 && flow.depSrc==="D-2026-001", "facture d'acompte 30 % rattachée au devis");
ok(flow.blockedConvert, "facture complète bloquée quand un acompte existe");
ok(flow.solHT===5530 && flow.solLbl.includes(flow.depNum), "facture de solde = devis − acomptes (référencés)");
ok(flow.blockedSecond && flow.nInv===2, "pas de double solde (déjà entièrement facturé)");
const pay = await ev(()=>{ const inv=DB.quotes.find(x=>x.invType==="solde");
  inv.payments=[{id:"p1",date:Date.now(),amount:2000,method:"Virement"}]; const s1=invoiceStatusFromPayments(inv); const P1=quotePaid(inv);
  inv.payments.push({id:"p2",date:Date.now(),amount:3530,method:"Carte"}); const s2=invoiceStatusFromPayments(inv);
  const manual=invoiceStatusFromPayments({kind:"facture",status:"Payée",items:[{qty:1,unit:10}]});
  return {s1, rest:P1.rest, s2, manual}; });
ok(pay.s1==="Partiellement payée" && pay.rest===3530, "encaissement partiel → reste dû + statut");
ok(pay.s2==="Payée", "encaissement total → Payée");
ok(pay.manual==="Payée", "compat : statut manuel conservé sans encaissement");
const doc2 = await ev(()=>{ const inv=DB.quotes.find(x=>x.invType==="solde"); inv.payments=[{id:"p",date:Date.now(),amount:1000,method:"Virement"}]; inv.due=Date.now()+864e5;
  const h=quoteDocHTML(inv); const dep=quoteDocHTML(DB.quotes.find(x=>x.invType==="acompte")); const dv=quoteDocHTML(DB.quotes.find(x=>x.id==="d1"));
  return {mentions:/Mentions légales/.test(h)&&/40 €/.test(h), rest:/Reste à payer/.test(h), depTitle:/FACTURE D'ACOMPTE/.test(dep), pax:/par participant/.test(dv), noMentionsDevis:!/Mentions légales/.test(dv)}; });
ok(doc2.mentions && doc2.rest, "facture : mentions légales + reste à payer");
ok(doc2.depTitle, "titre « FACTURE D'ACOMPTE »");
ok(doc2.pax && doc2.noMentionsDevis, "devis : prix par participant, sans mentions de facture");
const st = await ev(()=>{ DB.quotes=[
    {id:"a",kind:"devis",number:"D1",status:"Accepté",items:[{qty:1,unit:1000}]},{id:"b",kind:"devis",number:"D2",status:"Refusé",items:[{qty:1,unit:500}]},
    {id:"c",kind:"devis",number:"D3",status:"Envoyé",items:[{qty:1,unit:300}]},
    {id:"f1",kind:"facture",number:"F1",status:"Émise",due:Date.now()-864e5,items:[{qty:1,unit:400}],payments:[{amount:100}]},
    {id:"f2",kind:"facture",number:"F2",status:"Payée",items:[{qty:1,unit:600}]},
    {id:"f3",kind:"facture",number:"F3",status:"Annulée",items:[{qty:1,unit:999}]}];
  const S=quoteStats(); const late=nextActions().some(a=>/F1 en retard/.test(a.title)&&/reste/.test(a.sub||a.desc||JSON.stringify(a)));
  return {...S, late2:late}; });
ok(st.pending===300 && st.accepted===1000 && st.conv===50, "synthèse devis : en cours, acceptés, transformation");
ok(st.factured===1000 && st.collected===700 && st.toCollect===300 && st.late===1, "synthèse factures : facturé / encaissé / à encaisser / retard (annulée exclue)");
ok(st.late2, "assistant : facture partiellement payée en retard signalée avec le reste");
const dupe = await ev(()=>{ DB.settings.quoteSeq=5; duplicateQuote("a"); const c=DB.quotes[0]; try{ closeModal(); }catch(e){}
  return {num:c.number, st:c.status, diff:c.id!=="a"&&c.number!=="D1"}; });
ok(dupe.diff && dupe.st==="Brouillon" && /D-\d{4}-005/.test(dupe.num), "dupliquer un devis (nouveau numéro, brouillon)");
await ev(()=>{ DB.quotes=[{id:"fx",kind:"facture",number:"F-2026-009",date:Date.now(),status:"Émise",due:Date.now()+864e5,clientName:"Client",items:[{label:"x",qty:1,unit:500}],tvaRate:0}]; go("docs"); DOCS_KIND="facture"; VIEWS.docs(); editQuote("fx"); });
await page.fill("#q_pamt","200"); await page.click("#q_padd"); await page.waitForTimeout(60);
await ev(()=>{ const b=[...document.querySelectorAll(".mfoot .btn")]; b[b.length-1].click(); });
const ui = await ev(()=>{ const f=DB.quotes.find(x=>x.id==="fx"); return {st:f.status, n:(f.payments||[]).length, rest:/300/.test(document.querySelector("#docsBody").textContent)}; });
ok(ui.n===1 && ui.st==="Partiellement payée", "éditeur : encaissement ajouté → statut auto");
ok(ui.rest, "liste factures : colonne « Reste dû »");

/* ---------- 11. Conformité, sécurité, accessibilité (check-lists de lancement) ---------- */
section("securite");
await fresh();
const xss = await ev(async()=>{
  const P=`X<img src=x data-xss=1>"'><b data-xss=2>`, now=Date.now(), day=864e5, tick=()=>new Promise(r=>setTimeout(r,25));
  DB.partners=[{id:"pt1",name:"Lycée"+P,type:"École",status:"En discussion",notes:P}];
  DB.projects=[{id:"pr1",name:"Immersion"+P,city:"Sète"+P,country:"France",start:now+15*day,end:now+19*day}];
  DB.participants=[{id:"pa1",name:"Marco"+P,project:"Immersion"+P,status:"Incomplet",minor:"Oui"}];
  DB.providers=[{id:"pv1",name:"Hôtel"+P,type:"Hébergement"}]; DB.tasks=[{id:"tk1",title:"Conv"+P,status:"À faire",due:now-day}];
  DB.contacts=[{id:"c1",name:"Alice"+P,company:"École"+P,email:"alice@x.fr",source:"src"+P,service:P,note:P,tags:["Ecoles"+P],website:"javascript:alert(1)",nextAction:P,nextActionDate:now-day}];
  DB.quotes=[{id:"q1",kind:"devis",number:"D-1",date:now,status:"Envoyé",clientName:"Ecole"+P,items:[{label:"Séjour"+P,qty:1,unit:790}],tvaRate:0}];
  DB.experiences=[{id:"e1",name:"Musée"+P,category:"Musée",city:"Montpellier"+P,address:P,price:8,url:"javascript:alert(2)",date:"pas-une-date"+P,tags:["L"+P]}];
  DB.itineraries=[{id:"it1",name:"Séjour"+P,participants:10,days:[{id:"d1",label:"Jour"+P,items:[{expId:"e1",mode:"walk"}]}]}];
  DB.docRegistry=[{id:"dr1",dossier:"Général"+P,title:"RC"+P,status:"Manquant"}]; DB.activity=[{t:now,m:"act"+P}];
  DB.settings.docStyle.logo=`x" onerror="window.__x=1`; save();
  const found=[], calls=new Set();
  const check=w=>{ if(document.querySelector("[data-xss]")) found.push(w);
    document.querySelectorAll("a[href^='javascript:' i]").forEach(a=>{ if(!/_bm$/.test(a.id)) found.push(w+" js-href"); });
    document.querySelectorAll("[data-call]").forEach(e=>calls.add(e.dataset.call)); };
  for(const n of NAV.filter(n=>n.id)){ go(n.id); await tick(); check(n.id); }
  for(const t of ["saved","scraper"]){ FINDER_TAB=t; go("finder"); await tick(); check("finder "+t); }
  for(const t of ["check","rgpd","diag"]){ COMP_TAB=t; go("compliance"); await tick(); await tick(); check("compliance "+t); }
  const M=[()=>editEntity("partners","pt1"),()=>editEntity("participants","pa1"),()=>{go("docs");editQuote("q1")},()=>openContactCard("c1"),()=>openExpEntry("e1"),()=>openGlobalSearch()];
  for(const [i,m] of M.entries()){ m(); await tick(); check("modal"+i); closeModal(); }
  go("docs"); await tick(); check("docs-logo");
  const broken=[...calls].map(c=>parseCall(c)).filter(c=>!c||typeof window[c.fn]!=="function").map(c=>c&&c.fn);
  return {found, broken, ncalls:calls.size, x:window.__x||0};
});
ok(xss.found.length===0 && !xss.x, "XSS : contenu piégé neutralisé sur tous les écrans "+JSON.stringify(xss.found));
ok(xss.broken.length===0 && xss.ncalls>30, `aucune action cassée (${xss.ncalls} actions câblées) `+JSON.stringify(xss.broken));
const sec = await ev(async()=>{
  const r={};
  r.url = safeUrl("javascript:alert(1)")==="" && safeUrl("data:text/html,x")==="" && safeUrl("ecole.fr")==="https://ecole.fr" && safeUrl("https://a.fr/x")==="https://a.fr/x";
  r.csv = csvEsc("=HYPERLINK(\"x\")").startsWith("\"'=") && csvEsc("@SUM(A1)")==="'@SUM(A1)" && csvEsc("+33 4 67 00 11 22")==="+33 4 67 00 11 22" && csvEsc("-5")==="-5" && csvEsc("-cmd")==="'-cmd";
  DB.settings.gmail={clientId:"cid",connected:true,token:"SECRET-TOKEN-123",email:"me@x.fr",expiry:Date.now()+6e4};
  const ex=JSON.stringify(exportableDB()); r.token = !ex.includes("SECRET-TOKEN-123") && ex.includes("cid") && DB.settings.gmail.token==="SECRET-TOKEN-123";
  const enc=await encryptText('{"contacts":[{"id":"z","name":"Confidentiel"}]}',"motdepasse1");
  let wrong=false; try{ await decryptText(enc,"mauvais-mdp"); }catch(e){ wrong=true; }
  r.crypto = enc.ftEncrypted===1 && !JSON.stringify(enc).includes("Confidentiel") && JSON.parse(await decryptText(enc,"motdepasse1")).contacts[0].name==="Confidentiel" && wrong;
  r.valid = !!validateBackup([]) && !!validateBackup({contacts:"x"}) && !!validateBackup({foo:1}) && !!validateBackup({contacts:[1]}) && validateBackup({contacts:[],settings:{}})==="";
  const before=(await idbKeys()).filter(k=>/avant-import/.test(k)).length;
  await applyImport({contacts:[{id:"imp",name:"Importé"}],settings:{gmail:{clientId:"",token:""}}});
  r.import = DB.contacts.some(c=>c.id==="imp") && DB.settings.gmail.token==="SECRET-TOKEN-123" && (await idbKeys()).filter(k=>/avant-import/.test(k)).length>=Math.max(1,before);
  r.badImport = (await applyImport({contacts:"pirate"}))===false && DB.contacts.some(c=>c.id==="imp");
  r.schema = migrate({}).meta.schema===SCHEMA_VERSION && SCHEMA_VERSION>=2;
  let n=0; const of=window.fetch;
  window.fetch=async()=>{ n++; return n<3?new Response("",{status:503}):new Response("{}",{status:200}); };
  const rr=await fetchT("https://x.test/",{},{retries:3}); window.fetch=(u,o)=>new Promise((res,rej)=>{ o.signal.addEventListener("abort",()=>rej(Object.assign(new Error("a"),{name:"AbortError"}))); });
  let to=""; try{ await fetchT("https://x.test/",{},{timeout:50}); }catch(e){ to=e.message; } window.fetch=of;
  r.net = rr.status===200 && n===3 && /délai/.test(to);
  window.dispatchEvent(new ErrorEvent("error",{message:"Erreur de test"})); r.errlog = errLog().some(e=>/Erreur de test/.test(e.m));
  go("inconnu-xyz"); r.notfound = CURRENT==="dash";
  return r;
});
ok(sec.url, "liens : javascript:/data: bloqués, https forcé");
ok(sec.csv, "CSV : injection de formule neutralisée (téléphones/nombres intacts)");
ok(sec.token, "jeton Gmail jamais exporté (sauvegarde / Drive)");
ok(sec.crypto, "sauvegarde chiffrée AES-256 : illisible sans mot de passe, mauvais mot de passe refusé");
ok(sec.valid && sec.badImport, "import : structure validée, fichier piégé refusé sans perte");
ok(sec.import, "import : instantané « avant-import » + Gmail local conservé");
ok(sec.schema, "versionnage du schéma");
ok(sec.net, "réseau : nouvelles tentatives (recul exponentiel) + délai maximum");
ok(sec.errlog, "journal d'erreurs local");
ok(sec.notfound, "écran inconnu → tableau de bord (404)");

section("rgpd");
const rg = await ev(async()=>{
  const r={}, now=Date.now(); let sent=0, dl=null;
  window.downloadText=(n,t)=>{ dl={n,t}; };
  DB.settings.gmail={clientId:"x",connected:true,token:"t",email:"me@x.fr",expiry:now+6e4};
  DB.contacts=[{id:"a",name:"Anne",email:"anne@lycee.fr",tags:["L"]},{id:"b",name:"Bob",email:"bob@lycee.fr",tags:["L"]},
    {id:"old",name:"Vieux",email:"v@x.fr",added:now-4*365*864e5,tags:[]},{id:"won",name:"Client",email:"w@x.fr",stage:"Gagné",added:now-5*365*864e5,tags:[]}];
  DB.participants=[{id:"m1",name:"Mineur",minor:"Oui"},{id:"m2",name:"Ok",minor:"Oui",parental:"Oui"}];
  DB.emailTemplates=[{id:"tp",name:"1er",subject:"Bonjour {name}",body:"Corps",cc:"",bcc:""}]; DB.tasks=[]; DB.suppression=[];
  r.footer = /STOP/.test(ftEmailDraft({to:"x@y.fr",subject:"s",body:"b"}).body);
  setOptOut("a",1);
  r.optout = isOptedOut("ANNE@lycee.fr") && createContactEmailDraft(DB.contacts.find(c=>c.id==="a"),null)===null;
  let blocked=false; try{ await gmailSend({to:"anne@lycee.fr",subject:"s",body:"b"}); }catch(e){ blocked=/RGPD/.test(e.message); }
  r.block = blocked;
  const of=window.fetch; window.fetch=async()=>{ sent++; return new Response("{}",{status:200}); };
  await runMailing("L","tp"); window.fetch=of;
  r.mailing = sent===1 && DB.contacts.find(c=>c.id==="a").tags.includes("L");
  exportContactData("b"); r.access = dl && /bob@lycee\.fr/.test(dl.t);
  gdprErase("b"); document.querySelector(".mfoot .btn:last-child").click();
  r.erase = !DB.contacts.some(c=>c.id==="b") && DB.suppression.length===1 && !JSON.stringify(DB.suppression).includes("bob");
  DB.contacts.push({id:"b2",name:"Bob",email:"Bob@Lycee.fr",tags:[]}); saveNow();
  const merged=mergeDB(DB,{contacts:[{id:"b3",email:"bob@lycee.fr"}]});
  r.noReimport = !DB.contacts.some(c=>c.id==="b2") && !merged.contacts.some(c=>c.id==="b3");
  const titles=nextActions().map(a=>a.title).join(" | ");
  r.stale = staleContacts().map(c=>c.id).join()==="old" && /durée de conservation/.test(titles);
  r.minors = minorsWithoutAuth().length===1 && /mineur/.test(titles);
  DB.quotes=[{id:"dq",kind:"devis",number:"D-9",date:now,status:"Envoyé",items:[{label:"x",qty:1,unit:1}]},{id:"fq",kind:"facture",number:"F-9",date:now,status:"Émise",items:[{label:"x",qty:1,unit:1}]}];
  r.cgv = /Conditions de vente et d'annulation/.test(quoteDocHTML(DB.quotes[0])) && !/Conditions de vente et d'annulation/.test(quoteDocHTML(DB.quotes[1]));
  COMP_TAB="check"; go("compliance"); r.check = document.querySelectorAll("#compBody .result-row").length>=35 && /RGPD/.test(document.body.textContent);
  COMP_TAB="rgpd"; go("compliance"); r.policy = /POLITIQUE DE CONFIDENTIALITÉ/.test(document.querySelector("#rg_pp").value) && /FORMASKILLS/.test(document.querySelector("#rg_pp").value);
  return r;
});
ok(rg.footer, "emails : mention de désinscription (STOP) ajoutée");
ok(rg.optout && rg.block, "« Ne plus contacter » : aucun brouillon, envoi Gmail bloqué");
ok(rg.mailing, "mailing : contact opposé exclu (reste dans sa liste)");
ok(rg.access, "droit d'accès : export des données d'un contact");
ok(rg.erase, "droit à l'effacement : suppression + liste d'opposition hachée (pas d'email en clair)");
ok(rg.noReimport, "contact effacé jamais ré-importé (saisie, fichier synchronisé)");
ok(rg.stale, "rétention : prospects inactifs > 3 ans signalés (clients exclus)");
ok(rg.minors, "mineurs sans autorisation parentale signalés");
ok(rg.cgv, "conditions de vente / annulation sur les devis (pas sur les factures)");
ok(rg.check && rg.policy, "écran Conformité : check-list + politique de confidentialité pré-remplie");

section("accessibilite");
await fresh();
const a11y = await ev(async()=>{
  const r={}, tick=()=>new Promise(res=>setTimeout(res,60));
  DB.contacts=[{id:"k1",name:"Clavier",email:"k@x.fr",tags:["T"]}]; save();
  FINDER_TAB="saved"; go("finder"); await tick();
  const nonNative=[...document.querySelectorAll("[data-call]")].filter(e=>!/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(e.tagName));
  r.focusable = nonNative.every(e=>e.getAttribute("tabindex")==="0" && e.getAttribute("role")==="button");
  openContactCard("k1"); await tick();
  const md=document.querySelector("#modalRoot .modal");
  r.modal = md.getAttribute("aria-modal")==="true" && !!md.getAttribute("aria-labelledby") && md.contains(document.activeElement);
  r.labels = [...md.querySelectorAll(".field > label")].filter(l=>l.parentElement.querySelector("input:not([type=checkbox]),select,textarea")).every(l=>l.htmlFor && document.getElementById(l.htmlFor));
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"})); await tick();
  r.esc = !document.querySelector("#modalRoot .modal");
  r.navCurrent = !!document.querySelector('#nav [aria-current="page"]');
  const lum=h=>{ const c=getComputedStyle(document.documentElement).getPropertyValue(h).trim().replace("#",""); const v=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(x=>x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4); return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2]; };
  const cr=(a,b)=>{ const x=lum(a),y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  r.contrast = [["--muted","--bg"],["--ink","--panel"],["--ok","--ok-soft"],["--warn","--warn-soft"],["--bad","--bad-soft"],["--brand","--brand-soft"],["--accent","--accent-soft"]].map(([a,b])=>[a,+cr(a,b).toFixed(2)]).filter(([,v])=>v<4.5);
  r.head = !!document.querySelector('link[rel="icon"]') && !!document.querySelector('meta[name="description"]') && /script-src 'self'/.test((document.querySelector('meta[http-equiv="Content-Security-Policy"]')||{}).content||"") && !!document.querySelector(".skip") && document.documentElement.lang==="fr";
  r.alt = [...document.querySelectorAll("img")].every(i=>i.hasAttribute("alt"));
  return r;
});
ok(a11y.focusable, "clavier : éléments cliquables atteignables (Tab) et activables");
ok(a11y.modal && a11y.esc, "fenêtres : aria-modal, titre lié, focus à l'intérieur, Échap ferme");
ok(a11y.labels, "formulaires : chaque champ a un libellé associé");
ok(a11y.navCurrent && a11y.alt, "navigation : page courante annoncée, images avec alt");
ok(a11y.contrast.length===0, "contrastes WCAG AA (≥ 4.5:1) "+JSON.stringify(a11y.contrast));
ok(a11y.head, "en-tête : favicon, description, CSP, lien d'évitement, langue");
const mf=JSON.parse(fs.readFileSync(path.join(ROOT,"manifest.json"),"utf8"));
ok(/object-src 'none'/.test((mf.content_security_policy||{}).extension_pages||""), "manifest : CSP stricte explicite");
const kb = await ev(async()=>{ window.__k=0; window.__kfn=()=>{ window.__k++; }; const d=document.createElement("div"); d.setAttribute("data-call","__kfn()"); document.querySelector("#view").appendChild(d);
  await new Promise(r=>setTimeout(r,80)); d.focus(); d.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})); return window.__k; });
ok(kb===1, "clavier : Entrée active un élément data-call");

section("performance");
const perf = await ev(async()=>{
  DB.contacts=Array.from({length:3000},(_,i)=>({id:"p"+i,name:"Contact "+i,company:"Société "+(i%300),email:`c${i}@ecole${i%300}.fr`,tags:["Liste "+(i%10)],stage:"À contacter",added:Date.now()-i*1e6}));
  DB.partners=Array.from({length:800},(_,i)=>({id:"pp"+i,name:"Partenaire "+i,status:"Prospect"})); saveNow();
  const t0=performance.now(); FINDER_TAB="saved"; go("finder"); const t1=performance.now(); go("dash"); const t2=performance.now(); go("partners"); const t3=performance.now();
  const s0=performance.now(); for(let i=0;i<20;i++) applySuppression(); const s1=performance.now();
  return {contacts:Math.round(t1-t0), dash:Math.round(t2-t1), partners:Math.round(t3-t2), supp:Math.round(s1-s0)};
});
ok(perf.contacts<1500 && perf.dash<1500 && perf.partners<2000, "performance : 3000 contacts / 800 partenaires rendus vite "+JSON.stringify(perf));

/* ---------- Bilan ---------- */
section("global");
for(const v of ["dash","settings","itinerary","experiences"]){ await ev(i=>go(i),v); await page.waitForTimeout(40); }
ok(csp.length===0, "zéro violation CSP"); ok(errors.length===0, "zéro pageerror");
if(csp.length) csp.forEach(c=>console.log("  CSP: "+c));
if(errors.length) errors.forEach(e=>console.log("  ERR: "+e));
console.log(`\n==== ${PASS} PASS / ${FAIL} FAIL ====`);
await browser.close(); server.close(); process.exit(FAIL?1:0);
