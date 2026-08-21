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
        var v=null;
        if(/^0\d{9}$/.test(d)) v=d.replace(/(\d{2})(?=\d)/g,"$1 ").trim();      // FR : 0X XX XX XX XX
        else if(/^\+\d{9,14}$/.test(d) && !/^\+(\d)\1{7,}$/.test(d)) v=d;       // international
        if(v) out[v]=1;
      }
      return Object.keys(out);
    }

    var txt=(doc.body&&doc.body.innerText)||"";
    var mailtos=[].slice.call(doc.querySelectorAll('a[href^="mailto:"]')).map(function(a){try{return decodeURIComponent(a.getAttribute("href").slice(7).split("?")[0]);}catch(e){return "";}});
    var tels=[].slice.call(doc.querySelectorAll('a[href^="tel:"]')).map(function(a){return a.getAttribute("href").slice(4);});
    var emails=Array.from(new Set((txt+" "+mailtos.join(" ")).match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g)||[]))
      .map(function(e){return e.toLowerCase().replace(/[.,;:)]+$/,"");})
      .filter(function(e){return !/\.(png|jpe?g|gif|svg|webp|css|js|woff2?)$/i.test(e) && e.indexOf("@")>0;});
    var ph=phones(txt+"  "+tels.join("  "));

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

    var links=Array.from(new Set([].slice.call(doc.querySelectorAll("a[href]")).map(function(a){return a.href;}).filter(function(h){return /^https?:/.test(h);})));
    return {url:location.href, title:doc.title, host:host, isLinkedIn:isLI, isSearch:isSearch, name:name, headline:headline, company:"", emails:emails, phones:ph, profiles:profiles, links:links};
  }catch(e){ return {url:location.href, error:String(e), emails:[], phones:[], links:[], profiles:[]}; }
}
if (typeof window!=="undefined") window.ftPageScrape=ftPageScrape;
