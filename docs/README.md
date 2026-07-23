# CEPRIJA site documentation

Internal reference for the public site: programs, enrollment, payments, Meta landings, and ops.

## For Cursor / other agents (read this first)

**These docs are real source-of-truth for humans and agents — but they are not auto-injected into every chat.** Agents see them when:

1. This README or a linked doc is opened / `@`-mentioned, or
2. The always-on Cursor rule points here (`.cursor/rules/ceprija-docs-context.mdc`), or
3. The agent searches `docs/` while working on a matching area.

Prefer **searching these docs before inventing flows**. When user-visible behavior changes, update the matching doc in the same PR.

| If you are working on… | Read |
|------------------------|------|
| Application vs inline enrollment, wizard steps, APIs | [enrollment/flows-and-entrypoints.md](./enrollment/flows-and-entrypoints.md) (incl. §5.0 personal dossier docs) |
| Meta Ads `/landing/*` | [landings-meta-ads.md](./landings-meta-ads.md) |
| Stripe / webhooks / installments | [stripe-configuration.md](./stripe-configuration.md) |
| Deploy / PM2 / email allowlists | [deployment-guide.md](./deployment-guide.md), [operational-runbook.md](./operational-runbook.md) |
| New or updated program content from MKT | [marketing-program-handoff-checklist.md](./marketing-program-handoff-checklist.md) |

## Document index

| Document | Contents |
|----------|----------|
| [Enrollment: flows and entry points](./enrollment/flows-and-entrypoints.md) | URLs, `enrollmentFlow`, inline vs application, Step 3 documents, APIs, diagrams |
| [Meta Ads landings](./landings-meta-ads.md) | Classic vs `narrative` layout, Septiembre + brochure CTAs, content rules |
| [Stripe configuration reference](./stripe-configuration.md) | Webhooks, installments, Test Clock, troubleshooting |
| [Marketing → sitio: checklist de programa](./marketing-program-handoff-checklist.md) | Coherence, Stripe prices, images, admission inventory |
| [Checklist para marketing (lenguaje sencillo)](./marketing-program-handoff-checklist-para-mkt.md) | Same guide, non-technical |
| [Deployment guide](./deployment-guide.md) | Prod Node + Nginx + PM2 |
| [Operational runbook](./operational-runbook.md) | Day-2 ops, email safety, deploy snippet |
| [Pre-deployment checklist](./pre-deployment-checklist.md) | Pre-flight checks |
| [Incident response](./incident-response.md) | Incidents |
| [Monitoring setup](./monitoring-setup.md) | Monitoring |

### Generar PDF del checklist para marketing

Desde la raíz del repo `ceprija_site` (después de `npm install`):

```bash
npm run docs:pdf-mkt
```

Salida: `docs/marketing-program-handoff-checklist-para-mkt.pdf`.

## Where things live in code

| Area | Primary locations |
|------|-------------------|
| Program content + schema | `src/content/programas/*.md`, `src/content.config.ts` |
| Meta landings content | `src/content/landings/*.md` |
| Program detail (ficha) | `src/pages/oferta-academica/[slug].astro` |
| Inline CE form | `src/components/forms/ContinuousEducationForm.astro` |
| Application wizard | `src/pages/enrollment/[slug].astro` |
| Flow / admission flags | `src/lib/enrollmentRouting.ts`, `src/lib/enrollmentAdmissionFlags.ts` |
| Application API | `src/pages/api/enrollment.ts` |
| CE inscription API | `src/pages/api/educacion-continua-inscription.ts` |
| Long inscription form | `src/components/forms/InscriptionForm.astro`, `src/pages/api/inscription.ts` |
| Septiembre soft lead | `src/pages/inscripciones-septiembre-2026.astro`, `src/lib/septiembre2026Programs.ts` |
| School Hub persistence | `src/lib/db/submissions.ts` |
| Stripe | `src/pages/api/stripe/*` |

When you change behavior, update the matching doc in the same PR when the user-visible flow changes.
