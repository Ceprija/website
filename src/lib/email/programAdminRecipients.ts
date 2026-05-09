import type { CollectionEntry } from "astro:content";
import {
  CONTACT_EMAIL,
  EMAIL_CONTROL_ESCOLAR,
  EMAIL_EDUCACION_CONTINUA,
} from "astro:env/server";
import { getProgramStatus } from "@lib/programPayments";

type ProgramEntry = CollectionEntry<"programas">;

const EDUCACION_CONTINUA_FALLBACK = "educacioncontinua@ceprija.edu.mx";
const CONTROL_ESCOLAR_FALLBACK = "controlescolar@ceprija.edu.mx";
const ADMIN_EMAIL = "admin@ceprija.edu.mx";
const SOPORTE_WEB_EMAIL = "desarrolloweb@ceprija.edu.mx";

function cleanEmail(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

export function programAdminEmail(program: ProgramEntry | undefined): string {
  const educacionContinua = cleanEmail(
    EMAIL_EDUCACION_CONTINUA,
    EDUCACION_CONTINUA_FALLBACK,
  );
  const controlEscolar = cleanEmail(EMAIL_CONTROL_ESCOLAR, CONTROL_ESCOLAR_FALLBACK);

  if (program) {
    const status = getProgramStatus(program);
    if (status === "waitlist") return educacionContinua;
    if (status === "active" && program.data.escuela === "juridica") {
      return controlEscolar;
    }
    if (["curso", "taller", "diplomado"].includes(program.data.nivel)) {
      return educacionContinua;
    }
  }

  return cleanEmail(CONTACT_EMAIL, educacionContinua);
}

export function programAdminRecipients(
  program: ProgramEntry | undefined,
): Array<{ email: string }> {
  const emails = new Set([programAdminEmail(program), ADMIN_EMAIL, SOPORTE_WEB_EMAIL]);
  return [...emails].map((email) => ({ email }));
}

export function brochureDownloadRecipients(): Array<{ email: string }> {
  const educacionContinua = cleanEmail(
    EMAIL_EDUCACION_CONTINUA,
    EDUCACION_CONTINUA_FALLBACK,
  );
  const emails = new Set([educacionContinua, ADMIN_EMAIL, SOPORTE_WEB_EMAIL]);
  return [...emails].map((email) => ({ email }));
}
