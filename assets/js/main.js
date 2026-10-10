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
        const pick = (k) => (data.getAll(k).filter(Boolean).join(", ") || "—");
        summary.innerHTML =
          "<li><strong>Programme :</strong> " + pick("program") + "</li>" +
          "<li><strong>Destination :</strong> " + pick("destination") + "</li>" +
          "<li><strong>Participants :</strong> " + (data.get("travelers") || "—") + "</li>" +
          "<li><strong>Période :</strong> " + (data.get("period") || "—") + "</li>" +
          "<li><strong>Contact :</strong> " + (data.get("name") || "—") + " — " + (data.get("email") || "—") + "</li>";
      }
      steps.forEach((s) => s.classList.remove("active"));
      form.querySelector(".stepper").style.display = "none";
      if (okPanel) okPanel.hidden = false;
    });
  }

  /* ---- Footer year ---- */
  const yr = document.querySelector("[data-year]");
  if (yr) yr.textContent = new Date().getFullYear();
})();
