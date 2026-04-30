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

/** Inner width for most landing sections (replaces mixed container/max-w patterns) */
export const containerNarrow = "max-w-6xl mx-auto px-4 sm:px-6";

/** Hero slide content alignment (full-height flex row) */
export const heroContainer =
  "relative z-20 max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center";

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

/** Partner logo grid (2 cols mobile) */
export const gridPartners = "grid grid-cols-2 md:grid-cols-3 gap-8 justify-center";

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

/** Partner logo tile */
export const cardPartnerLink =
  "flex items-center justify-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition group";

/** Inline link inside program lists */
export const linkProgramItem =
  "block text-sm text-gray-600 hover:text-primary hover:translate-x-1 transition";

/** Small “Ver todos” style under cards */
export const linkCtaSmall =
  "text-primary text-sm font-semibold hover:text-secondary hover:underline mt-2 transition-colors";
