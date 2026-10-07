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

/* ---------- Bilan ---------- */
section("global");
for(const v of ["dash","settings","itinerary","experiences"]){ await ev(i=>go(i),v); await page.waitForTimeout(40); }
ok(csp.length===0, "zéro violation CSP"); ok(errors.length===0, "zéro pageerror");
if(csp.length) csp.forEach(c=>console.log("  CSP: "+c));
if(errors.length) errors.forEach(e=>console.log("  ERR: "+e));
console.log(`\n==== ${PASS} PASS / ${FAIL} FAIL ====`);
await browser.close(); server.close(); process.exit(FAIL?1:0);
