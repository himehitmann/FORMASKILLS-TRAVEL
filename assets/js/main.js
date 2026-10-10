/* =============================================================
   FORMASKILLS TRAVEL — Interactions
   ============================================================= */
(function () {
  "use strict";

  /* ---- Header elevation on scroll ---- */
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- Mobile menu ---- */
  const toggle = document.querySelector(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const open = document.body.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    // mobile dropdown expand
    document.querySelectorAll(".has-menu > .navbtn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        if (window.matchMedia("(max-width: 860px)").matches) {
          e.preventDefault();
          btn.parentElement.classList.toggle("open");
        }
      });
    });
    // close on nav link click (mobile)
    document.querySelectorAll(".nav-links a").forEach((a) =>
      a.addEventListener("click", () => {
        document.body.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* ---- Language toggle (FR / EN) via data-fr / data-en attributes ---- */
  const LANG_KEY = "fsk-lang";
  function applyLang(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-" + lang + "]").forEach((el) => {
      const val = el.getAttribute("data-" + lang);
      if (val === null) return;
      if (el.hasAttribute("data-attr")) {
        el.setAttribute(el.getAttribute("data-attr"), val);
      } else {
        el.textContent = val;
      }
    });
    document.querySelectorAll(".lang-switch button").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.lang === lang ? "true" : "false")
    );
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  }
  let startLang = "fr";
  try { startLang = localStorage.getItem(LANG_KEY) || "fr"; } catch (e) {}
  // store FR defaults so switching back works even if an element lacks data-fr
  document.querySelectorAll("[data-en]").forEach((el) => {
    if (!el.hasAttribute("data-fr") && !el.hasAttribute("data-attr")) {
      el.setAttribute("data-fr", el.textContent.trim());
    }
  });
  applyLang(startLang);
  document.querySelectorAll(".lang-switch button").forEach((b) =>
    b.addEventListener("click", () => applyLang(b.dataset.lang))
  );

  /* ---- Scroll reveal ---- */
  const revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* ---- FAQ accordion ---- */
  document.querySelectorAll(".acc-q").forEach((q) => {
    q.addEventListener("click", () => {
      const expanded = q.getAttribute("aria-expanded") === "true";
      const panel = q.nextElementSibling;
      q.setAttribute("aria-expanded", expanded ? "false" : "true");
      panel.style.maxHeight = expanded ? null : panel.scrollHeight + "px";
    });
  });

  /* ---- Program / destination filters ---- */
  const chips = document.querySelectorAll("[data-filter]");
  const items = document.querySelectorAll("[data-cat]");
  if (chips.length && items.length) {
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        const f = chip.dataset.filter;
        items.forEach((it) => {
          const show = f === "all" || it.dataset.cat.split(" ").includes(f);
          it.style.display = show ? "" : "none";
        });
      });
    });
  }

  /* ---- Multi-step inquiry form ---- */
  const form = document.querySelector("[data-multistep]");
  if (form) {
    const steps = Array.from(form.querySelectorAll(".form-step"));
    const dots = Array.from(form.querySelectorAll(".stepper .dot"));
    const okPanel = form.querySelector(".form-ok");
    let current = 0;

    function show(i) {
      steps.forEach((s, idx) => s.classList.toggle("active", idx === i));
      dots.forEach((d, idx) => {
        d.classList.toggle("active", idx === i);
        d.classList.toggle("done", idx < i);
      });
      current = i;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function validateStep(i) {
      const step = steps[i];
      let ok = true;
      step.querySelectorAll("[required]").forEach((input) => {
        if (input.type === "radio") {
          const group = step.querySelectorAll('[name="' + input.name + '"]');
          if (![...group].some((g) => g.checked)) ok = false;
        } else if (input.type === "checkbox") {
          if (!input.checked) ok = false;
        } else if (!input.value.trim()) {
          ok = false;
          input.style.borderColor = "var(--coral)";
        } else {
          input.style.borderColor = "";
        }
      });
      if (!ok) {
        const msg = step.querySelector(".step-error");
        if (msg) msg.hidden = false;
      }
      return ok;
    }

    form.querySelectorAll("[data-next]").forEach((b) =>
      b.addEventListener("click", () => {
        if (validateStep(current) && current < steps.length - 1) show(current + 1);
      })
    );
    form.querySelectorAll("[data-prev]").forEach((b) =>
      b.addEventListener("click", () => { if (current > 0) show(current - 1); })
    );

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateStep(current)) return;
      // Build a lightweight summary (no backend in this static build)
      const data = new FormData(form);
      const summary = form.querySelector("[data-summary]");
      if (summary) {
        const pick = (k) => (data.getAll(k).filter(Boolean).join(", ") || "Non précisé");
        summary.innerHTML =
          "<li><strong>Programme :</strong> " + pick("program") + "</li>" +
          "<li><strong>Destination :</strong> " + pick("destination") + "</li>" +
          "<li><strong>Participants :</strong> " + (data.get("travelers") || "Non précisé") + "</li>" +
          "<li><strong>Période :</strong> " + (data.get("period") || "Non précisé") + "</li>" +
          "<li><strong>Contact :</strong> " + (data.get("name") || "Non précisé") + ", " + (data.get("email") || "Non précisé") + "</li>";
      }
      steps.forEach((s) => s.classList.remove("active"));
      form.querySelector(".stepper").style.display = "none";
      if (okPanel) okPanel.hidden = false;
    });
  }

  /* ---- Elegant art fallback for blocked / broken photos ----
     The artifact preview and some networks block external images. Rather than
     show a broken icon, we swap any failed <img> for an on-brand inline-SVG
     tile (gradient + contour texture + compass + place name). Always renders;
     no external dependency. Real photos still load where the network allows. */
  (function () {
    var PAL = [
      ["#0b4258", "#0e86b4"], ["#0e86b4", "#1cb3c9"], ["#0a6c93", "#2bbfd4"],
      ["#0e86b4", "#1cb3c9"], ["#ef7a3f", "#f6b23e"], ["#0b4258", "#1cb3c9"]
    ];
    function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }
    function esc(s) { return (s || "").replace(/[<>&"]/g, "").slice(0, 32); }
    function buildSVG(alt, seed, bare) {
      var p = PAL[Math.abs(hash(seed)) % PAL.length];
      var label = esc(alt);
      var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 750" preserveAspectRatio="xMidYMid slice">';
      s += '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + p[0] + '"/><stop offset="1" stop-color="' + p[1] + '"/></linearGradient></defs>';
      s += '<rect width="1000" height="750" fill="url(#g)"/>';
      s += '<g fill="none" stroke="#c4a06a" stroke-opacity="0.26" stroke-width="2.4">';
      s += '<path d="M-60 180 C180 110 360 250 560 180 S880 110 1080 190"/>';
      s += '<path d="M-60 330 C180 260 360 400 560 330 S880 260 1080 340"/>';
      s += '<path d="M-60 480 C180 410 360 550 560 480 S880 410 1080 490"/>';
      s += '<path d="M-60 630 C180 560 360 700 560 630 S880 560 1080 640"/>';
      s += '</g>';
      s += '<rect x="28" y="28" width="944" height="694" fill="none" stroke="#c4a06a" stroke-opacity="0.55"/>';
      if (!bare) {
        s += '<g transform="translate(500 ' + (label ? 320 : 375) + ')" stroke="#f1e8d6" stroke-opacity="0.92" fill="none" stroke-width="3.2"><circle r="30"/></g>';
        s += '<path transform="translate(500 ' + (label ? 320 : 375) + ')" d="M0 -18 L8 0 L0 18 L-8 0 Z" fill="#f1e8d6" fill-opacity="0.92"/>';
        if (label) s += '<text x="500" y="430" fill="#f7f1e6" font-family="Georgia, \'Times New Roman\', serif" font-size="44" letter-spacing="1" text-anchor="middle">' + label + '</text>';
      }
      s += '</svg>';
      return s;
    }
    function replace(img, i) {
      if (img.dataset.arted) return;
      img.dataset.arted = "1";
      var cs = window.getComputedStyle(img);
      var fig = document.createElement("span");
      fig.className = "imgart";
      fig.setAttribute("role", "img");
      if (img.alt) fig.setAttribute("aria-label", img.alt);
      var inHero = !!img.closest(".hero-media");
      fig.innerHTML = buildSVG(img.alt, (img.alt || "") + "#" + i, inHero);
      if (cs.position === "absolute" || inHero) { fig.style.position = "absolute"; fig.style.inset = "0"; fig.style.height = "100%"; }
      else {
        var ar = cs.aspectRatio && cs.aspectRatio !== "auto" ? cs.aspectRatio : "4 / 3";
        fig.style.aspectRatio = ar;
      }
      if (img.style.borderRadius) fig.style.borderRadius = img.style.borderRadius;
      img.replaceWith(fig);
    }
    var imgs = Array.prototype.slice.call(document.querySelectorAll("img"));
    imgs.forEach(function (img, i) {
      if (img.complete && img.naturalWidth > 0) return;          // already loaded fine
      if (img.complete && img.naturalWidth === 0) { replace(img, i); return; } // already failed
      var t = setTimeout(function () { replace(img, i); }, 2500); // network stall
      img.addEventListener("load", function () { clearTimeout(t); });
      img.addEventListener("error", function () { clearTimeout(t); replace(img, i); });
    });
  })();

  /* ---- Footer year ---- */
  const yr = document.querySelector("[data-year]");
  if (yr) yr.textContent = new Date().getFullYear();
})();
