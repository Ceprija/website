/**
 * Inline form error banner: no `alert()`. Pair with a div that has
 * `role="alert"`, `aria-live="assertive"`, and `tabindex="-1"`.
 */
export function bindFormPageFeedback(feedbackEl: HTMLElement | null): {
    show: (message: string) => void;
    clear: () => void;
} {
    function clear() {
        if (!feedbackEl) return;
        feedbackEl.textContent = "";
        feedbackEl.classList.add("hidden");
    }

    function show(message: string) {
        if (!feedbackEl) return;
        feedbackEl.textContent = message;
        feedbackEl.classList.remove("hidden");
        feedbackEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        feedbackEl.focus({ preventScroll: true });
    }

    return { show, clear };
}
