/**
 * Validación consistente entre pasos: lista explícita de etiquetas y resaltado breve.
 * Uso solo en el navegador (scripts de componentes Astro).
 */

import { validateEmail } from "@lib/validation/enrollment";
import {
  DEFAULT_TEXT_MAX_LENGTH,
  TEXT_MAX_LENGTH_BY_NAME,
} from "@lib/validation/formFieldLimits";
import { isValidPhone } from "@lib/validation/phone";
import {
  isAllowedUploadMime,
  MAX_UPLOAD_BYTES_PER_FILE,
} from "@lib/validation/uploadRules";

const HIGHLIGHT_CLASSES = ["border-red-500", "ring-2", "ring-red-400"] as const;

const ALLOWED_UPLOAD_EXT_RE = /\.(pdf|jpe?g|png|webp|heic|heif)$/i;

export function normalizeLabelText(raw: string): string {
  return raw
    .replace(/\s*\*+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getLabelForControl(el: HTMLElement, container: Element): string {
  const doc = el.ownerDocument ?? document;

  if (el instanceof HTMLInputElement) {
    if (el.type === "radio" || el.type === "checkbox") {
      const wrap = el.closest("label");
      if (wrap?.textContent) {
        const line = wrap.innerText?.split("\n").map((s) => s.trim()).filter(Boolean)[0];
        if (line) return normalizeLabelText(line);
      }
    }
    if (el.id) {
      const sel = `label[for="${CSS.escape(el.id)}"]`;
      const byFor = container.querySelector(sel) ?? doc.querySelector(sel);
      if (byFor?.textContent) return normalizeLabelText(byFor.textContent);
    }
  } else if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    if (el.id) {
      const sel = `label[for="${CSS.escape(el.id)}"]`;
      const byFor = container.querySelector(sel) ?? doc.querySelector(sel);
      if (byFor?.textContent) return normalizeLabelText(byFor.textContent);
    }
  }

  const aria = el.getAttribute("aria-label");
  if (aria?.trim()) return normalizeLabelText(aria);

  const ph = el.getAttribute("placeholder");
  if (ph?.trim()) return normalizeLabelText(ph);

  const name = el.getAttribute("name");
  if (name?.trim()) return normalizeLabelText(name.replace(/[_-]+/g, " "));

  return "Campo obligatorio";
}

function radioGroupPrompt(sample: HTMLInputElement, container: Element): string {
  const grid = sample.closest(".grid");
  let p: Element | null | undefined = grid?.previousElementSibling;
  let hops = 0;
  while (p && hops < 6) {
    if (p instanceof HTMLLabelElement || (p instanceof HTMLElement && p.tagName === "LABEL")) {
      const t = p.textContent?.trim();
      if (t) return `Selecciona: ${normalizeLabelText(t)}`;
    }
    p = p.previousElementSibling;
    hops++;
  }
  const fieldset = sample.closest("fieldset");
  const leg = fieldset?.querySelector("legend");
  if (leg?.textContent?.trim()) return `Selecciona: ${normalizeLabelText(leg.textContent)}`;
  return `Selecciona una opción (${sample.name})`;
}

function isHiddenInFormTree(el: HTMLElement): boolean {
  // Inputs type=file a menudo llevan `class="hidden"` solo por estilo (label visible).
  // No tratar el propio control como "árbol oculto": validar según el contenedor lógico.
  if (el instanceof HTMLInputElement && el.type === "file") {
    const invoice = el.closest("#invoice-fields");
    if (invoice) return invoice.classList.contains("hidden");
    let p: HTMLElement | null = el.parentElement;
    while (p) {
      if (p.classList.contains("hidden")) return true;
      p = p.parentElement;
    }
    return false;
  }
  return el.closest(".hidden") != null;
}

function shouldValidateFormatControl(el: HTMLElement, container: Element): boolean {
  if (!container.contains(el)) return false;
  if (el instanceof HTMLInputElement && el.disabled) return false;
  if (el instanceof HTMLSelectElement && el.disabled) return false;
  if (el instanceof HTMLTextAreaElement && el.disabled) return false;
  if (isHiddenInFormTree(el)) return false;
  return true;
}

function shouldValidateControl(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  container: Element,
): boolean {
  if (!container.contains(el)) return false;
  if (!el.required) return false;
  if (el.disabled) return false;
  // Do not skip `type="hidden"` inputs here. Flatpickr (used for date pickers)
  // converts the original input to `type=hidden` while keeping `required` so the
  // submitted value is the backend-friendly ISO date. Skipping these would let
  // empty dates slip past client validation.
  if (isHiddenInFormTree(el)) return false;
  return true;
}

function isValueSatisfied(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  container: Element,
): boolean {
  if (el instanceof HTMLInputElement && el.type === "checkbox") return el.checked;
  if (el instanceof HTMLInputElement && el.type === "radio") {
    return !!container.querySelector(
      `input[type="radio"][name="${CSS.escape(el.name)}"]:checked`,
    );
  }
  if (el instanceof HTMLInputElement && el.type === "file") return (el.files?.length ?? 0) > 0;
  return String(el.value ?? "").trim() !== "";
}

export type StepValidationResult = {
  ok: boolean;
  missingLabels: string[];
  highlightTargets: HTMLElement[];
};

/**
 * Valida todos los controles `required` visibles dentro del contenedor del paso.
 */
export function validateRequiredFieldsInContainer(container: Element): StepValidationResult {
  const missingLabels: string[] = [];
  const highlightTargets: HTMLElement[] = [];

  const seenRadioGroups = new Set<string>();

  const all = container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    "input[required], select[required], textarea[required]",
  );

  for (const el of all) {
    if (!shouldValidateControl(el, container)) continue;

    if (el instanceof HTMLInputElement && el.type === "radio") {
      const name = el.name;
      if (!name || seenRadioGroups.has(name)) continue;
      seenRadioGroups.add(name);
      const anyChecked = !!container.querySelector(
        `input[type="radio"][name="${CSS.escape(name)}"]:checked`,
      );
      if (!anyChecked) {
        missingLabels.push(radioGroupPrompt(el, container));
        highlightTargets.push((el.closest(".grid") as HTMLElement) ?? el);
      }
      continue;
    }

    if (!isValueSatisfied(el, container)) {
      missingLabels.push(getLabelForControl(el, container));
      highlightTargets.push(el);
    }
  }

  return {
    ok: missingLabels.length === 0,
    missingLabels,
    highlightTargets,
  };
}

