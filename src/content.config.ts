import { defineCollection, z } from 'astro:content';
import { PROGRAMA_NIVELES_TUPLE } from './lib/programNiveles';

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
    escuela: z.enum(["juridica", "economica", "integral"]),
    nivel: z.enum(PROGRAMA_NIVELES_TUPLE),
    /** RVOE (programas de titulación). Omitir o dejar vacío si solo aplica `registroAcademico`. */
    rvoe: z.string().optional(),
    /** Registro académico de diplomados (p. ej. ESDIP-2024-xxx). Se muestra como “Registro” en la ficha. */
    registroAcademico: z.string().optional(),
    horario: z.string(),
    startDate: z.string(),
    duracion: z.string(),
    modalidad: z.string(),
    price: z.union([z.number(), z.record(z.string())]).optional(),
    featured: z.boolean().optional(),
    date: z.string().optional(),
    
    // Extended fields for rich program data
    curriculum: z.array(z.object({
      period: z.string(),
      subjects: z.array(z.string())
    })).optional(),
    curriculumTitle: z.string().optional(),
    profile: z.string().optional(),
    profileAudience: z.string().optional(),
    fieldOfWork: z.string().optional(),
    includes: z.array(z.string()).optional(),
    prerequisites: z.array(z.string()).optional(),
    paymentLinks: z.object({
      online: z.string().optional(),
      presencial: z.string().optional()
    }).optional(),
    stripePriceIds: z.object({
      online: z.string().optional(),
      presencial: z.string().optional()
    }).optional(),
    requiresVerification: z.boolean().optional().default(false),
    address: z.string().optional(),
    instructor: z.string().optional(),
    schedule: z.string().optional(),
    meetingLink: z.string().optional(),

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
  })
});

export const collections = {
  revista,
  programas
};