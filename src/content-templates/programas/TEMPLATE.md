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

# Program status: controls visibility and enrollment behavior
# - "active": Program is available for enrollment with payment options (DEFAULT)
# - "waitlist": Program is visible but not currently available; shows "Request Info" form
# - "disabled": Program is hidden from catalog
status: "active"

# RVOE (titulación). Opcional si solo aplica registro de diplomado.
# rvoe: "ESM142024000"
# Diplomados u otros con registro (se muestra "Registro:" en la ficha). Opcional.
# registroAcademico: "ESDIP-2024-000"
horario: ""
startDate: ""
duracion: ""
modalidad: "Presencial / En línea"

# NEW FORMAT: Structured payment options for Stripe integration
# Each option represents a payment choice (e.g., "Presencial", "En línea", "Paquete")
# REQUIRED when status === "active"
paymentOptions:
  - id: "presencial"
    label: "Modalidad Presencial"
    price: 5000  # Price in MXN (as number)
    stripePriceId: "price_..."  # Stripe Price ID
    type: "presencial"  # Options: "presencial", "online", "hibrido"
  - id: "online"
    label: "Modalidad En Línea"
    price: 4000
    stripePriceId: "price_..."
    type: "online"

featured: false
date: ""

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

# Enrollment flow: determines if program uses inline form or application wizard
# REQUIRED when status === "active"
# - "inline": Simple registration on program page (default for curso, diplomado, taller)
# - "application": Multi-step application with documents (default for maestria, doctorado, especialidad)
enrollmentFlow: "inline"

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

## Migration Notes

### Legacy Format (DEPRECATED - still supported for backward compatibility)
```yaml
# Old way (still works but deprecated):
disabled: false  # Use status: "disabled" instead
price:
  Presencial: "$5,000 MXN"
  Online: "$4,000 MXN"
stripePriceIds:
  presencial: "price_..."
  online: "price_..."
```

### New Format Examples

**Active program with payment options:**
```yaml
status: "active"
paymentOptions:
  - id: "presencial"
    label: "Modalidad Presencial"
    price: 5000
    stripePriceId: "price_abc123"
    type: "presencial"
  - id: "online"
    label: "Modalidad En Línea"
    price: 4000
    stripePriceId: "price_def456"
    type: "online"
enrollmentFlow: "inline"
```

**Hybrid modality program:**
```yaml
status: "active"
paymentOptions:
  - id: "hibrido"
    label: "Modalidad Híbrida (Presencial + En Línea)"
    price: 4500
    stripePriceId: "price_xyz789"
    type: "hibrido"
enrollmentFlow: "inline"
```

**Program with multiple payment options (packages):**
```yaml
status: "active"
paymentOptions:
  - id: "modulo_1"
    label: "Módulo Individual 1"
    price: 2500
    stripePriceId: "price_mod1"
    type: "presencial"
  - id: "modulo_2"
    label: "Módulo Individual 2"
    price: 2500
    stripePriceId: "price_mod2"
    type: "presencial"
  - id: "paquete"
    label: "Paquete Completo (2 módulos)"
    price: 4500
    stripePriceId: "price_package"
    type: "presencial"
enrollmentFlow: "inline"
```

**Waitlist program (not currently available):**
```yaml
status: "waitlist"
# No paymentOptions or enrollmentFlow required
# UI will show "Próximamente Disponible" with ContactForm for info requests
# All other fields (title, description, curriculum, etc.) are still shown
```

**Disabled program (hidden from catalog):**
```yaml
status: "disabled"
# Program will not appear in listings or generate public pages
```
