# Formaskills Travel — Research & Benchmark

> Deliverable accompanying the redesign. Documents the audit assumptions, the
> competitive benchmark, the patterns we adopted, and — importantly — what we
> deliberately did **not** invent.

## 1. Current-site audit (constraints)

The live sites `formaskills-travel.fr` and `www.formaskills.fr` were **not reachable
from the build environment** (DNS did not resolve through the network policy), and a
public web search returned no indexable content for the travel brand. The redesign was
therefore built on **verified facts only**:

| Verified fact | Source |
|---|---|
| Formaskills is a **distance-learning training institute based in Sète** | Client profile |
| Offers *titre professionnel* programs across 14+ fields (conseiller en insertion, formateur d'adultes, RH, paie, petite enfance, gestion/protection de la nature, etc.) | Client profile |
| **4.9/5 Google rating** | Client profile |
| Positioning: **individualized, personalized support** | Client profile |
| Main site: **www.formaskills.fr** | Client profile |
| Travel brand = **educational mobility, cultural experiences, French language courses, tailor-made international programs** | Project brief |

**Not invented anywhere on the site** (per the brief): testimonials, certifications,
approvals, partnerships, prices, or completed projects. Every place that needs such
real data carries a visible, editable **⚑ placeholder note** for the Formaskills team
to complete before go-live.

### Action list for the client before launch
- Replace testimonial blocks with **real, verifiable Google reviews**.
- Confirm the **destinations actually operated** (add/remove cards).
- Validate program **durations, group sizes and formats** (currently illustrative).
- Add real **phone number, full postal address, legal entity & SIREN**, Qualiopi or
  other certifications if held, and legal/privacy/terms pages.
- Wire the **inquiry & contact forms** to a backend (Formspree, SMTP, or CRM).
- Add real **social media URLs** and a **Google Map embed**.

## 2. Competitive benchmark

Patterns studied from the references in the brief and adapted to an educational-mobility
context.

| Reference | What we studied | What we adapted |
|---|---|---|
| **k-shuttle.com** | Multi-level tours dropdown, Education Tour category, educational group portfolios | A **mega-menu** with the four program areas + a feature CTA; dedicated *Education Tours* category |
| **thisiskoreatours.com/inquiry** | Structured free-consultation form, itinerary selection, flexible traveler requirements, personalized planning | A **4-step guided inquiry** (program → group & dates → preferences → contact) with progress stepper, flexible/optional fields and a summary confirmation |
| **evaneos.fr** | Destination discovery, tailor-made travel, guided inquiry & conversion | **Destinations hub** with filtering; "tailor-made" as a first-class program; a guided, low-pressure funnel |
| **worldstrides.com** | Educational tours, school-group programs, filtering & IA | Audience-segmented program cards (school, university, juniors, professionals) with filters |
| **ef.edu/educators** | Education-focused branding, audience segmentation, language-travel positioning | Educator-first tone; "a training institute's rigor" narrative; level-based language stays (A1–C1) |
| **audleytravel.com** | Premium visual storytelling, personalized advice, editorial layouts, human expertise | Full-bleed hero, serif editorial headings, "one dedicated advisor" messaging, generous whitespace |
| **vivalangues.fr** | French educational travel, language stays, group offers | French-first content; immersion stay format (classes + culture + host families) |
| **projects-abroad.org** | Group programs, program pages, immersive experiences | Detailed **program page** with day-by-day itinerary, inclusions, FAQ |
| **responsibletravel.com** | Thematic collections, meaningful local experiences | "Responsible travel" value; themed cultural experiences; local-partner emphasis |
| **getyourguide.com / viator.com** | Activity discovery, browsing patterns, readable cards, filters, detail pages | Clean, scannable **cards with meta** (duration, group size, level), chip filters, sticky program sidebar |
| **intrepidtravel.com** | Destination storytelling, curated categories, responsible communication | Destination storytelling tiles; curated program categories |

### Cross-cutting takeaways applied
- **UX strengths:** guided, multi-step inquiry beats a single long form; filters make
  a broad catalog feel navigable; a sticky CTA sidebar keeps conversion in reach.
- **Visual strengths:** full-bleed imagery + serif/sans pairing reads as "premium";
  restrained palette signals trust; generous whitespace signals quality.
- **Navigation:** a mega-menu that explains each category (icon + one-line description)
  outperforms a bare link list for an unfamiliar visitor.
- **Trust/conversion:** surface the 4.9/5 rating early; repeat a *free, no-obligation*
  consultation CTA on every page; "one dedicated advisor" humanizes the funnel.

## 3. Features integrated

- Responsive mega-menu with 4 program areas + feature CTA
- 4-step guided "Free Consultation" flow with progress stepper, validation & summary
- Program hub with live category filtering; detailed program template (itinerary, inclusions, FAQ, sticky CTA)
- Destinations hub with filtering and storytelling tiles
- Bilingual **FR/EN** toggle (per-element `data-en`, French default, persisted)
- Accessibility: skip link, semantic landmarks, focus-visible styles, `prefers-reduced-motion`, ARIA on nav/accordion/form
- SEO: per-page titles/descriptions, canonical, Open Graph, JSON-LD (`TravelAgency` + rating), `sitemap.xml`, `robots.txt`
- Performance: single CSS/JS, system-friendly fonts, lazy-loaded images, graceful gradient fallbacks

## 4. Not yet built (recommended next phase)
- Real backend for forms (lead capture → CRM/email) and spam protection
- CMS so staff can add destinations/programs without code
- Blog / resources hub for SEO (mobility guides, destination articles)
- Real photography and brand assets (replace Unsplash placeholders)
- Analytics + consent management (RGPD-compliant cookie banner)
