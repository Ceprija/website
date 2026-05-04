# CEPRIJA site documentation

Internal reference for how the public site routes users into programs, enrollment, and payments.

| Document | Contents |
|----------|----------|
| [Enrollment: flows and entry points](./enrollment/flows-and-entrypoints.md) | URLs, `enrollmentFlow` rules, inline vs application wizard, APIs, **diagram index** (A–K), decision trees, state machines, sequence diagrams, Stripe return |

## Where things live in code

| Area | Primary locations |
|------|-------------------|
| Program content + schema | `src/content/programas/*.md`, `src/content.config.ts` |
| Program detail (ficha) | `src/pages/oferta-academica/[slug].astro` |
| Inline CE form (educación continua) | `src/components/forms/ContinuousEducationForm.astro` |
| Application wizard (admisión) | `src/pages/enrollment/[slug].astro`, `src/components/enrollment/*` |
| Flow resolution | `src/lib/enrollmentRouting.ts` |
| Optional módulos / fechas | `src/lib/programVariants.ts`, frontmatter `variantOptions` |
| Admission step flags by `nivel` | `src/lib/enrollmentAdmissionFlags.ts`, `src/lib/enrollmentDegrees.ts` |
| Slug / URL rules | `src/lib/programPaths.ts` |
| Application API | `src/pages/api/enrollment.ts` |
| CE inscription API | `src/pages/api/educacion-continua-inscription.ts` |
| Wire proof | `src/pages/api/payments/` |
| Stripe | `src/pages/api/stripe/*` |

When you change behavior, update the enrollment doc in the same PR when the user-visible flow changes.
