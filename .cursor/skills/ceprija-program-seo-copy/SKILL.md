---
name: ceprija-program-seo-copy
description: >-
  Redacta y revisa title, excerpt, description, duracion y startDate de
  programas CEPRIJA en Markdown (colección programas): SEO en description,
  excerpt 117–160 caracteres para tarjetas, duracion en formato estándar de una
  línea (p. ej. N sesiones (X h)), fechas de inicio en startDate. Usar al crear o
  editar fichas en src/content/programas/, copy de programa, meta description,
  hero u oferta académica.
---

# Copy SEO de programas CEPRIJA (`programas`)

En este proyecto, cada programa es un `.md` en `src/content/programas/` con campos definidos en `src/content.config.ts`.

| Campo | Rol | Dónde impacta |
|--------|-----|----------------|
| **`title`** | Nombre oficial del programa | `<title>`, H1 de la ficha, enlaces |
| **`excerpt`** | Gancho corto | Listados (`ProgramOfferCard`), grillas por escuela |
| **`description`** | Texto largo SEO + argumento | **Meta description** y hero en `src/pages/oferta-academica/[slug].astro` |
| **`duracion`** | Resumen escaneable de extensión | Tarjeta (icono de reloj) |
| **`startDate`** | Inicio de cohorte o primera sesión | Tarjeta como “Inicio: …” (icono calendario) si hay valor útil; ficha completa |
| **`horario`**, **`modalidad`**, **`price`**, **`curriculum`**, etc. | Detalle operativo / académico | Ficha y bloques específicos; no duplicar en excerpt |

No inventar datos: precios, instructores y calendario fino deben coincidir con la operación real; el copy solo ordena y sintetiza.

---

## `title`

- **Claro y oficial**: nivel + tema (p. ej. diplomado, maestría, curso) sin relleno promocional.
- **Coherencia**: mismo criterio que el resto del catálogo (mayúsculas, siglas conocidas, sin keyword stuffing).
- **Longitud**: priorizar legibilidad en resultados de búsqueda y en menús; evitar títulos kilométricos.

---

## `excerpt` (tarjetas / listados)

- **Rango 117–160 caracteres (incluyendo espacios)**: alinea el bloque de texto en las tarjetas con el diseño (títulos y excerpts se igualan por sección con un script; el límite superior mantiene hasta ~4 líneas en el ancho típico de la grilla). Más corto de 117 solo si el mensaje ya está completo; no rellenar palabras vacías.
- **Qué debe comunicar**: *qué aprende la persona* y *para qué sirve el programa* (competencias, materias o enfoque), con **palabras clave naturales** que alguien podría buscar.
- **Qué evitar**: horas, número de sesiones, precios, fechas de inicio, modalidad, nombres de docentes, datos que ya están en la ficha. Eso no suma en la tarjeta y quita espacio a la propuesta de valor.
- **Tono**: frase(s) compactas; puede ser una sola frase con dos puntos para listar ejes temáticos.

**Verificación**: contar con `len(excerpt)`; debe estar entre **117 y 160** salvo excepciones breves justificadas.

---

## `duracion` (tarjeta — una línea)

Objetivo: el usuario entiende **cuánto dura** el programa en un vistazo, con **el mismo formato en todo el catálogo**.

### Formato estándar (priorizar este patrón)

- **Si hay carga horaria total clara** y el programa se articula en sesiones, módulos o bloques similares:
  - **`N sesiones (X h)`** — ej.: `10 sesiones (30 h)`, `4 sesiones (12 h)`
  - **`N módulos (X h)`** — ej.: `3 módulos (36 h)`
- **Programas por ciclos escolares** (sin desglose de horas en tarjeta): **`N semestres`**, **`N cuatrimestres`**, **`N meses (X h)`** si el total de horas es dato oficial útil y cabe en una línea.

Use **paréntesis** para las horas totales cuando vayan junto a sesiones/módulos: coherente con `10 sesiones (30 h)` y `3 módulos (36 h)`.

### Qué no va en `duracion`

- **Rangos de meses**, listas de fechas por día o calendario sesión a sesión → van en **`curriculum`**, **`horario`** y/o contexto de la ficha, no en la línea de duración de la tarjeta.
- Párrafos largos ni información ya cubierta por **`startDate`** (ver siguiente sección).

---

## `startDate` (inicio en tarjeta)

- Texto **corto y legible** en español: *`22 de mayo de 2026`*, *`Por definir`* solo si aún no hay fecha pública.
- En la tarjeta (`ProgramOfferCard`), si hay `startDate` no vacío y distinto de “Por definir”, se muestra **Inicio:** con icono de calendario. Por tanto: **no repetir** esa fecha dentro de `duracion`.
- La **ventana completa** del programa (varios meses) puede describirse en la ficha o en el temario, no en `duracion`.

---

## `horario` (ficha)

Una sola forma clara (p. ej. `18:00 a 21:00 h`). **No duplicar** la misma franja en otro sistema entre paréntesis (p. ej. a. m. / p. m.) salvo que la audiencia lo exija.

---

## Temario (`curriculum.subjects`)

En la ficha, cada ítem puede ser **una sola línea** (programas antiguos) o **bloque multilínea** en YAML (`|-`). Si hay más de una línea, la plantilla muestra la **primera línea en negrita y color primario** y el resto como texto corrido.

