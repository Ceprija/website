# Plantillas de contenido (solo referencia)

Esta carpeta **no** forma parte de las [content collections](https://docs.astro.build/en/guides/content-collections/) de Astro. Los archivos aquí **no** generan rutas ni aparecen en `getCollection()`.

- Contenido publicado: copia el frontmatter (y el cuerpo, en revista) a:
  - `src/content/programas/*.md`
  - `src/content/revista/*.md`
- Esquema y tipos: `src/content.config.ts`
- Detalle de programa en el sitio: `src/pages/oferta-academica/[slug].astro`
- Detalle de revista: `src/pages/revista/[slug].astro`
