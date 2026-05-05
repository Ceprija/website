export const seoConfig = {
    siteName: "CEPRIJA",
    default: {
        title: "CEPRIJA - Centro de Preparación Integral en Materia Jurídica y Administrativa",
        description: "Institución líder en formación jurídica y administrativa de alto nivel. Maestrías, diplomados y cursos especializados en Guadalajara.",
        image: "/images/og-image.jpg",
        keywords: "derecho, maestría, penal, administrativo, cursos, diplomados, guadalajara, ceprija, educación continua"
    },
    pages: {
        home: {
            title: "CEPRIJA",
            description: "CEPRIJA forma líderes en el ámbito jurídico y administrativo con programas de excelencia académica y enfoque práctico.",
        },
        about: {
            title: "Nosotros | CEPRIJA",
            description: "Conoce nuestra historia, misión y valores. Más de una década formando profesionales exitosos en el ámbito legal y empresarial.",
        },
        academicOffer: {
            title: "Oferta Académica | CEPRIJA",
            description: "Explora nuestros programas de posgrado y educación continua: Maestría en Derecho Penal, cursos especializados y diplomados.",
        },
        contact: {
            title: "Contáctanos",
            description: "Contáctanos para más información sobre nuestros programas. Estamos ubicados en la Colonia Americana, Guadalajara.",
        },
        privacy: {
            title: "Aviso de Privacidad | CEPRIJA",
            description: "Consulta nuestro Aviso de Privacidad Integral, política de cookies y uso de imagen.",
        },
        terms: {
            title: "Términos y Condiciones | CEPRIJA",
            description: "Consulta los Términos y Condiciones de uso del sitio web de CEPRIJA.",
        },
        faculty: {
            title: "Claustro Docente | CEPRIJA",
            description: "Conoce a nuestros docentes expertos, reconocidos profesionales en el ámbito jurídico y administrativo.",
        },
        juridica: {
            title: "Formación Jurídica | CEPRIJA",
            description: "Especialízate en derecho con nuestra Maestría en Sistema Acusatorio y cursos de actualización jurídica.",
        },
        administrativa: {
            title: "Formación Económico-Administrativa | CEPRIJA",
            description: "Cursos y talleres enfocados en el desarrollo de habilidades administrativas, fiscales y financieras.",
        },
        integral: {
            title: "Formación Integral | CEPRIJA",
            description: "Programas diseñados para el desarrollo humano y profesional integral.",
        }
    }
};

/**
 * Se añade solo a la meta description de fichas de programa (`oferta-academica/[slug]`).
 * Refuerza marca y SEO local sin repetir en el párrafo hero del Markdown.
 */
export const programMetaDescriptionSuffix =
    " · CEPRIJA · Guadalajara, Jalisco, México";
