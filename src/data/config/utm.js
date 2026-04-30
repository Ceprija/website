/**
 * Configuración centralizada para el rastreo de campañas UTM.
 * 
 * Este archivo permite gestionar de una forma ágil qué parámetros se 
 * interceptarán de la URL y a qué enlaces específicos se aplicarán.
 */
export const utmConfig = {
    // 1. Parámetros que se buscarán en la URL (y que se guardarán en sesión)
    paramsToTrack: [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "utm_id",
        // Puedes agregar más parámetros personalizados aquí si lo deseas
        // "gclid",
        // "fbclid"
    ],

    // 2. Selectores CSS de los enlaces a los que se les inyectarán las UTMs
    targetSelectors: [
        // Botones y enlaces marcados específicamente para el rastreo
        'a[data-utm="true"]',

        // Enlaces de WhatsApp
        'a[href*="wa.me"]',
        'a[href*="api.whatsapp.com"]',

        // Ejemplos de otras posibles integraciones:
        // 'a[href*="registro.ceprija.edu.mx"]',
        // 'a[href*="sistemadealumnos.com"]'
    ]
};
