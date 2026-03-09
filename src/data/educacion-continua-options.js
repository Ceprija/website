import { programs } from './programs.js';

// Filter only continuous education programs (active Cursos, Talleres, Diplomados)
export const ecPrograms = programs.filter(p =>
    p.active && ["Curso", "Taller", "Diplomado"].includes(p.level)
);

export const ecProgramTitles = ecPrograms.map(p => p.title);

export const ecConsentLabels = [
    "He leído y aceptado la Política de uso de imagen",
    "He leído y aceptado el Aviso de Privacidad",
    "He leído y aceptado las políticas y uso de redes sociales"
];
