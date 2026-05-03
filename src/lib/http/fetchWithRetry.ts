/**
 * Reintentos con backoff exponencial para llamadas HTTP poco idempotentes
 * (p. ej. Brevo) ante errores transitorios de red o 5xx / 429.
 *
 * Persistencia en BD u outbox queda para una fase posterior; los reintentos
 * reducen pérdidas cuando el proveedor o la red fallan de forma temporal.
 */

export type FetchWithRetryOptions = {
  /** Intentos totales (incluye el primero). Por defecto 4. */
  maxAttempts?: number;
  /** Retardo base antes del segundo intento (ms). Por defecto 400. */
  baseDelayMs?: number;
  /** Etiqueta para logs (ej. "[enrollment] Brevo admin"). */
  label?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Respuestas que suelen ser transitorias y conviene reintentar. */
function isRetriableHttpStatus(status: number): boolean {
  if (status === 429) return true;
  if (status === 408) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}

/**
 * Ejecuta fetch con reintentos. Devuelve la última `Response` (ok o no) si hubo
 * respuesta HTTP; lanza solo si todos los intentos fallan por error de red.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  options?: FetchWithRetryOptions,
): Promise<Response> {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 4);
  const baseDelayMs = options?.baseDelayMs ?? 400;
  const label = options?.label ?? "fetchWithRetry";

  let lastNetworkError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(input, init);

      if (res.ok) {
        return res;
      }

      const snippet = await res
        .clone()
        .text()
        .then((t) => t.slice(0, 800))
        .catch(() => "");

      if (!isRetriableHttpStatus(res.status)) {
        return res;
      }

      console.warn(
        `[${label}] intento ${attempt}/${maxAttempts} HTTP ${res.status}${snippet ? `: ${snippet}` : ""}`,
      );

      if (attempt >= maxAttempts) {
        return res;
      }
    } catch (e) {
      lastNetworkError = e;
      console.warn(`[${label}] intento ${attempt}/${maxAttempts} error de red:`, e);
      if (attempt >= maxAttempts) {
        throw e;
      }
    }

    const delay = baseDelayMs * 2 ** (attempt - 1);
    await sleep(delay);
  }

  throw lastNetworkError instanceof Error
    ? lastNetworkError
    : new Error(`${label}: agotados los reintentos`);
}
