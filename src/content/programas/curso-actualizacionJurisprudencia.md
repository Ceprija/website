---
# --- Identidad y URL ---
# URL del detalle: /oferta-academica/<slug> (debe coincidir con programId en formularios / APIs)
slug: "actualizacion-jurisprudencial-en-materia-fiscal"
title: "Actualización Jurisprudencial en Materia Fiscal"
# description: SEO (meta) + párrafo principal bajo el título en el hero
description: "Domina las jurisprudencias fiscales más recientes y su impacto estratégico en el sector."
# excerpt: resúmenes / listados cuando el UI lo use; mantenlo alineado con description
excerpt: "Domina las jurisprudencias fiscales más recientes y su impacto estratégico en el sector."
# image: ruta bajo /public o URL absoluta; se usa como <img src> en el hero
image: "/images/programs/actualizacion-jurisprudencia-fiscal.jpg"

# --- Clasificación (schema) ---
# escuela: juridica | economica | integral
escuela: "integral"
# nivel: curso | taller | diplomado | maestria | doctorado | especialidad
nivel: "curso"

# --- Datos operativos en el hero ---
# rvoe: deja "" si no aplica (así no se muestra el bloque RVOE en el UI)
rvoe: ""
# horario: deja "" si aún no está definido
horario: "10:00 – 13:30 (hora CDMX)"
startDate: "19 de marzo de 2026"
duracion: "3 horas 30 minutos"
modalidad: "Presencial / En línea"

# --- Precio (texto en pantalla) vs Stripe (cobro real) ---
# • stripePriceIds (abajo): IDs price_… de Stripe. El monto que se COBRA sale del Price en el
#   dashboard de Stripe, no de este archivo.
# • price (aquí): solo para MOSTRAR en la sección "Inversión" y en el formulario CE (etiquetas).
#   Debe cuadrar comercialmente con Stripe, pero no hay sincronización automática: si cambias
#   el precio en Stripe, actualiza también estos textos.
# Opción A: número → el UI muestra $número en la ficha.
# Opción B (recomendada si hay dos modalidades): objeto con claves exactas Presencial / Online.
price:
  Presencial: "$1,500 MXN IVA incluido"
  Online: "$1,500 MXN IVA incluido"

# featured: reservado para futuros listados; hoy no se usa en el UI
featured: true
# date: metadata opcional (publicación / última actualización)
date: "2026-03-19"

# --- Pagos Stripe (presencial / online deben ser price_… válidos o el checkout no se ofrece) ---
stripePriceIds:
  presencial: "price_1CfgActJurFiscalPres"
  online: "price_1CfgActJurFiscalOnln"

# paymentLinks: opcional (legacy code); URLs de pago externo si las usas fuera de Stripe
# paymentLinks:
#   presencial: ""
#   online: ""

# --- Educación continua / correos ---
# address: dirección presencial en formulario y textos; si omites, el formulario usa su default
address: "Lope de Vega #273, Col. Americana, Guadalajara, Jal. C.P. 44160"
# requiresVerification: true si el flujo pide comprobante y revisión manual antes de confirmar
requiresVerification: false
# instructor, schedule, meetingLink: usados en plantillas de correo y textos de detalle cuando existen programa en colección
instructor: "Claustro docente CEPRIJA"
schedule: "Sesión intensiva — consulta fechas en inicio de curso"
meetingLink: "Enlace de acceso enviado por correo antes del evento (modalidad en línea)."

# --- Plan de estudios ---
# La indentación en YAML solo agrupa datos: cada "- period:" es un bloque; "subjects:" son materias.
# En la UI cada periodo es un colapsable (<details>); las materias van en rejilla dentro del panel.
curriculumTitle: "Temario"
curriculum:
  - period: "Bloque 1 — Panorama jurisprudencial"
    subjects:
      - "Criterios recientes de tribunales administrativos y fiscales"
      - "Impacto en litigio y cumplimiento"
  - period: "Bloque 2 — Estrategia práctica"
    subjects:
      - "Casos tipo y líneas de defensa"
      - "Q&A y cierre"

# --- Requisitos previos (colapsable en la ficha; título opcional) ---
prerequisitesTitle: "Requisitos previos"
# Texto multilínea O lista (usa lista con guiones para viñetas en el UI):
prerequisites:
  - "Cédula profesional o estudiante de derecho o contaduría (o equivalente)."
  - "Experiencia básica en materia fiscal o tributaria recomendable."

# --- Bloques opcionales visibles en la ficha (no son meta SEO por sí solos) ---
# Perfil del egresado (típico en posgrado; en curso corto suele omitirse)
# profile: ""
# "Dirigido a" y "Campo laboral" → tarjetas con título en la página del programa (debajo del plan).
profileAudience: "Abogados, contadores, asesores fiscales y profesionistas que litigan o asesoran en materia fiscal."
fieldOfWork: "Litigio fiscal, consultoría, áreas legales y cumplimiento en empresas y despachos."

# Incluye (lista con viñetas en el UI)
includes:
  - "Constancia de participación digital"
  - "Material de apoyo en formato digital"
  - "Acceso a grabación (si aplica a la modalidad en línea)"

# --- Flujo de inscripción ---
# enrollmentFlow: inline | application — si omites, maestría/doctorado/especialidad → application; resto → inline
# enrollmentFlow: "inline"
---
