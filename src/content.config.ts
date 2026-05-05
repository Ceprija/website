import { defineCollection, z } from 'astro:content';
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

const revista = defineCollection({
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
     * - "disabled": Program is hidden from catalog
     */
    status: z.enum(["active", "waitlist", "disabled"]).default("active"),
    
    /** @deprecated Use `status: "disabled"` instead. Kept for backward compatibility. */
    disabled: z.boolean().optional(),
    escuela: z.enum(["juridica", "economica", "integral"]),
    nivel: z.enum(PROGRAMA_NIVELES_TUPLE),
    /** RVOE (programas de titulación). Omitir o dejar vacío si solo aplica `registroAcademico`. */
    rvoe: optionalYamlString(),
    /** Registro académico de diplomados (p. ej. ESDIP-2024-xxx). Se muestra como “Registro” en la ficha. */
    registroAcademico: optionalYamlString(),
    horario: z.string(),
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
    price: z.union([z.number(), z.record(z.string())]).optional(),
    featured: z.boolean().optional(),
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
    enrollmentFlow: z.enum(["inline", "application"]).optional()
  }).refine((data) => {
    // Conditional validation: active programs must have payment options and enrollment flow
    if (data.status === "active") {
      const hasPaymentOptions = data.paymentOptions && data.paymentOptions.length > 0;
      const hasEnrollmentFlow = !!data.enrollmentFlow;
      return hasPaymentOptions && hasEnrollmentFlow;
    }
    return true;
  }, {
    message: "Active programs must have at least one paymentOption and an enrollmentFlow defined"
  })
});

export const collections = {
  revista,
  programas
};