function fileFormatHighlightTarget(el: HTMLInputElement): HTMLElement {
  return (
    (el.closest(".file-group") as HTMLElement | null) ??
    (el.closest(".relative") as HTMLElement | null) ??
    el
  );
}

/**
 * Formato y tamaño/tipo de archivo, además de requisitos numéricos (tel, CP, CURP).
 * Ejecutar después de `validateRequiredFieldsInContainer` o usar `validateStepSection`.
 */
export function validateFieldFormatsInContainer(container: Element): StepValidationResult {
  const missingLabels: string[] = [];
  const highlightTargets: HTMLElement[] = [];

  for (const el of container.querySelectorAll<HTMLInputElement>('input[type="tel"]')) {
    if (!shouldValidateFormatControl(el, container)) continue;
    const v = el.value.trim();
    if (!v && !el.required) continue;
    if (!isValidPhone(v)) {
      missingLabels.push(
        `${getLabelForControl(el, container)} (10 dígitos nacionales o +52 / 521…)`,
      );
      highlightTargets.push(el);
    }
  }

  for (const el of container.querySelectorAll<HTMLInputElement>('input[name="cp"]')) {
    if (!shouldValidateFormatControl(el, container)) continue;
    const digits = el.value.replace(/\D/g, "");
    const v = el.value.trim();
    if (!v && !el.required) continue;
    if (digits.length !== 5) {
      missingLabels.push(`${getLabelForControl(el, container)} (5 dígitos)`);
      highlightTargets.push(el);
    }
  }

  for (const el of container.querySelectorAll<HTMLInputElement>('input[name="curp"]')) {
    if (!shouldValidateFormatControl(el, container)) continue;
    const t = el.value.trim();
    if (!t && !el.required) continue;
    if (t.length !== 18) {
      missingLabels.push(`${getLabelForControl(el, container)} (18 caracteres)`);
      highlightTargets.push(el);
    }
  }

  for (const el of container.querySelectorAll<HTMLInputElement>('input[type="email"]')) {
    if (!shouldValidateFormatControl(el, container)) continue;
    const t = el.value.trim();
    if (!t && !el.required) continue;
    if (validateEmail(t)) {
      missingLabels.push(getLabelForControl(el, container));
      highlightTargets.push(el);
    }
  }

  for (const el of container.querySelectorAll<HTMLInputElement>("input")) {
    if (!shouldValidateFormatControl(el, container)) continue;
    if (
      el.type === "hidden" ||
      el.type === "file" ||
      el.type === "radio" ||
      el.type === "checkbox" ||
      el.type === "email" ||
      el.type === "tel"
    ) {
      continue;
    }
    if (el.type !== "text") continue;
    const name = el.getAttribute("name");
    if (!name) continue;
    const max = TEXT_MAX_LENGTH_BY_NAME[name] ?? DEFAULT_TEXT_MAX_LENGTH;
    if (el.value.length > max) {
      missingLabels.push(
        `${getLabelForControl(el, container)} (máx. ${max} caracteres)`,
      );
      highlightTargets.push(el);
    }
  }

  for (const el of container.querySelectorAll<HTMLTextAreaElement>("textarea")) {
    if (!shouldValidateFormatControl(el, container)) continue;
    const name = el.getAttribute("name");
    if (!name) continue;
    const max = TEXT_MAX_LENGTH_BY_NAME[name] ?? DEFAULT_TEXT_MAX_LENGTH;
    const t = el.value;
    if (!t.trim() && !el.required) continue;
    if (t.length > max) {
      missingLabels.push(
        `${getLabelForControl(el, container)} (máx. ${max} caracteres)`,
      );
      highlightTargets.push(el);
    }
  }

  for (const el of container.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
    if (!shouldValidateFormatControl(el, container)) continue;
    const f = el.files?.[0];
    if (!f) continue;
    if (f.size > MAX_UPLOAD_BYTES_PER_FILE) {
      missingLabels.push(`${getLabelForControl(el, container)} (máx. 10 MB)`);
      highlightTargets.push(fileFormatHighlightTarget(el));
    }
    const mimeRaw = (f.type || "").split(";")[0].trim().toLowerCase();
    const extOk = ALLOWED_UPLOAD_EXT_RE.test(f.name);
    const mimeOk = !mimeRaw || isAllowedUploadMime(mimeRaw);
    if (!mimeOk && !extOk) {
      missingLabels.push(
        `${getLabelForControl(el, container)} (solo PDF o imagen JPEG, PNG o WebP)`,
      );
      highlightTargets.push(fileFormatHighlightTarget(el));
    }
  }

  return {
    ok: missingLabels.length === 0,
    missingLabels,
    highlightTargets,
  };
}

