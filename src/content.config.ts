import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { PROGRAMA_NIVELES_TUPLE } from './lib/programNiveles';

/**
 * YAML often emits `null` for empty keys; plain `z.string().optional()` only
 * accepts `undefined`. Coerce null / "" / whitespace to undefined so one bad
 * field does not break `astro dev` for the whole collection.
 */
function optionalYamlString() {
  return z.preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === "string") {
      const t = val.trim();
      return t.length > 0 ? t : undefined;
    }
    return val;
  }, z.string().optional());
}

function optionalPublicPdfPath() {
  return z.preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === "string") {
      const t = val.trim();
      return t.length > 0 ? t : undefined;
    }
    return val;
  }, z.string().regex(/^\/(?!\/)(?!.*\.\.)[\w./-]+\.pdf$/i, {
    message: "brochure must be an absolute public .pdf path",
  }).optional());
}

const revista = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/revista" }),
  schema: z.object({
    slug: z.string().optional(),
    title: z.string(),
    excerpt: z.string(),
    date: z.string(),
    image: z.string().optional(),
    category: z.string().optional(),
    author: z.string().optional()
  })
});

const programas = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/programas" }),
  schema: z.object({
    // NOTE: the URL segment comes from Astro's entry-level `slug` (frontmatter `slug`
    // in YAML, which overrides the file-derived slug). It is NOT part of `data` and
    // must not be declared here. Read it with `entry.slug` (see `getProgramPathSlug`).
    title: z.string(),
    description: z.string(),
    excerpt: z.string(),
    image: z.string(),
    /** Encuadre para `object-fit: cover` en tarjeta y hero (p. ej. `52% 40%`). Opcional. */
    imagePosition: optionalYamlString(),

    /**
     * Program status: controls visibility and enrollment behavior.
     * - "active": Program is available for enrollment with payment options
     * - "waitlist": Program is visible but not currently available; shows "Request Info" form
     * - "past": Archived edition; listed under “Cursos pasados”, no enrollment
     * - "disabled": Program is hidden from catalog
     *
     * Educación continua with status "active" may become effectively "past" when
     * ISO `date` is on or before today (see getEffectiveProgramStatus).
     */
    status: z.enum(["active", "waitlist", "past", "disabled"]).default("active"),

    /** @deprecated Use `status: "disabled"` instead. Kept for backward compatibility. */
    disabled: z.boolean().optional(),
    escuela: z.enum(["juridica", "economica", "integral"]),
    nivel: z.enum(PROGRAMA_NIVELES_TUPLE),
    /** RVOE (programas de titulación). Omitir o dejar vacío si solo aplica `registroAcademico`. */
    rvoe: optionalYamlString(),
    /** Registro académico de diplomados (p. ej. ESDIP-2024-xxx). Se muestra como “Registro” en la ficha. */
    registroAcademico: optionalYamlString(),
    horario: z.string(),
    /** Human-facing start copy (cards, ficha, emails). Not used for auto-archive. */
    startDate: z.string(),
    duracion: z.string(),
    modalidad: z.string(),


    /**
     * Structured payment options for Stripe integration.
     * Each option represents a payment choice (e.g., "Presencial", "En línea", "Paquete").
     * Required when status === "active".
     */
    paymentOptions: z.array(z.object({
      /** Unique identifier for this payment option */
      id: z.string(),
      /** Display label shown to users (e.g., "Modalidad Presencial") */
      label: z.string(),
      /** Price in MXN (as number, will be formatted for display) */
      price: z.number(),
      /** Stripe Price ID (e.g., "price_abc123") */
      stripePriceId: z.string(),
      /** Modality type: presencial, online, or hibrido (hybrid/both) */
      type: z.enum(["presencial", "online", "hibrido"])
    })).optional(),

    /** @deprecated Use `paymentOptions` array instead. Kept for backward compatibility. */
    price: z.union([z.number(), z.record(z.string(), z.string())]).optional(),
    featured: z.boolean().optional(),
    /**
     * ISO calendar day `YYYY-MM-DD` when enrollment should close / auto-archive.
     * Often the start / first session day. Used by getEffectiveProgramStatus
     * (on or before today → effective "past"). Display dates stay in `startDate`.
     */
    date: optionalYamlString(),

    // Extended fields for rich program data
    curriculum: z.array(z.object({
      period: z.string(),
      subjects: z.array(z.string()),
      /** Texto libre del módulo / periodo (aparece dentro del acordeón). */
      description: optionalYamlString(),
      /** Nombres de docentes por módulo (opcional). */
      professors: z.array(z.string()).optional(),
    })).optional(),
    curriculumTitle: optionalYamlString(),
    profile: optionalYamlString(),
    profileAudience: optionalYamlString(),
    fieldOfWork: optionalYamlString(),
    includes: z.array(z.string()).optional(),
    prerequisites: z.array(z.string()).optional(),
    gallery: z.array(z.object({
      src: z.string(),
      alt: optionalYamlString(),
      caption: optionalYamlString(),
    })).optional(),
    /** Public folder path; all image files inside it render in the program gallery. */
    galleryFolder: optionalYamlString(),
    /** Public PDF path for the downloadable program brochure, e.g. `/brochures/programa.pdf`. */
    brochure: optionalPublicPdfPath(),
    paymentLinks: z.object({
      online: z.string().optional(),
      presencial: z.string().optional()
    }).optional(),
    /** @deprecated Use `paymentOptions[].stripePriceId` instead. Kept for backward compatibility. */
    stripePriceIds: z.object({
      online: z.string().optional(),
      presencial: z.string().optional()
    }).optional(),
    requiresVerification: z.boolean().optional().default(false),
    address: optionalYamlString(),
    instructor: optionalYamlString(),
    schedule: optionalYamlString(),
    meetingLink: optionalYamlString(),

    /**
     * Opciones de variante para programas con módulos seleccionables y/o varias
     * fechas de cohorte (p. ej. talleres). Cuando está presente, el flujo de
     * inscripción muestra un paso adicional con los dropdowns correspondientes
     * y resuelve el `priceId` de Stripe a partir de la opción elegida y la
     * modalidad. Es completamente opcional para mantener compatibilidad con los
     * programas existentes.
     */
    variantOptions: z.object({
      moduleSelection: z.object({
        label: z.string(),
        required: z.boolean().optional().default(true),
        options: z.array(z.object({
          id: z.string(),
          label: z.string(),
          description: z.string().optional(),
          stripePriceIds: z.object({
            presencial: z.string().optional(),
            online: z.string().optional()
          }).optional()
        })).min(1)
      }).optional(),
      dateSelection: z.object({
        label: z.string(),
        required: z.boolean().optional().default(true),
        options: z.array(z.object({
          id: z.string(),
          label: z.string(),
          description: z.string().optional()
        })).min(1)
      }).optional()
    }).optional(),

    // Enrollment flow: determines if program uses inline form or dedicated application page
    // "inline" = simple registration on program page (curso, diplomado default)
    // "application" = multi-step application with documents (maestria, doctorado, especialidad default)
    enrollmentFlow: z.enum(["inline", "application"]).optional(),

    /**
     * Webinar gratuito: registro sin pago + constancia opcional (paymentOptions).
     * Muestra FreeWebinarRegistrationForm en lugar del flujo de pago estándar.
     */
    freeWebinar: z.boolean().optional(),
  }).refine((data) => {
    // Active: always require enrollmentFlow. Payment options are optional for
    // maestría / especialidad / doctorado (solicitud + documentos; pago fuera de línea).
    if (data.status === "active") {
      const hasEnrollmentFlow = !!data.enrollmentFlow;
      if (!hasEnrollmentFlow) return false;
      const applicationOnlyNivel =
        data.nivel === "maestria" ||
        data.nivel === "especialidad" ||
        data.nivel === "doctorado";
      if (applicationOnlyNivel) return true;
      const hasPaymentOptions = data.paymentOptions && data.paymentOptions.length > 0;
      return hasPaymentOptions;
    }
    return true;
  }, {
    message:
      "Active programs must define enrollmentFlow; non–postgraduate active programs also need at least one paymentOption",
  })
});

