# Plantillas de contenido (solo referencia)

Esta carpeta **no** forma parte de las [content collections](https://docs.astro.build/en/guides/content-collections/) de Astro. Los archivos aquí **no** generan rutas ni aparecen en `getCollection()`.

- Contenido publicado: copia el frontmatter (y el cuerpo, en revista) a:
  - `src/content/programas/*.md`
  - `src/content/revista/*.md`
- Esquema y tipos: `src/content.config.ts`
- **Ruta del programa:** Astro toma el campo `slug` del frontmatter como segmento de URL. Si se omite, usa el nombre del archivo (`curso-foo.md` → `/oferta-academica/curso-foo`). Con `slug` explícito se puede cambiar la URL sin renombrar el archivo. El build falla si dos programas comparten el mismo slug (ver `validateUniqueSlugs`).
- **Prerequisitos:** si el programa tiene `prerequisites`, la página detalle renderiza una card "Requisitos previos" automáticamente.
- Detalle de programa: `src/pages/oferta-academica/[slug].astro`
- Detalle de revista: `src/pages/revista/[slug].astro`
