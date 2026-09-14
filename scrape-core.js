/* scrape-core.js — fonction injectée dans la page cible (popup & app).
   Doit rester AUTONOME (aucune variable externe) : chrome.scripting
   sérialise sa source pour l'exécuter dans l'onglet visité.
   Détection stricte des téléphones (français + international), et
   détection des profils sur une page de résultats LinkedIn. */
function ftPageScrape(){
  try{
    var doc=document, host=location.hostname;

    // --- Téléphones : validation stricte, pas de suites de chiffres au hasard ---
    function phones(text){
      var out={}, re=/(?:\+|00|0)(?:[ . ().\/\-]?\d){7,13}/g, m;
      while((m=re.exec(text))){
        var d=m[0].replace(/[^\d+]/g,"");
        if(d.indexOf("00")===0) d="+"+d.slice(2);
        if(d.indexOf("+330")===0) d="+33"+d.slice(4); // +33 (0)… -> +33…
        if(/^\+33\d{9}$/.test(d)) d="0"+d.slice(3);   // +33 4 67… -> 0 4 67… (format FR homogène)
        var v=null;
        if(/^0\d{9}$/.test(d)) v=d.replace(/(\d{2})(?=\d)/g,"$1 ").trim();      // FR : 0X XX XX XX XX
        else if(/^\+\d{9,14}$/.test(d) && !/^\+(\d)\1{7,}$/.test(d)) v=d;       // international
        if(v) out[v]=1;
      }
      return Object.keys(out);
    }

    // Dé-obfuscation : révèle les emails masqués (« nom [at] boite [point] fr »,
    // « nom(at)boite.fr », entités HTML, ＠…). Conservateur pour éviter la prose.
    function deob(s){
      s=String(s||"");
      s=s.replace(/&#0*64;|&#x0*40;/gi,"@").replace(/&#0*46;|&#x0*2e;/gi,".").replace(/＠/g,"@").replace(/[․﹒．]/g,".");
      s=s.replace(/([a-z0-9._%+\-]+)\s*@\s*([a-z0-9][a-z0-9.\-]*\.[a-z]{2,24})\b/gi,"$1@$2");
      s=s.replace(/([a-z0-9._%+\-]+)\s*[\[({]\s*(?:at|arobase)\s*[\])}]\s*([a-z0-9.\-]+?)\s*(?:[\[({]\s*(?:dot|point)\s*[\])}]|\.|\s+(?:dot|point)\s+)\s*([a-z]{2,24})\b/gi,function(_m,a,b,c){return a+"@"+b+"."+c;});
      s=s.replace(/([a-z0-9._%+\-]+)\s+(?:at|arobase)\s+([a-z0-9.\-]+?)\s*(?:[\[({]\s*(?:dot|point)\s*[\])}]|\s+(?:dot|point)\s+)\s*([a-z]{2,24})\b/gi,function(_m,a,b,c){return a+"@"+b+"."+c;});
      return s;
    }
    var txt=deob((doc.body&&doc.body.innerText)||"");
    var mailtos=[].slice.call(doc.querySelectorAll('a[href^="mailto:"]')).map(function(a){try{return decodeURIComponent(a.getAttribute("href").slice(7).split("?")[0]);}catch(e){return "";}});
    var tels=[].slice.call(doc.querySelectorAll('a[href^="tel:"]')).map(function(a){return a.getAttribute("href").slice(4);});
    // Domaines "bruit" : outils techniques, exemples, images sprite — jamais des vrais contacts.
    var JUNKMAIL=/(sentry(\.io|-cdn)|wixpress|wix\.com|@example\.|@email\.|@domain\.|@sentry|@2x|@3x|godaddy|\.png$|\.jpe?g$|\.gif$|\.svg$|\.webp$|\.css$|\.js$|\.woff2?$|your-?email|yourdomain|no-?reply@example)/i;
    var emails=Array.from(new Set((txt+" "+mailtos.join(" ")).match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g)||[]))
      .map(function(e){return e.toLowerCase().replace(/[.,;:)]+$/,"");})
      .filter(function(e){
        if(e.indexOf("@")<1) return false;
        if(JUNKMAIL.test(e)) return false;
        var lp=e.split("@")[0];
        if(lp.length>40 || /^[0-9a-f]{16,}$/.test(lp)) return false; // hash / identifiant, pas un contact
        return true;
      });
    var ph=phones(txt+"  "+tels.join("  "));
    // Société : og:site_name / meta application-name / <title> nettoyé
    var company="";
    var og=doc.querySelector('meta[property="og:site_name"],meta[name="application-name"],meta[name="author"]');
    if(og && og.content) company=og.content.trim();
    if(!company && doc.title){ company=doc.title.split(/[|\-–—:·]/)[0].trim(); if(company.length>60) company=""; }

    // --- LinkedIn : liste des profils sur une page de résultats ---
    var isLI=/(^|\.)linkedin\./.test(host);
    var isSearch=/\/search\//.test(location.href) || /\/sales\/search\//.test(location.href);
    var profiles=[], seen={};
    if(isLI){
      [].slice.call(doc.querySelectorAll('a[href*="/in/"]')).forEach(function(a){
        var href=(a.href||"").split("?")[0];
        if(!/\/in\/[^\/]+\/?$/.test(href)) return;
        var nm=(a.innerText||"").trim().split("\n")[0].trim();
        if(!nm || nm.length<2 || /^linkedin member$/i.test(nm) || /^(voir|view|connect|se connecter|message|suivre|follow)$/i.test(nm)) return;
        if(seen[href]) return; seen[href]=1;
        var hl="", card=a.closest("li")||a.closest('div[class*="entity"]')||a.closest("div");
        if(card){
          var lines=card.innerText.split("\n").map(function(s){return s.trim();}).filter(Boolean);
          var i=lines.indexOf(nm);
          if(i>=0){ for(var k=i+1;k<lines.length;k++){ if(!/^(•|·|\d|voir|view|connect)/i.test(lines[k]) && lines[k].length>3){ hl=lines[k]; break; } } }
        }
        profiles.push({name:nm, headline:hl, url:href});
      });
    }

    // --- Page profil / site classique : nom, headline ---
    var name="", headline="";
    if(isLI && !isSearch){
      var h1=doc.querySelector("h1"); if(h1) name=h1.innerText.trim();
      var hlEl=doc.querySelector(".text-body-medium.break-words, .pv-text-details__left-panel .text-body-medium, .top-card-layout__headline");
      if(hlEl) headline=hlEl.innerText.trim();
    } else if(!isLI){
      var h=doc.querySelector("h1");
      if(h){ var hn=h.innerText.trim(); if(hn.length>1 && hn.length<80 && !/^\d/.test(hn) && /[a-zA-ZÀ-ÿ]/.test(hn)) name=hn; }
    }

    // --- Annuaire / Google Maps : fiches entreprise (nom + téléphone + site) ---
    // Best-effort, tolérant : marche sur Google Maps, PagesJaunes et la plupart
    // des annuaires. À valider sur le vrai DOM (les classes Google changent).
    var businesses=[], bseen={};
    function firstPhone(t){ var p=phones(String(t||"")); return p.length?p[0]:""; }
    function hostname(u){ try{ return new URL(u).hostname.replace(/^www\./,""); }catch(e){ return ""; } }
    function pushBiz(nm,phone,web,addr){
      nm=(nm||"").trim(); if(nm.length>90) nm=nm.slice(0,90);
      if(!nm && !phone && !web) return;
      var key=nm.toLowerCase()+"|"+phone+"|"+hostname(web);
      if(bseen[key]) return; bseen[key]=1;
      businesses.push({name:nm, phone:phone||"", website:web||"", address:addr||""});
    }
    var isMaps=/\/maps(\/|$|\?)/.test(location.pathname+location.search) || /(^|\.)google\.[a-z.]+$/.test(host)&&/maps/.test(location.href);
    var cards=[];
    // 1) conteneurs qui portent un lien téléphone (annuaires) ou une fiche Maps
    [].slice.call(doc.querySelectorAll('a[href^="tel:"]')).forEach(function(a){
      var c=a.closest('[role="article"]')||a.closest("article")||a.closest("li")||a.closest("div"); if(c) cards.push(c); });
    [].slice.call(doc.querySelectorAll('[role="article"], a[href*="/maps/place/"]')).forEach(function(el){
      var c=el.closest('[role="article"]')||el.parentElement||el; if(c) cards.push(c); });
    // dédup de conteneurs
    var cseen=[]; cards=cards.filter(function(c){ if(cseen.indexOf(c)>=0) return false; cseen.push(c); return true; });
    cards.slice(0,80).forEach(function(c){
      var nm="";
      var head=c.querySelector('[role="heading"],h1,h2,h3,h4');
      if(head) nm=(head.textContent||"").trim().split("\n")[0];
      if(!nm){ var pa=c.querySelector('a[href*="/maps/place/"]'); if(pa) nm=(pa.getAttribute("aria-label")||pa.textContent||"").trim().split("\n")[0]; }
      var tel=c.querySelector('a[href^="tel:"]'); var phone=firstPhone(tel?tel.getAttribute("href").slice(4):"") || firstPhone(c.innerText||"");
      var wa=c.querySelector('a[href^="http"]:not([href*="google."]):not([href*="gstatic"]):not([href*="/maps/"]):not([href*="schema.org"])');
      var web=wa?wa.href:"";
      var addr=""; var am=(c.innerText||"").match(/\d{1,4}(?:\s*(?:bis|ter))?\s+(?:rue|avenue|av\.|bd|boulevard|impasse|chemin|route|place|all[ée]e|quai|cours)\b[^\n,]{0,50}/i);
      if(am) addr=am[0].trim();
      pushBiz(nm,phone,web,addr);
    });

    var isDirectory = businesses.length>=2 || isMaps;

    var links=Array.from(new Set([].slice.call(doc.querySelectorAll("a[href]")).map(function(a){return a.href;}).filter(function(h){return /^https?:/.test(h);})));
    return {url:location.href, title:doc.title, host:host, isLinkedIn:isLI, isSearch:isSearch, isMaps:isMaps, isDirectory:isDirectory, name:name, headline:headline, company:company, emails:emails, phones:ph, profiles:profiles, businesses:businesses, links:links};
  }catch(e){ return {url:location.href, error:String(e), emails:[], phones:[], links:[], profiles:[]}; }
}
if (typeof window!=="undefined") window.ftPageScrape=ftPageScrape;