const docentes = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/docentes" }),
  schema: z.object({
    name: z.string(),
    degree: z.string(),
    /** Short bio used on cards / list views. */
    bio: z.string(),
    /**
     * Perfil extendido (estándar editorial): firma / rol en una línea.
     * Si está definido, la ficha de detalle usa el layout “estructurado” junto con
     * `area_especialidad` y `hito_profesional` (las entradas antiguas siguen usando
     * `position_laboral` + listas si estos campos no existen).
     */
    cargo_intro: optionalYamlString(),
    /** Bloque “Área de Especialidad” en la ficha. */
    area_especialidad: optionalYamlString(),
    /** Bloque “Hito Profesional” (texto corrido). */
    hito_profesional: optionalYamlString(),
    /**
     * Bloque “Trayectoria Académica” en frontmatter (alternativa al cuerpo Markdown).
     * Si falta, la ficha usa el cuerpo del `.md` cuando el perfil estructurado está activo.
     */
    trayectoria_academica: optionalYamlString(),
    /**
     * Título del último bloque (por defecto en la plantilla: «Trayectoria Académica»).
     * Usar p. ej. «Trayectoria Profesional» o «Trayectoria» cuando el copy no sea académico.
     */
    trayectoria_titulo: optionalYamlString(),
    /**
     * Long-form bio fallback. Prefer writing the long bio as the markdown body
     * of the entry; this field is kept for entries that haven't been migrated
     * to body content yet.
     */
    fullBio: optionalYamlString(),
    position_laboral: optionalYamlString(),
    education: z.array(z.string()).optional(),
    experience_institutional: z.array(z.string()).optional(),
    image: z.string(),
    /** Stable display order across listings (slider, grid, detail). */
    order: z.number(),
    /** When true, the member is excluded from public listings. */
    draft: z.boolean().default(false),
  }),
});

