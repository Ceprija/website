---
# Copiar este bloque a src/content/programas/<nombre-archivo>.md
# `slug` define la URL del programa: /oferta-academica/<slug>
# Astro lo maneja como campo top-level (NO forma parte del schema de data).
# Si se omite, usa el nombre del archivo. Debe ser único (el build falla si se repite).

slug: "nombre-url-del-programa"
title: "Título del programa"
description: "SEO + párrafo principal del hero"
excerpt: "Resumen corto (listados, meta; puede alinearse con description)"
image: "/images/programs/ejemplo.webp"

escuela: "juridica"
nivel: "curso"

# RVOE (titulación). Opcional si solo aplica registro de diplomado.
# rvoe: "ESM142024000"
# Diplomados u otros con registro (se muestra “Registro:” en la ficha). Opcional.
# registroAcademico: "ESDIP-2024-000"
horario: ""
startDate: ""
duracion: ""
modalidad: "Presencial / En línea"

# Texto mostrado en “Inversión” y en el formulario CE (el cobro real es Stripe)
price:
  Presencial: "Consultar"
  Online: "Consultar"

featured: false
date: ""

stripePriceIds:
  presencial: "price_..."
  online: "price_..."

address: ""
requiresVerification: false
instructor: ""
schedule: ""
meetingLink: ""

curriculumTitle: "Plan de estudios"
curriculum:
  - period: "Módulo 1"
    subjects:
      - "Tema o materia"

profile: ""
profileAudience: ""
fieldOfWork: ""

includes:
  - "Elemento incluido en la oferta"

# Si se define, la página detalle renderiza una card "Requisitos previos"
prerequisites:
  - "Requisito o conocimiento previo necesario"

# enrollmentFlow: "inline"
# enrollmentFlow: "application"

# Variantes opcionales (módulos seleccionables y/o cohortes con fecha).
# Solo aplica para programas que se vendan por módulo individual o paquete (p. ej. talleres modulares).
# Cuando se define, el flujo de inscripción multi-paso muestra dropdowns
# adicionales para elegir el módulo/paquete y la fecha de inicio. El precio
# de Stripe se resuelve a partir del módulo elegido + la modalidad.
# Requiere `enrollmentFlow: "application"`.
# variantOptions:
#   moduleSelection:
#     label: "Selecciona el formato"
#     required: true
#     options:
#       - id: "modulo_1"
#         label: "Módulo individual: Tema 1"
#         description: "$2,500 MXN · 12 horas"
#         stripePriceIds:
#           presencial: "price_..."
#           online: "price_..."
#       - id: "paquete_completo"
#         label: "Paquete completo (3 módulos)"
#         description: "$6,750 MXN · 36 horas"
#         stripePriceIds:
#           presencial: "price_..."
#           online: "price_..."
#   dateSelection:
#     label: "Selecciona la fecha de inicio"
#     required: true
#     options:
#       - id: "cohorte_mayo_2026"
#         label: "14 de mayo de 2026"
#         description: "Horario: 6:00 p.m. - 9:00 p.m."
---
