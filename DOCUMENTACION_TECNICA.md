# Documentación Técnica del Proyecto - Sitio Web CEPRIJA

Este documento sirve como guía completa para el mantenimiento, modificación y entendimiento del sitio web de CEPRIJA.

---

## 1. Tecnologías Principales

El proyecto está construido sobre un stack moderno y eficiente diseñado para el rendimiento ("Optimal Load") y la facilidad de mantenimiento:

*   **[Astro](https://astro.build/)**: Framework web principal. Su filosofía es enviar "cero JavaScript" al cliente por defecto, lo que garantiza una carga extremadamente rápida. Genera HTML estático en el servidor (SSG).
*   **[Tailwind CSS](https://tailwindcss.com/)**: Framework de CSS para estilos. Permite diseñar directamente en el HTML usando clases de utilidad predefinidas.
*   **JavaScript (Vanilla)**: Se utiliza JavaScript nativo para interacciones ligeras (menú móvil, animaciones de scroll) sin depender de librerías pesadas como React o Vue, a menos que sea estrictamente necesario.

---

## 2. Estructura del Proyecto

Entender la estructura de carpetas es vital para realizar cambios:

*   **`src/`**: Carpeta principal del código fuente.
    *   **`components/`**: Bloques de construcción reutilizables (ej. `Header.astro`, `Footer.astro`, `Card.astro`).
    *   **`layouts/`**: Plantillas base que envuelven a las páginas (ej. `Layout.astro` contiene el `<head>`, `<body>`, `Header` y `Footer`).
    *   **`pages/`**: Define las rutas del sitio web. Cada archivo `.astro` o `.md` aquí se convierte en una URL.
    *   **`data/`**: Contiene archivos `.js` o `.json` con la información del sitio (docentes, programas, blog). **Este es el lugar principal para actualizar textos e información sin tocar código complejo.**
    *   **`styles/`**: Archivos CSS globales (ej. `animations.css`).

---

## 3. Flujo del Sitio Web (Sitemap)

El enrutamiento en Astro se basa en archivos (File-based routing):

*   **Inicio**: `src/pages/index.astro` -> `ceprija.edu.mx/`
*   **Nosotros**: `src/pages/nosotros.astro` -> `ceprija.edu.mx/nosotros`
*   **Oferta Académica**:
    *   Índice: `src/pages/oferta-academica.astro`
    *   Sub-áreas: `src/pages/oferta-academica/formacion-juridica.astro`, etc.
    *   **Detalle de Programa (Dinámico)**: `src/pages/oferta-academica/[slug].astro`. Este archivo genera una página única para cada programa definido en `src/data/programs*.js`.
*   **Docentes**:
    *   Índice: `src/pages/docentes/index.astro`
    *   **Perfil (Dinámico)**: `src/pages/docentes/[id].astro`.
*   **Blog**:
    *   Índice: `src/pages/blog.astro`
    *   **Post (Dinámico)**: `src/pages/blog/[slug].astro`.
*   **Contacto**: `src/pages/contacto.astro`

---

## 4. Guía de Estilos y Clases (Design System)

El sitio utiliza **Tailwind CSS**. No escribimos CSS tradicional (hojas de estilo separadas) para cada componente, sino que aplicamos clases directamente a las etiquetas HTML.

### Archivo de Configuración
Las personalizaciones del diseño (colores corporativos, fuentes) se encuentran en `tailwind.config.mjs`.

*   **Fuentes**:
    *   Títulos: `font-serif` (Configurada como **Merriweather**).
    *   Texto e Interfaz: `font-sans` (Configurada como **IBM Plex Sans**).

*   **Colores**:
    *   `text-primary`: Color principal (Azul oscuro institucional).
    *   `text-secondary`: Color de acento (Dorado/Bronce).
    *   `bg-gray-50`: Fondos ligeros para secciones alternas.

### Cómo agregar estilos
Para cambiar la apariencia de un elemento, agrega o modifica sus clases:

**Ejemplo:**
```html
<!-- Botón actual -->
<a class="bg-primary text-white py-3 px-6 rounded-full font-bold hover:bg-blue-900 transition-colors">
  Botón
</a>

<!-- Clases explicadas:
  bg-primary: Fondo color primario
  text-white: Texto blanco
  py-3 px-6: Padding vertical 3 unid., horizontal 6 unid.
  rounded-full: Bordes completamente redondos
  font-bold: Negrita
  hover:bg-blue-900: Al pasar el mouse, cambiar fondo a azul más oscuro
  transition-colors: Suavizar el cambio de color
-->
```

**Recurso Clave:** Para buscar qué clase hace qué (ej. "¿Cómo poner margen arriba?"), consulta la **[Documentación de Tailwind CSS](https://tailwindcss.com/docs)**.

---

## 5. Sistema de Animaciones (Scroll Animations)

El sitio implementa animaciones ligeras que se activan cuando el usuario hace scroll y el elemento entra en pantalla.

### Cómo usarlas
Simplemente agrega el atributo `data-animate` a cualquier etiqueta HTML.

1.  **Tipos de Animación:**
    *   `data-animate="fade-up"`: Aparece suavemente desde abajo. Ideal para textos y tarjetas.
    *   `data-animate="zoom-in"`: Efecto de zoom suave. Ideal para imágenes destacadas o mapas.
    *   `data-animate="fade-in"`: Aparición simple.

2.  **Retraso (Staggering):**
    Si tienes varios elementos (como una cuadrícula de tarjetas), puedes hacer que aparezcan uno tras otro usando `data-delay`.
    *   `data-delay="100"`: Espera 100ms.
    *   `data-delay="200"`: Espera 200ms...

### Ejemplo de uso:
```html
<div class="grid grid-cols-3">
    <!-- Tarjeta 1: Inmediata -->
    <div data-animate="fade-up">... content ...</div>

    <!-- Tarjeta 2: Espera un poco -->
    <div data-animate="fade-up" data-delay="100">... content ...</div>

    <!-- Tarjeta 3: Espera un poco más -->
    <div data-animate="fade-up" data-delay="200">... content ...</div>
</div>
```

---

## 6. Gestión de Contenido (Data)

Para facilitar los cambios sin riesgo de "romper" el sitio, gran parte del contenido está separado en la carpeta `src/data/`.

### Editar Programas Académicos
*   Archivos: `src/data/programs-juridica.js`, `src/data/programs-administrativa.js`, etc.
*   Formato: Son listas de objetos. Puedes cambiar títulos, descripciones, precios y planes de estudio aquí.
    ```javascript
    {
        id: "maestria-derecho-penal",
        title: "Maestría en Derecho Penal", // Cambiar título
        level: "Maestría",
        // ...
    }
    ```

### Editar Docentes
*   Archivo: `src/data/faculty.js`
*   Aquí puedes agregar nuevos docentes, cambiar sus fotos o actualizar sus biografías.

### Editar Blog
*   Archivo: `src/data/posts.js`
*   Agrega nuevos artículos al array para que aparezcan automáticamente en el blog.

---

## 7. Modificación de Componentes

### Componentes .astro
Un componente Astro tiene dos partes:
1.  **Script del Servidor (entre `---`)**: Aquí escribes JavaScript que se ejecuta antes de generar la página (importar otros componentes, recibir datos).
2.  **Plantilla HTML**: El diseño visual.

**Ejemplo de modificación (`Button.astro`):**
Si quieres agregar un icono a todos los botones del sitio:
1.  Abre `src/components/Button.astro`.
2.  Agrega la etiqueta `<svg>...</svg>` dentro de la etiqueta `<a>` o `<button>`.
3.  Automáticamente, todos los botones del sitio se actualizarán.

### Layout Principal (`Layout.astro`)
Si necesitas agregar un script global (como Google Analytics, Chatbot, Meta Pixel):
1.  Edita `src/layouts/Layout.astro`.
2.  Coloca el script dentro de `<head>` o antes de cerrar `</body>`. Note que ya existen componentes `AnalyticsHead` y `AnalyticsBody` para facilitar esto de forma ordenada.

---

## 8. Comandos Útiles

*   `npm run dev` o `pnpm run dev`: Inicia el servidor local para desarrollo.
*   `npm run build`: Genera la versión final del sitio web (carpeta `dist/`) lista para subir al hosting.
*   `npm run preview`: Vista previa local de la versión final construida.
