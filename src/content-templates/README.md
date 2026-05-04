# Plantillas de contenido (solo referencia)

Esta carpeta **no** forma parte de las [content collections](https://docs.astro.build/en/guides/content-collections/) de Astro. Los archivos aquí **no** generan rutas ni aparecen en `getCollection()`.

- Contenido publicado: copia el frontmatter (y el cuerpo, en revista) a:
  - `src/content/programas/*.md`
  - `src/content/revista/*.md`
- Esquema y tipos: `src/content.config.ts`
- **Ruta del programa:** Astro toma el campo `slug` del frontmatter como segmento de URL. Si se omite, usa el nombre del archivo (`curso-foo.md` → `/oferta-academica/curso-foo`). Con `slug` explícito se puede cambiar la URL sin renombrar el archivo. El build falla si dos programas comparten el mismo slug (ver `validateUniqueSlugs`).
- **Prerequisitos:** si el programa tiene `prerequisites`, la página detalle renderiza una card "Requisitos previos" automáticamente.
- **Registro académico:** campo opcional `registroAcademico` (p. ej. diplomados ESDIP-…); en la ficha se muestra como “Registro:”. `rvoe` sigue siendo para RVOE de titulación.
- **Variantes (módulos / fechas):** campo opcional `variantOptions` para programas que se venden por módulo individual o paquete (talleres modulares, cohortes con varias fechas). Cuando está definido, el flujo de inscripción muestra un paso extra con dropdowns para elegir el módulo/paquete y la fecha; el `priceId` de Stripe se resuelve a partir de la opción y la modalidad. Requiere `enrollmentFlow: "application"`. Cada opción de módulo lleva su propio par de `stripePriceIds.presencial` / `stripePriceIds.online`.
- **Flujo de inscripción multi-grado (`enrollmentFlow: "application"`):** `/enrollment/[slug]` captura varios grados académicos por solicitud. La página se prepopula según `nivel`:
  - `maestria` y `especialidad`: 1 Licenciatura requerida (no se puede eliminar).
  - `doctorado`: 1 Licenciatura + 1 Maestría requeridas.
  - Otros niveles (`curso`, `taller`, `diplomado`) suelen usar `enrollmentFlow: "inline"` y no requieren grados.
  El aspirante puede agregar más grados; se valida orden cronológico (Licenciatura → Especialidad/Maestría → Doctorado) y los mínimos se aplican también en el servidor. El paso de documentos genera automáticamente un par de campos **Título + Cédula** por cada grado, además de un CV global. Se aceptan PDF, JPG, PNG y HEIC (máx. 10 MB por archivo). **Se eliminó el Kardex** del flujo.
- Detalle de programa: `src/pages/oferta-academica/[slug].astro`
- Detalle de revista: `src/pages/revista/[slug].astro`
