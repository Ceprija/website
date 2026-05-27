import { defineConfig, envField } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import partytown from '@astrojs/partytown';

// https://astro.build/config
// Astro 5: `output: 'static'` + Node adapter + `export const prerender = false` on API routes
// matches the old “hybrid” model (static pages + server endpoints). Use `output: 'server'`
// only if you want SSR for all routes by default.
export default defineConfig({
  site: 'https://ceprija.edu.mx',
  security: {
    // Public write endpoints implement their own origin, content-type, honeypot,
    // and rate-limit guards. Disable Astro's pre-route POST origin check because
    // it can compare against the internal proxy origin behind Nginx/PM2.
    checkOrigin: false,
  },
  env: {
    schema: {
      SITE_URL: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
      STRIPE_SECRET_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      STRIPE_WEBHOOK_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      STRIPE_ALLOWED_PRICE_IDS: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      KEY_API_BREVO: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      EMAIL_CONTROL_ESCOLAR: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      EMAIL_SOPORTE_WEB: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      SMTP_FROM: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      CONTACT_EMAIL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      ADMIN_EMAIL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      EMAIL_EDUCACION_CONTINUA: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      /** Set to "false" / "0" / "no" to omit Control Escolar from POST /api/enrollment admin mail only (e.g. staging). Default: notify. */
      NOTIFY_CONTROL_ESCOLAR_ENROLLMENT: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      SCHOOL_HUB_SUBMISSIONS_URL: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      SCHOOL_HUB_SUBMISSIONS_TOKEN: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      /** Si está definido, todos los avisos admin (brochure, inscripción, wire, etc.) van solo a este correo. */
      EMAIL_ADMIN_ONLY_RECIPIENT: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
  },
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) =>
        !page.includes("/educacion-continua-inscripciones"),
    }),
    partytown({
      config: {
        forward: ['dataLayer.push', 'fbq'],
      },
    }),
  ],
  // Keep pages prerendered for SEO, but serve API routes dynamically.
  // This requires deploying the Node adapter output (not a purely static host).
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  adapter: node({
    mode: 'standalone',
  }),
});
