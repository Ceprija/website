/**
 * Validación consistente entre pasos: lista explícita de etiquetas y resaltado breve.
 * Uso solo en el navegador (scripts de componentes Astro).
 */

const HIGHLIGHT_CLASSES = ["border-red-500", "ring-2", "ring-red-400"] as const;

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

function shouldValidateControl(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  container: Element,
): boolean {
  if (!container.contains(el)) return false;
  if (!el.required) return false;
  if (el.disabled) return false;
  if (el instanceof HTMLInputElement && el.type === "hidden") return false;
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

export function reportStepValidationFailure(stepTitle: string, result: StepValidationResult): void {
  if (result.ok) return;
  flashInvalidFields(result.highlightTargets);
  alert(formatStepValidationMessage(stepTitle, result.missingLabels));
}