**Formato recomendado por sesión (dos líneas):**

```text
11 de junio: Contratos bancarios
Impartido por la Magistrada Ana Carmina Orozco Barajas, integrante del Primer Tribunal Colegiado en Materia Civil del Tercer Circuito.
```

- **Primera línea:** `fecha: tema` (misma línea: día/mes, dos puntos, espacio y el título del encuentro). Así la negrita agrupa fecha + tema y se lee como encabezado de la sesión.
- **Segunda línea:** frase completa de docencia, por ejemplo **Impartido por el/la Magistrado/a …, integrante del …** (magistradas/os); **Impartido por … en su carácter de Juez de Distrito …** cuando aplique; o **Impartido por el Maestro …** en módulos académicos. Sin “Impartido por:” con dos puntos; mejor artículo y verbo en frase corrida.
- **Cargos sin abreviar:** los títulos y denominaciones oficiales **nunca** van en forma abreviada en temario, `instructor` ni textos institucionales (no usar Mag., Magda., Mtro., Dra., etc.). Escribir en palabras completas: **Magistrado**, **Magistrada**, **Maestro**, **Maestra**, **Doctor**, **Doctora**, y el nombre **completo** del puesto o tribunal cuando corresponda.

Evitar una sola línea kilométrica con puntos medios (·); para sesiones con fecha y docente, **priorizar siempre** este formato de **dos líneas**.

---

## Variantes de inscripción (`variantOptions.dateSelection`)

Para la **etiqueta** del selector de fechas o edición del programa, usar lenguaje cercano al usuario: **Calendario**, **Convocatoria**, **Edición**, **Periodo**. La palabra “cohorte” solo si la audiencia institucional la usa de forma habitual.

---

## `description` (SEO + hero)

- **Es el campo principal para SEO** en la página del programa: alimenta `seo.description` y el párrafo introductorio visible.
- **Extensión**: puede superar ampliamente los 160 caracteres; priorizar **calidad y cobertura semántica** (intención de búsqueda, sinónimos razonables, audiencia).
- **Primeras ~150–160 caracteres**: conviene que lleven la **consulta principal** (tipo de programa + tema + CEPRIJA / México si aplica), porque muchos buscadores truncan el snippet en pantalla.
- **Marca y ubicación en SEO**: no repetir “CEPRIJA” ni ciudad en cada `description` del Markdown. Las fichas de programa concatenan en **`programMetaDescriptionSuffix`** (exportado en [`src/data/config/seo.js`](src/data/config/seo.js)) al armar la meta description en [`src/pages/oferta-academica/[slug].astro`](src/pages/oferta-academica/[slug].astro); el **hero** sigue mostrando solo el texto del frontmatter.
- **Contenido útil**: qué problema resuelve, para quién es, qué enfoque tiene (oralidad, fiscal, cumplimiento, etc.), diferencial institucional cuando sea genuino; **no** duplicar listados de temario (eso va en `curriculum`).
- **Evitar**: parrafadas genéricas (“el mejor”, “único en el mercado”) sin sustancia; repetir palabras clave de forma artificial.

---

## Flujo de trabajo al redactar o editar

1. Leer `title`, `nivel`, `escuela` y, si existen, `curriculum` / `profileAudience` para alinear vocabulario.
2. Ajustar **`duracion`** al **formato estándar** de una línea (sesiones/módulos/ciclos + `(X h)` cuando aplique); quitar meses y fechas sueltas de ahí.
3. Ajustar **`startDate`** para inicio de cohorte o primera sesión; no duplicarlo en `duracion`.
4. Escribir **`description`** (SEO + hero).
5. Condensar **`excerpt`** entre 117 y 160 caracteres, sin datos operativos.
6. Revisar **`title`** solo si el nombre no refleja el programa o choca con el catálogo.
7. Contar caracteres del `excerpt` y corregir hasta cumplir el rango 117–160.

---

## Ejemplo de separación de roles (ilustrativo)

- **Excerpt (117–160)**: solo promesa de valor + ejes temáticos en una frase.
- **Duración**: `10 sesiones (30 h)` o `3 módulos (36 h)`; sin meses en la misma cadena si ya existe `startDate` o el calendario está en el temario.
- **Inicio**: `startDate: "22 de mayo de 2026"` en frontmatter; la tarjeta muestra “Inicio: …” automáticamente.
- **Description (SEO)**: argumento y audiencia; no repetir el calendario sesión a sesión (eso es `curriculum`). Marca y ciudad van en el sufijo meta (`programMetaDescriptionSuffix`), no en cada `description`.
- **Temario por sesión**: primera línea `fecha: tema`; segunda línea frase «Impartido por …» (ver sección Temario arriba).

---

## Referencias en repo

- Esquema de campos: [src/content.config.ts](src/content.config.ts)
- Meta y hero usan `description`: [src/pages/oferta-academica/[slug].astro](src/pages/oferta-academica/[slug].astro)
- Tarjeta de programa: [src/components/program/ProgramOfferCard.astro](src/components/program/ProgramOfferCard.astro) — `excerpt` (fallback a `description`), `duracion`, `modalidad`, `startDate` (“Inicio:”) cuando aplique; enlace al detalle siempre con el texto **“Más información”** (no varía por nivel ni por temario).
