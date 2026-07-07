import {
  reportStepValidationFailure,
  validateStepSection,
} from "@lib/client/multiStepFormValidation";

function queryInput(form: HTMLFormElement, selector: string): HTMLInputElement | null {
  const el = form.querySelector(selector);
  return el instanceof HTMLInputElement ? el : null;
}

function querySelect(form: HTMLFormElement, selector: string): HTMLSelectElement | null {
  const el = form.querySelector(selector);
  return el instanceof HTMLSelectElement ? el : null;
}

function readFormConfig(form: HTMLFormElement): {
  allowedPrograms: readonly string[];
  startCycle: string;
} | null {
  const startCycle = form.dataset.startCycle?.trim() ?? "";
  const rawPrograms = form.dataset.allowedPrograms;
  if (!startCycle || !rawPrograms) return null;

  try {
    const parsed: unknown = JSON.parse(rawPrograms);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      return null;
    }
    return { allowedPrograms: parsed, startCycle };
  } catch {
    return null;
  }
}

export function initSeptember2026Form(): void {
  const form = document.getElementById("septiembre-2026-form");
  if (!(form instanceof HTMLFormElement)) return;

  const config = readFormConfig(form);
  if (!config) {
    console.error("September 2026 form: missing or invalid data attributes");
    return;
  }

  const { allowedPrograms, startCycle } = config;

  const statusDiv = document.getElementById("septiembre-2026-status");
  const submitBtn = document.getElementById("septiembre-2026-submit");
  const spinner = document.getElementById("septiembre-2026-spinner");
  const btnText =
    submitBtn instanceof HTMLButtonElement ? submitBtn.querySelector("span") : null;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const stepCheck = validateStepSection(form);
    if (!stepCheck.ok) {
      reportStepValidationFailure("Registro septiembre 2026", stepCheck);
      return;
    }

    const startCycleValue = querySelect(form, "#startCycle")?.value.trim();
    const program = querySelect(form, "#program")?.value.trim();
    const name = queryInput(form, "#name")?.value.trim();
    const email = queryInput(form, "#email")?.value.trim().toLowerCase();
    const phone = queryInput(form, "#phone")?.value.trim();
    const carrera = queryInput(form, "#carrera")?.value.trim() ?? "";
    const website =
      queryInput(form, 'input[name="website"]')?.value.trim() ?? "";

    if (
      !program ||
      !allowedPrograms.includes(program) ||
      startCycleValue !== startCycle
    ) {
      const programEl = querySelect(form, "#program");
      const cycleEl = querySelect(form, "#startCycle");
      const highlightTargets: HTMLElement[] = [];
      if (programEl) highlightTargets.push(programEl);
      if (cycleEl) highlightTargets.push(cycleEl);
      reportStepValidationFailure("Registro septiembre 2026", {
        ok: false,
        missingLabels: ["Selecciona un programa y ciclo válidos"],
        highlightTargets,
      });
      return;
    }

    if (statusDiv) {
      statusDiv.className = "hidden p-3 rounded-lg text-sm";
      statusDiv.textContent = "";
    }

    if (submitBtn instanceof HTMLButtonElement && spinner && btnText) {
      submitBtn.disabled = true;
      spinner.classList.remove("hidden");
      btnText.textContent = "Enviando...";
    }

    try {
      const response = await fetch("/api/inscripciones-septiembre-2026", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          carrera,
          program,
          startCycle: startCycleValue,
          website,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
        code?: string;
      } | null;

      if (response.ok) {
        if (statusDiv) {
          statusDiv.textContent =
            "¡Gracias! Recibimos tu registro. Un asesor de CEPRIJA se comunicará contigo pronto.";
          statusDiv.classList.remove("hidden");
          statusDiv.classList.add(
            "bg-green-100",
            "text-green-800",
            "border",
            "border-green-200",
          );
        }
        form.reset();
        const programSelect = querySelect(form, "#program");
        if (programSelect) programSelect.selectedIndex = 0;
      } else {
        const serverMessage = result?.message || result?.error;
        throw new Error(
          [serverMessage, result?.code].filter(Boolean).join(" — ") ||
            "Error al enviar el formulario",
        );
      }
    } catch (error) {
      if (statusDiv) {
        statusDiv.textContent =
          error instanceof Error && error.message
            ? error.message
            : "Hubo un error al enviar tu registro. Por favor intenta nuevamente o contáctanos por teléfono.";
        statusDiv.classList.remove("hidden");
        statusDiv.classList.add(
          "bg-red-100",
          "text-red-800",
          "border",
          "border-red-200",
        );
      }
      console.error("Error submitting September 2026 form:", error);
    } finally {
      if (submitBtn instanceof HTMLButtonElement && spinner && btnText) {
        submitBtn.disabled = false;
        spinner.classList.add("hidden");
        btnText.textContent = "Enviar registro";
      }
    }
  });
}