/**
 * Meta Ads landings at `/landing/{id}`.
 * Display copy/assets live here (independent of `programas`).
 * `programSlug` is only for Septiembre CTA preselect + CRM attribution.
 */
const landings = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/landings" }),
  schema: z.object({
    programSlug: z.string().min(1),
    status: z.enum(["active", "draft"]).default("active"),
    title: z.string().min(1),
    excerpt: z.string().min(1),
    description: z.string().min(1),
    image: z.string().min(1),
    nivelLabel: z.string().min(1),
    startDate: z.string().min(1),
    duracion: z.string().min(1),
    modalidad: z.string().min(1),
    includes: z.array(z.string()).default([]),
    faqs: z
      .array(
        z.object({
          q: z.string().min(1),
          a: z.string().min(1),
        }),
      )
      .default([]),
    horario: optionalYamlString(),
    rvoe: optionalYamlString(),
    profile: optionalYamlString(),
    profileAudience: optionalYamlString(),
    fieldOfWork: optionalYamlString(),
    curriculumTitle: optionalYamlString(),
    galleryFolder: optionalYamlString(),
    gallery: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string().optional(),
        }),
      )
      .optional(),
    brochure: optionalPublicPdfPath(),
    seoTitle: optionalYamlString(),
    seoDescription: optionalYamlString(),
    /**
     * Optional MKT narrative layout. When set, `/landing/{id}` uses
     * AdsNarrativeLanding instead of the classic ficha-style AdsProgramLanding.
     */
    narrative: z
      .object({
        heroHeadline: z.string().min(1),
        heroSupport: z.string().min(1),
        stickyCtaLabel: z.string().min(1).optional(),
        sections: z
          .array(
            z.object({
              id: z.string().min(1),
              title: z.string().min(1),
              body: z.string().min(1),
              primaryCta: z
                .object({
                  label: z.string().min(1),
                  action: z.enum(["septiembre", "brochure"]),
                })
                .optional(),
              secondaryCta: z
                .object({
                  label: z.string().min(1),
                  action: z.enum(["septiembre", "brochure"]),
                })
                .optional(),
            }),
          )
          .min(1),
      })
      .optional(),
  }),
});

export const collections = {
  revista,
  programas,
  docentes,
  landings,
};