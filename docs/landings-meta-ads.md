# Meta Ads landings (`/landing/{slug}`)

Self-contained campaign pages. Copy and assets live in `src/content/landings/*.md` (not `programas`). Only `programSlug` couples to the Septiembre soft-lead form and CRM attribution (`src/lib/septiembre2026Programs.ts`).

## Route and chrome

| Piece | Location |
|-------|----------|
| Paths | `src/pages/landing/[slug].astro` — only `status: active` |
| Layout | `AdsLandingLayout` — `noindex`, no site nav/footer |
| Classic template | `src/components/ads/AdsProgramLanding.astro` |
| Narrative template | `src/components/ads/AdsNarrativeLanding.astro` |
| Schema / template | `src/content.config.ts` (`landings`), `src/content-templates/landings/TEMPLATE.md` |
| Styles | `src/lib/adsLandingStyles.ts` |
| Tests | `tests/ads-landing-criminalistica.spec.ts` |

## Two layouts

1. **Classic (default)** — ficha-style: hero meta, “El programa”, incluye, audiencia, curriculum gallery, FAQs. Used by maestrías / doctorado landings until MKT sends a narrative brief.
2. **Narrative** — if frontmatter has `narrative` (`heroHeadline`, `heroSupport`, `sections[]` with CTAs `septiembre` \| `brochure`), the route renders `AdsNarrativeLanding` instead. **Criminalística** uses this (MKT brief). Do not reintroduce classic FAQ/gallery blocks on a narrative landing without a new brief.

### Narrative image ↔ color bands

Recommended rhythm after the hero: **color → image → color → image → color** (hero stays full-bleed from top-level `image`).

| Section field | Effect |
|---------------|--------|
| `image` omitted | Solid color band (`#831200`, from MKT “Franja de Color” swatch) with light text/CTAs; compact shared height. |
| `image: "/images/…"` | Full-bleed photo band with dark overlay; title, body, and CTAs sit on top (same pattern as the hero). |

Add a louder band for any future narrative landing by setting `image` on that section in markdown — no component change required. Assets for Criminalística live under `public/images/landings/criminalistica/` (plus spare shots for MKT review).

## CTAs

| Action | Behavior |
|--------|----------|
| `septiembre` | `buildSeptiembre2026CtaHref(programSlug)` → `/inscripciones-septiembre-2026?programa=…` (+ UTM when `data-utm`) |
| `brochure` | `data-brochure-open` → `BrochureLeadModal` (lead gate; PDF after submit). Pass `landingSlug` so `/api/brochure-download` validates against the landings collection |

## Content checklist

- `programSlug` must exist in `SEPTIEMBRE_2026_SLUG_TO_TITLE` or the build throws.
- Keep `brochure` under `public/brochures/` when offering plan/brochure download.
- Hero image: full-bleed; prefer existing program art unless MKT supplies a new asset.
- Narrative section photos: optional `sections[].image`; use dark, high-contrast shots so white text/CTAs stay readable.
