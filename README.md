# Formaskills Travel — Website

Premium, modern, multilingual (FR/EN) website for **Formaskills Travel**, the
international educational-mobility branch of Formaskills (distance-learning institute,
Sète, France). It showcases educational mobility programs, French language stays,
cultural experiences and tailor-made international programs, and converts visitors
through a guided free-consultation flow.

## Stack

No build step required — fast, portable, deployable anywhere (static hosting, GitHub
Pages, Netlify, any web server).

- **HTML5** — semantic, accessible, one file per page
- **CSS** — a single design system in `assets/css/styles.css` (design tokens, fluid
  type, components, dark-text-on-cream premium palette, responsive, reduced-motion)
- **Vanilla JS** — `assets/js/main.js` (sticky nav, mobile menu, FR/EN toggle,
  scroll-reveal, filters, accordion, multi-step inquiry form). No dependencies.
- **Fonts** — Fraunces (serif headings) + Inter (body) via Google Fonts

## Pages

| File | Purpose |
|---|---|
| `index.html` | Immersive home: hero, trust bar, program categories, destinations, why-us, process, stats, CTA |
| `programs.html` | Programs hub with live category filtering + method pillars |
| `program.html` | Program detail template (day-by-day itinerary, inclusions, gallery, FAQ, sticky CTA) |
| `destinations.html` | Destination discovery with filtering |
| `about.html` | Story, values, stats |
| `inquiry.html` | 4-step guided "Free Consultation" flow with summary |
| `contact.html` | Contact form + details + map placeholder |

Plus `robots.txt`, `sitemap.xml`, and `RESEARCH.md` (audit + competitive benchmark).

## Run locally

```bash
# any static server, e.g.
python3 -m http.server 8000
# then open http://localhost:8000
```

## Bilingual content

Text is French by default. Any element with a `data-en="…"` attribute is swapped when
the visitor picks **EN** (choice persisted in `localStorage`). To translate more
content, add `data-en` to the element — no JS changes needed.

## ⚑ Before go-live — client/developer checklist

This build intentionally invents **no** testimonials, certifications, partnerships,
prices or past projects. Items marked with a **⚑** note on the pages must be completed:

- [ ] Replace testimonial placeholders with **real, verifiable Google reviews**
- [ ] Confirm real **destinations** and **program formats** (durations, group sizes)
- [ ] Add **phone, postal address, legal entity/SIREN**, certifications (e.g. Qualiopi)
- [ ] Add **legal notice, privacy policy, terms** pages
- [ ] Wire **inquiry & contact forms** to a backend (Formspree / SMTP / CRM) + spam protection
- [ ] Add real **social URLs** and a **Google Map embed**
- [ ] Replace Unsplash placeholder imagery with **licensed brand photography**
- [ ] Add **analytics** and an **RGPD cookie-consent** banner

See `RESEARCH.md` for the full audit, benchmark and rationale.