/** Obligatorios visibles + reglas de formato en un solo paso. */
export function validateStepSection(container: Element): StepValidationResult {
  const req = validateRequiredFieldsInContainer(container);
  if (!req.ok) return req;
  return validateFieldFormatsInContainer(container);
}

export function formatStepValidationMessage(stepTitle: string, labels: string[]): string {
  if (labels.length === 0) return "";
  const unique = [...new Set(labels)];
  const bullets = unique.map((l) => `• ${l}`).join("\n");
  return `${stepTitle}\n\nCompleta lo siguiente para continuar:\n\n${bullets}`;
}

let highlightTimer: ReturnType<typeof setTimeout> | null = null;

export function flashInvalidFields(targets: HTMLElement[], durationMs = 4500): void {
  if (highlightTimer) {
    clearTimeout(highlightTimer);
    highlightTimer = null;
  }

  for (const el of targets) {
    for (const c of HIGHLIGHT_CLASSES) el.classList.add(c);
  }

  const first = targets[0];
  first?.scrollIntoView({ behavior: "smooth", block: "center" });

  highlightTimer = setTimeout(() => {
    for (const el of targets) {
      for (const c of HIGHLIGHT_CLASSES) el.classList.remove(c);
    }
    highlightTimer = null;
  }, durationMs);
}

/**
 * Resalta campos inválidos y hace scroll al primero. Sin `alert()` del navegador.
 * El título del paso se conserva en la firma por si más adelante se muestra en un banner `aria-live`.
 */
export function reportStepValidationFailure(_stepTitle: string, result: StepValidationResult): void {
  if (result.ok) return;
  flashInvalidFields(result.highlightTargets);
}
