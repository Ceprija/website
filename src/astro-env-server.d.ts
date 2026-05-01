/**
 * Declares exports for `import { … } from "astro:env/server"`.
 * Matches `env.schema` in astro.config.mjs. Needed because `.astro/` is
 * gitignored until someone runs `astro sync`; editors/CI may miss generated types.
 */
declare module "astro:env/server" {
  export const SITE_URL: string | undefined;
  export const STRIPE_SECRET_KEY: string | undefined;
  export const STRIPE_WEBHOOK_SECRET: string | undefined;
  export const STRIPE_ALLOWED_PRICE_IDS: string | undefined;
  export const KEY_API_BREVO: string | undefined;
  export const EMAIL_CONTROL_ESCOLAR: string | undefined;
  export const EMAIL_SOPORTE_WEB: string | undefined;
  export const SMTP_FROM: string | undefined;
  export const CONTACT_EMAIL: string | undefined;
  export const EMAIL_EDUCACION_CONTINUA: string | undefined;
  export const URL_BASE_API: string | undefined;
}
