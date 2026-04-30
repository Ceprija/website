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

import { programs } from '../legacy/programs.js';

export const juridicPrograms = programs.filter(p =>
    p.activeForForm === true &&
    (p.level === "Maestría" ||
        p.level === "Especialidad" ||
        p.level === "Doctorado")
).map(p => p.title);
