/**
 * Brochure lead modal: open / close / submit to /api/brochure-download.
 * Shared by oferta fichas and Meta Ads landings.
 */
export type BrochureLeadFormPayload = {
  trackingRequestId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  website: string;
  programTitle: string;
  programSlug: string;
  brochure: string;
  landingSlug?: string;
};

function downloadBrochure(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function focusableElements(container: Element): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function setModalVisualState(modal: HTMLElement, open: boolean) {
  const panel = modal.querySelector<HTMLElement>("[data-modal-panel]");
  modal.classList.toggle("opacity-0", !open);
  modal.classList.toggle("opacity-100", open);
  modal.classList.toggle("pointer-events-none", !open);
  modal.classList.toggle("pointer-events-auto", open);
  modal.setAttribute("aria-hidden", String(!open));
  if (open) {
    modal.removeAttribute("inert");
  } else {
    modal.setAttribute("inert", "");
  }
  panel?.classList.toggle("opacity-0", !open);
  panel?.classList.toggle("opacity-100", open);
  panel?.classList.toggle("scale-95", !open);
  panel?.classList.toggle("scale-100", open);
}

export function initBrochureLeadModal(options?: {
  /** When true, Escape / focus trap only if no other modal claims them. */
  isOtherModalOpen?: () => boolean;
}): void {
  const brochureModal = document.getElementById("brochure-modal");
  if (!(brochureModal instanceof HTMLElement)) return;
  if (brochureModal.dataset.brochureReady === "1") return;
  brochureModal.dataset.brochureReady = "1";

  const brochureOpenButtons =
    document.querySelectorAll<HTMLButtonElement>("[data-brochure-open]");
  const brochureCloseButton = document.getElementById("brochure-modal-close");
  const brochureForm = document.getElementById(
    "brochure-lead-form",
  ) as HTMLFormElement | null;
  const brochureStatus = document.getElementById("brochure-form-status");
  const brochureSubmit = document.getElementById(
    "brochure-submit",
  ) as HTMLButtonElement | null;
  let brochureLastFocused: HTMLElement | null = null;

  function setBrochureModalOpen(open: boolean) {
    if (open) brochureLastFocused = document.activeElement as HTMLElement | null;
    setModalVisualState(brochureModal, open);
    const enrollmentOpen =
      document
        .getElementById("enrollment-modal")
        ?.getAttribute("aria-hidden") === "false";
    document.body.classList.toggle(
      "overflow-hidden",
      open || !!enrollmentOpen,
    );
    if (!open) brochureLastFocused?.focus?.();
  }

  function showBrochureStatus(kind: "error" | "success", message: string) {
    if (!brochureStatus) return;
    brochureStatus.textContent = message;
    brochureStatus.className =
      kind === "success"
        ? "rounded-xl px-4 py-3 text-sm bg-green-50 text-green-800 border border-green-200"
        : "rounded-xl px-4 py-3 text-sm bg-red-50 text-red-800 border border-red-200";
  }

  brochureOpenButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setBrochureModalOpen(true);
      window.setTimeout(() => {
        document.getElementById("brochure-name")?.focus();
      }, 0);
    });
  });

  brochureCloseButton?.addEventListener("click", () => {
    setBrochureModalOpen(false);
  });

  brochureModal.addEventListener("click", (event) => {
    if (event.target === brochureModal) setBrochureModalOpen(false);
  });

  window.addEventListener("keydown", (event) => {
    if (options?.isOtherModalOpen?.()) return;
    const open = brochureModal.getAttribute("aria-hidden") === "false";
    if (!open) return;
    if (event.key === "Escape") {
      setBrochureModalOpen(false);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements(brochureModal);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  brochureForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!brochureForm.reportValidity()) return;

    const formData = new FormData(brochureForm);
    const brochure = brochureForm.dataset.brochure ?? "";
    const landingSlug = brochureForm.dataset.landingSlug?.trim() || undefined;
    const trackingRequestId =
      (globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`) as string;
    if (brochureSubmit) {
      brochureSubmit.disabled = true;
      brochureSubmit.textContent = "Enviando...";
    }

    try {
      const payload: BrochureLeadFormPayload = {
        trackingRequestId,
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        message: String(formData.get("message") ?? ""),
        website: String(formData.get("website") ?? ""),
        programTitle: brochureForm.dataset.programTitle ?? "",
        programSlug: brochureForm.dataset.programSlug ?? "",
        brochure,
        ...(landingSlug ? { landingSlug } : {}),
      };

      const response = await fetch("/api/brochure-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "No pudimos enviar tus datos. Intenta de nuevo.",
        );
      }

      showBrochureStatus(
        "success",
        "Gracias. Iniciaremos la descarga del brochure.",
      );
      downloadBrochure(String(data.brochure || brochure));

      if (data?.tracking?.ok === false) {
        const retryDelaysMs = [500, 2000, 5000, 10000, 30000];
        let stopped = false;

        const attempt = async () => {
          try {
            const res = await fetch("/api/brochure-track", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const r = await res.json().catch(() => ({}));
            return !!(res.ok && r && r.ok === true);
          } catch {
            return false;
          }
        };

        const runRetries = async () => {
          for (const delay of retryDelaysMs) {
            if (stopped) return;
            const ok = await attempt();
            if (ok) return;
            await new Promise((r) => window.setTimeout(r, delay));
          }
        };

        void runRetries();

        window.addEventListener(
          "pagehide",
          () => {
            stopped = true;
            try {
              const blob = new Blob([JSON.stringify(payload)], {
                type: "application/json",
              });
              navigator.sendBeacon("/api/brochure-track", blob);
            } catch {
              // ignore
            }
          },
          { once: true },
        );
      }

      brochureForm.reset();
      window.setTimeout(() => setBrochureModalOpen(false), 900);
    } catch (error) {
      showBrochureStatus(
        "error",
        error instanceof Error
          ? error.message
          : "No pudimos enviar tus datos. Intenta de nuevo.",
      );
    } finally {
      if (brochureSubmit) {
        brochureSubmit.disabled = false;
        brochureSubmit.textContent = "Enviar y descargar";
      }
    }
  });
}
