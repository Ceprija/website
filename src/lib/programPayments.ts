import type { CollectionEntry } from "astro:content";

/**
 * Payment option structure for programs.
 */
export type PaymentOption = {
  id: string;
  label: string;
  price: number;
  stripePriceId: string;
  type: "presencial" | "online" | "hibrido";
};

/**
 * Extracts payment options from a program, supporting both new and legacy formats.
 * 
 * Priority:
 * 1. Use `paymentOptions` array if present (new format)
 * 2. Fall back to `price` object + `stripePriceIds` (legacy format)
 * 
 * @param program - The program entry from the programas collection
 * @returns Array of payment options, or empty array if none configured
 */
export function getPaymentOptions(
  program: CollectionEntry<"programas">
): PaymentOption[] {
  const data = program.data as any;

  // New format: use paymentOptions directly
  if (data.paymentOptions && Array.isArray(data.paymentOptions)) {
    return data.paymentOptions;
  }

  // Legacy format: migrate from price object + stripePriceIds
  if (typeof data.price === "object" && data.price !== null && !Array.isArray(data.price)) {
    const options: PaymentOption[] = [];
    const priceObj = data.price as Record<string, string>;
    const stripeIds = data.stripePriceIds as { presencial?: string; online?: string } | undefined;

    for (const [key, value] of Object.entries(priceObj)) {
      const priceNumber = parsePrice(value);
      if (priceNumber === null) continue;

      // Determine type based on key name
      let type: "presencial" | "online" | "hibrido" = "online";
      const keyLower = key.toLowerCase();
      if (keyLower.includes("presencial")) {
        type = "presencial";
      } else if (keyLower.includes("online") || keyLower.includes("línea")) {
        type = "online";
      } else if (keyLower.includes("hibrido") || keyLower.includes("híbrido")) {
        type = "hibrido";
      }

      // Get corresponding Stripe price ID
      const stripePriceId = type === "presencial" 
        ? (stripeIds?.presencial || "") 
        : (stripeIds?.online || "");

      options.push({
        id: `legacy_${key.toLowerCase().replace(/\s+/g, "_")}`,
        label: key,
        price: priceNumber,
        stripePriceId,
        type,
      });
    }

    return options;
  }

  return [];
}

/**
 * Parses a price string (e.g., "$5,000 MXN", "5000") to a number.
 * Returns null if the string cannot be parsed.
 */
function parsePrice(priceStr: string): number | null {
  if (typeof priceStr !== "string") return null;

  // Remove currency symbols, commas, and text
  const cleaned = priceStr.replace(/[$,\s]/g, "").replace(/MXN/gi, "").trim();
  
  // Handle "Consultar" or other non-numeric text
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Formats a price number for display (e.g., 5000 -> "$5,000 MXN").
 */
export function formatPrice(price: number): string {
  return `$${price.toLocaleString("es-MX")} MXN`;
}

/**
 * Extracts stripe price IDs in the format expected by ContinuousEducationForm
 * and other components, supporting both new paymentOptions and legacy format.
 */
export function getStripePriceIds(
  program: CollectionEntry<"programas">
): { presencial?: string; online?: string } | undefined {
  const data = program.data as any;

  // New format: extract from paymentOptions (solo cuando hay a lo más una opción por modalidad)
  if (data.paymentOptions && Array.isArray(data.paymentOptions)) {
    const options = data.paymentOptions as PaymentOption[];
    const presencial = options.filter((o) => o.type === "presencial");
    const online = options.filter((o) => o.type === "online");
    const hibrido = options.filter((o) => o.type === "hibrido");
    // Varios `hibrido` (p. ej. inscripción + total + diferido): no hay mapeo único presencial/en línea
    if (hibrido.length > 1) {
      return {
        presencial: undefined,
        online: undefined,
      };
    }
    return {
      presencial:
        presencial[0]?.stripePriceId ?? hibrido[0]?.stripePriceId,
      online:
        online[0]?.stripePriceId ?? hibrido[0]?.stripePriceId,
    };
  }

  // Legacy format: use stripePriceIds directly
  if (data.stripePriceIds && typeof data.stripePriceIds === "object") {
    return data.stripePriceIds;
  }

  return undefined;
}

/**
 * Converts payment options to the price display format used in the UI.
 * Returns an object like { "Presencial": "$5,000 MXN", "En línea": "$4,000 MXN" }
 */
export function getDisplayPrices(
  program: CollectionEntry<"programas">
): Record<string, string> {
  const options = getPaymentOptions(program);
  
  if (options.length > 0) {
    return Object.fromEntries(
      options.map(opt => [opt.label, formatPrice(opt.price)])
    );
  }

  // Fallback to legacy price object
  const data = program.data as any;
  if (typeof data.price === "object" && data.price !== null) {
    return data.price;
  }

  return {};
}

/**
 * Determines the program's effective status, considering both new `status` field
 * and legacy `disabled` field for backward compatibility.
 */
export function getProgramStatus(
  program: CollectionEntry<"programas">
): "active" | "waitlist" | "disabled" {
  const data = program.data as any;

  // New field takes precedence
  if (data.status) {
    return data.status;
  }

  // Legacy: map disabled boolean to status
  if (data.disabled === true) {
    return "disabled";
  }

  return "active";
}
