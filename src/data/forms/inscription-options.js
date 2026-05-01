export const genres = ["Masculino", "Femenino", "Otro", "Prefiero no decirlo"];

export const nationalities = ["Mexicana", "Otra"];

export const civilStates = ["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a", "Unión Libre"];

export const states = [
    "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas",
    "Chihuahua", "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México",
    "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit",
    "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí",
    "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"
];

export const modalitiesStandard = ["En línea", "Presencial"];
export const modalitiesCivil = ["En línea", "Híbrido"];

export const studyGrades = ["Licenciatura", "Maestría", "Especialidad", "Doctorado"];

export const yesNo = ["Sí", "No"];

export const relatives = ["Padre/Madre", "Hermano/a", "Cónyuge", "Hijo/a", "Otro"];

export const sources = ["Redes sociales", "Google", "Recomendación", "Prensa/Radio", "Otro"];

// Legacy programs import removed - now using content collection
// This file is being phased out in favor of direct content collection usage

/**
 * Get juridic programs (maestria, doctorado, especialidad) from content collection.
 * Use this in pages that need the program list.
 * 
 * Example usage in Astro page:
 *   import { getCollection } from "astro:content";
 *   const programs = await getCollection("programas");
 *   const juridicPrograms = programs
 *     .filter(p => ["maestria", "doctorado", "especialidad"].includes(p.data.nivel))
 *     .map(p => p.data.title);
 */
export async function getJuridicProgramsFromContent() {
  // Note: This function requires top-level await or async context
  // For static data, import and filter at build time in your page
  const { getCollection } = await import("astro:content");
  const programas = await getCollection("programas");
  return programas
    .filter(p => ["maestria", "doctorado", "especialidad"].includes(p.data.nivel))
    .map(p => p.data.title);
}

// Temporary: Keep old export for backwards compatibility during migration
// TODO: Remove after updating all consumers to use content collection directly
export const juridicPrograms = [];
