/**
 * Shared Tailwind class strings for marketing / landing sections.
 * Import from section components to keep spacing, type, and containers consistent.
 */

/** Gray band sections (default home stack rhythm) */
export const sectionMuted = "py-20 bg-gray-50";

/** Same as sectionMuted when overflow must be clipped (e.g. sliders) */
export const sectionMutedOverflow = "py-20 bg-gray-50 overflow-hidden";

/** Contrasting band (e.g. testimonials on white) */
export const sectionSurface = "py-20 bg-white";

/** Same as sectionSurface when overflow must be clipped (e.g. faculty slider) */
export const sectionSurfaceOverflow = "py-20 bg-white overflow-hidden";

/**
 * Homepage band rhythm (alternate to keep equal visual gaps):
 * Oferta → muted | Claustro → surface | Partners → muted | Features → surface | Revista → muted
 */
/** Shared content width for landing sections */
export const containerNarrow = "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8";

/** Alias — same width as containerNarrow (homepage card grids, etc.) */
export const containerWide = containerNarrow;

/** Hero slide content alignment (full-height flex row) */
export const heroContainer =
  "relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center";

/** Centered section title (no subtitle below) */
export const headingSection =
  "text-3xl font-bold text-center mb-12 text-primary font-serif";

/** Section title when followed by a lead paragraph */
export const headingSectionCompact =
  "text-3xl font-bold text-center mb-4 text-primary font-serif";

/** Gray intro under headingSectionCompact */
export const lead =
  "text-center text-gray-600 mb-12 max-w-2xl mx-auto";

/** Centered muted text without extra vertical margin (inside a titled block) */
export const textMutedCenter = "text-gray-600 max-w-2xl mx-auto";

/** Left-aligned title in a header row (e.g. news + “Ver todas”) */
export const headingRow = "text-3xl font-bold text-primary font-serif";

/** Header row: title + action link */
export const rowHeader = "flex justify-between items-center mb-8";

/** Primary text link (replaces generic blue-600) */
export const linkSecondary =
  "text-primary font-semibold hover:text-secondary hover:underline transition-colors";

/** Standard 3-column grid on landing */
export const gridThree = "grid md:grid-cols-3 gap-8";

/** Partner logo cloud: wraps and centers; up to ~6 per row on desktop */
export const gridPartners =
  "flex flex-wrap justify-center items-center gap-x-6 gap-y-6 sm:gap-x-8 sm:gap-y-8";

/** Compact muted band for the logo cloud (less empty gray) */
export const sectionPartners = "py-12 bg-gray-50 sm:py-14";

/** Clickable card (news list, etc.) */
export const cardInteractive =
  "group block bg-white rounded-xl shadow hover:shadow-lg transition";

/** School / offer pillar card */
export const cardSchool =
  "relative group overflow-hidden rounded-2xl bg-white p-8 shadow-lg border-l-4 border-secondary hover:shadow-xl transition-all duration-300";

/** Decorative glow used behind school cards */
export const cardSchoolGlow =
  "absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-secondary/10 rounded-full blur-2xl group-hover:bg-secondary/20 transition-colors";

/** Feature column cards */
export const cardFeature =
  "bg-white p-8 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border-t-4 border-secondary group";

/** @deprecated Prefer flat logo cloud; kept for any legacy partner tiles */
export const cardPartnerLink =
  "flex items-center justify-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition group";

/** Partner logo — equal square slot; assets are pre-normalized to same content scale */
export const partnerLogoImg =
  "h-full w-full object-contain transition-opacity group-hover:opacity-80";

/** Wrapper: fixed square so every mark shares the same visual weight */
export const partnerLogoSlot =
  "group flex h-24 w-24 shrink-0 items-center justify-center sm:h-28 sm:w-28 md:h-32 md:w-32";

/** Dark pill for white/light logos */
export const partnerLogoSlotOnDark =
  "group flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-primary p-2 sm:h-28 sm:w-28 md:h-32 md:w-32";

/** Inline link inside program lists */
export const linkProgramItem =
  "block text-sm text-gray-600 hover:text-primary hover:translate-x-1 transition";

/** Small “Ver todos” style under cards */
export const linkCtaSmall =
  "text-primary text-sm font-semibold hover:text-secondary hover:underline mt-2 transition-colors";
