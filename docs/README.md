# CEPRIJA site documentation

Internal reference for how the public site routes users into programs, enrollment, and payments.

| Document | Contents |
|----------|----------|
| [Enrollment: flows and entry points](./enrollment/flows-and-entrypoints.md) | URLs, `enrollmentFlow` rules, inline vs application wizard, APIs, **diagram index** (A–K), decision trees, state machines, sequence diagrams, Stripe return |
| [Marketing → sitio: checklist de programa](./marketing-program-handoff-checklist.md) | Coherencia módulos/fechas/temario, duplicados en planes de estudio, precios vs Stripe/cupones, imágenes, legal; **confirmación de cohorte**; **admisión y documentos**; **tabla inventario** de todos los `programas/*.md` (brechas, `featured`, admisión) |
| [Checklist para marketing (lenguaje sencillo)](./marketing-program-handoff-checklist-para-mkt.md) | Misma guía en redacción no técnica; PDF opcional (ver abajo) |

### Generar PDF del checklist para marketing

Desde la raíz del repo `ceprija_site` (después de `npm install`):

```bash
npm run docs:pdf-mkt
```

Salida: `docs/marketing-program-handoff-checklist-para-mkt.pdf` (al lado del `.md`). La **primera vez** puede tardar varios minutos porque `md-to-pdf` descarga Chromium para “imprimir” a PDF; las siguientes suelen ser rápidas. Sin PDF: abrir el `.md` en el editor y **Imprimir → Guardar como PDF**, o pasar el contenido a Word/Google Docs.

Equivalente directo (si ya tienes dependencias instaladas):

```bash
npx md-to-pdf docs/marketing-program-handoff-checklist-para-mkt.md --document-title "Checklist programas — Marketing CEPRIJA"
```

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
