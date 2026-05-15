## Docente — texto (YAML + Markdown)

Perfiles en `src/content/docentes/*.md`. Campos **obligatorios** siempre: `name`, `degree`, `bio`, `image`, `order` (y `draft` si aplica).

### Perfil estructurado (recomendado para fichas nuevas)

Si defines **cualquiera** de estos campos opcionales, la página de detalle usa el layout con títulos fijos:

1. **`cargo_intro`** — Firma / rol (párrafo bajo el grado; equivale a la segunda línea del brief).
2. **`area_especialidad`** — Bloque “Área de Especialidad”. Si falta pero existe `position_laboral`, se muestra ahí como respaldo.
3. **`hito_profesional`** — Bloque “Hito Profesional”.
4. **Trayectoria académica** — En el **cuerpo Markdown** del archivo (después del frontmatter), **o** en frontmatter con **`trayectoria_academica`** (texto corrido).

Listas opcionales bajo esos bloques: `education`, `experience_institutional`. Si rellenas `hito_profesional`, la lista `experience_institutional` no se duplica en “Docencia en”.

### Perfiles antiguos (sin migrar)

Si **no** hay ninguno de `cargo_intro`, `area_especialidad`, `hito_profesional`, `trayectoria_academica`, se mantiene el layout anterior: “Trayectoria” + “Cargo” + listas.

---

## What is this for?

This is the **standard prompt** we use to generate or normalize **faculty headshot images** so they look consistent across:

- `src/pages/docentes/[id].astro` (large left-side portrait)
- `src/components/sections/Faculty.astro` (grid + slider cards)

It aims to reduce visual variance (framing, background, lighting) so the site looks cohesive even when the original photos come from different sources.

## Faculty markdown (`src/content/docentes/*.md`)

**Required frontmatter (all entries):** `name`, `degree`, `bio`, `image`, `order`, `draft` (default `false`).

### New structured profile (recommended)

If **any** of `cargo_intro`, `area_especialidad`, `hito_profesional`, or `trayectoria_academica` is set, the detail page uses the **structured layout** (headings: *Área de Especialidad*, *Hito Profesional*, *Trayectoria Académica*).

| Campo | Uso |
|-------|-----|
| `cargo_intro` | Firma / rol en una o dos líneas (debajo del `degree`). |
| `area_especialidad` | Texto del bloque *Área de Especialidad*. Si falta, se usa `position_laboral` como respaldo. |
| `hito_profesional` | Texto del bloque *Hito Profesional*. Si falta y hay un solo ítem en `experience_institutional`, se usa como respaldo. |
| `trayectoria_academica` | Texto del último bloque en frontmatter (alternativa al cuerpo Markdown). |
| `trayectoria_titulo` | Título del último bloque (por defecto «Trayectoria Académica»). Ej.: «Trayectoria Profesional» (Aida) o «Trayectoria» (Alfonso). |
| `education` | Opcional; lista *Formación Académica* (se muestra bajo la trayectoria si existe). |
| `experience_institutional` | En layout estructurado solo se lista si **no** hay `hito_profesional` (evita duplicar el hito). |

### Legacy profile (sin migrar)

Omite los cuatro campos anteriores y usa como hasta ahora: cuerpo Markdown o `fullBio` bajo *Trayectoria*, más `position_laboral` (*Cargo*), `education`, `experience_institutional` (*Docencia en*).

## How to use

- In Gemini (or any image-generation / image-editing AI), **paste the prompt below**
- Attach the professor’s source photo (if the tool supports “image-to-image”)
- Replace the subject description so it matches the real person and their accessories

Important: use this as **editing / standardization** (crop + lighting + background). Avoid changing identity or facial features.

## Prompt (edit placeholders)

A high-resolution, professional studio headshot of [INSERT_PERSON_DESCRIPTION] with [INSERT_HAIR_DESCRIPTION] and a neutral expression, looking directly at the camera. The subject is wearing a classic black, two-button business blazer over a black top, accessorized with [INSERT_ACCESSORIES_E.G._A_SINGLE-STRAND_PEARL_NECKLACE_AND_MATCHING_PEARL_STUD_EARRINGS]. The lighting is clean, even studio lighting with no shadows on the face or the background. The background is a smooth, light-gray gradient that softly brightens towards the center behind the subject, with a subtle dark vignette in the lower corners for focus. The composition is a sharp, crisp medium close-up, cropped mid-torso, ensuring deep focus across all details of the face and the textures of the clothing and jewelry. The overall presentation is clean and formal.

## Constraints (recommended)

- Do not change identity, age, facial features, body type, or skin tone.
- Do not add text, logos, watermarks, or extra people.
- Keep hands/arms natural (avoid extra fingers if the pose includes hands).