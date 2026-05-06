## What is this for?

This is the **standard prompt** we use to generate or normalize **faculty headshot images** so they look consistent across:

- `src/pages/docentes/[id].astro` (large left-side portrait)
- `src/components/sections/Faculty.astro` (grid + slider cards)

It aims to reduce visual variance (framing, background, lighting) so the site looks cohesive even when the original photos come from different sources.

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