---
# URL del landing: /landing/{nombre-del-archivo} (sin .md)
# Copy y assets de Meta Ads viven AQUÍ (independiente de src/content/programas).
# Solo `programSlug` acopla al formulario Septiembre / CRM — debe existir en
# src/lib/septiembre2026Programs.ts (SEPTIEMBRE_2026_SLUG_TO_TITLE).

# Obligatorio: slug del programa en el mapa Septiembre (CTA + attribution)
programSlug: "slug-del-programa-en-septiembre-2026"
# active = se publica | draft = no genera ruta (apagar sin borrar)
status: "draft"

# Display (requeridos para publish)
title: "Título del programa en el landing"
excerpt: "Resumen corto para meta / cards (ideal 117–160 caracteres)."
description: "Descripción larga del programa (hero / SEO)."
image: "/images/programs/ejemplo.webp"
nivelLabel: "Maestría"
startDate: "Septiembre 2026"
duracion: "4 cuatrimestres"
modalidad: "Presencial / En línea"
includes:
  - "Plan de estudios…"
  - "Proceso de admisión en línea"
faqs:
  - q: "¿Cuándo inicia?"
    a: "El ciclo de inicio es Septiembre 2026…"
  - q: "¿Qué sigue después de registrarme?"
    a: "Completas un formulario breve; un asesor te contacta."

# Opcionales (mismas formas útiles que en programas)
# horario: "Sábados 9:00–14:00"
# rvoe: "…"
# profile: "…"
# profileAudience: "…"
# fieldOfWork: "…"
# curriculumTitle: "Plan de Estudios"
# galleryFolder: "/images/programs/ejemplo/gallery"
# gallery:
#   - src: "/images/programs/ejemplo/gallery/01.webp"
#     alt: "…"
# brochure: "/brochures/ejemplo.pdf"  # PDF propio del Ads (gate con modal de lead)
# seoTitle: "…"
# seoDescription: "…"

# Layout narrativo MKT (opcional). Si está presente, la página usa
# AdsNarrativeLanding en lugar del layout ficha clásico.
# Ritmo recomendado tras el hero: color → image → color → image → color.
# Pon `image` solo en las franjas que deben ser foto + overlay; sin `image`
# la franja es color sólido (#831200) con texto claro.
# narrative:
#   heroHeadline: "La evidencia habla. Prepárate para interpretarla."
#   heroSupport: "Fórmate con peritos en activo…"
#   stickyCtaLabel: "Quiero apartar mi lugar"
#   sections:
#     - id: expertos
#       title: "Aprende de quienes viven la práctica"
#       body: "…"
#       primaryCta:
#         label: "Quiero estudiar con expertos"
#         action: septiembre   # septiembre | brochure
#     - id: disciplinas
#       title: "Domina las disciplinas…"
#       body: "…"
#       image: "/images/landings/ejemplo/disciplinas.webp"
#       primaryCta:
#         label: "Necesito esta especialidad"
#         action: septiembre
#       secondaryCta:
#         label: "Descargar plan de estudios"
#         action: brochure
#     - id: diferencia
#       title: "…"
#       body: "…"
#     - id: rvoe
#       title: "…"
#       body: "…"
#       image: "/images/landings/ejemplo/rvoe.webp"
#       primaryCta:
#         label: "Reservar mi lugar"
#         action: septiembre
#     - id: siguiente-paso
#       title: "…"
#       body: "…"
#       primaryCta:
#         label: "Completar mi registro"
#         action: septiembre
---

<!-- Cuerpo Markdown opcional; la página Ads usa sobre todo el frontmatter. -->
