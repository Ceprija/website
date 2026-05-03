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

rvoe: ""
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
---
