// Datos centralizados de la oferta académica
export const programs = [
    // Licenciaturas
    // Maestrías
    {
        active: true,
        activeForForm: false,
        id: "maestria-derecho-penal",
        title: "Maestría en Derecho Penal y Litigación Oral Avanzada",
        level: "Maestría",
        description: "Especialízate en el sistema acusatorio y técnicas avanzadas de litigación oral.",
        image: "bg-[url('/images/programs/maestria-derecho-penal.png')] bg-cover bg-center",
        rvoe: "SICyT ESM142024142",
        duration: "6 cuatrimestres",
        modality: "Presencial / En línea",
        startDate: "Jueves 5 de Febrero del 2026",
        //endDate: "Viernes 24 de Mayo del 2026",
        curriculumTitle: "Plan de Estudios",
        curriculum: [
            {
                period: "1er Cuatrimestre",
                subjects: [
                    "Actos de Investigación",
                    "Reconocimientos e Identificación",
                    "Dictámenes Especiales e Irreproducibles",
                    "Derechos Humanos I"
                ]
            },
            {
                period: "2do Cuatrimestre",
                subjects: [
                    "Formas de Terminación de la Investigación",
                    "Salidas Alternas y Terminación Anticipada del Proceso",
                    "Incorporación de Datos, Medios y Prueba",
                    "Taller de Oratoria I"
                ]
            },
            {
                period: "3er Cuatrimestre",
                subjects: [
                    "Sobreseimiento",
                    "Nulidades",
                    "Admisión, No Admisión y Exclusión Probatoria",
                    "Derechos Humanos II"
                ]
            },
            {
                period: "4to Cuatrimestre",
                subjects: [
                    "Juicio",
                    "Excluyentes del Delito",
                    "Procedimiento para Personas Inimputables",
                    "Taller de Oratoria II"
                ]
            },
            {
                period: "5to Cuatrimestre",
                subjects: [
                    "Procedimientos Especiales",
                    "Nulidad de Sentencia",
                    "Reconocimiento de Inocencia",
                    "Investigación Jurídica Avanzada"
                ]
            },
            {
                period: "6to Cuatrimestre",
                subjects: [
                    "Recursos",
                    "Reposición",
                    "Etapa de Ejecución",
                    "Casos Prácticos y Discusiones de Jurisprudencia"
                ]
            }
        ],
        profile: "Especialista en derecho penal con dominio de técnicas de litigación oral.",
        fieldOfWork: "Defensoría, fiscalía, judicatura, consultoría penal."
    },
    {
        active: true,
        activeForForm: true,
        id: "maestria-derecho-civil",
        title: "Maestría en Derecho Civil y Familiar",
        level: "Maestría",
        description: "Litiga con dominio del nuevo sistema de oralidad civil y familiar. Una maestría técnica, ética y centrada en la resolución práctica de conflictos",
        image: "bg-[url('/images/programs/maestria-derecho-civil.png')] bg-cover bg-center",
        rvoe: "SICyT ESM142024143",
        duration: "6 cuatrimestres",
        modality: "Presencial / En línea",
        curriculumTitle: "Plan de Estudios",
        curriculum: [
            {
                period: "1er Cuatrimestre",
                subjects: [
                    "Introducción al Juicio Oral Familiar",
                    "Aspectos Procesales en el Juicio Oral Familiar",
                    "Construcción de la Teoría del Caso en Derecho Familiar",
                    "Paradigmas Constitucionales del Derecho Familiar",
                    "Acciones del Estado Civil",
                ]
            },
            {
                period: "2do Cuatrimestre",
                subjects: [
                    "Derecho Convencional Familiar",
                    "Transversalidad en los procedimientos de Familia",
                    "La Audiencia Preliminar en el Proceso Familiar",
                    "Conceptos, Estándares y Precedentes en Materia Familiar",
                    "Razonamiento y Sentencia en Materia Familiar"
                ]
            },
            {
                period: "3er Cuatrimestre",
                subjects: [
                    "Audiencia de Juicio y Litigación Efectiva",
                    "Fundamentos del Derecho Civil y la Oralidad",
                    "Obligaciones y Contratos",
                    "Derechos Reales y Personales",
                    "Metodología de la Investigación I"
                ]
            },
            {
                period: "4to Cuatrimestre",
                subjects: [
                    "Responsabilidad Civil y Reparación del Daño",
                    "Familia y Sucesiones",
                    "Propiedad Intelectual en el Derecho Civil",
                    "Precedentes y Procedimientos Civiles",
                    "Metodología de la Investigación II"
                ]
            },
            {
                period: "5to Cuatrimestre",
                subjects: [
                    "Taller de Oratoria",
                    "Técnicas de Negociación y Resolución de Conflictos",
                    "Simulación de Procesos Judiciales Civiles",
                    "Prácticas Avanzadas en Litigación Oral Familiar",
                    "Taller de Tesis I"
                ]
            },
            {
                period: "6to Cuatrimestre",
                subjects: [
                    "Gestión de Casos y Estrategia Legal con Perspectiva de Género",
                    "Derecho Procesal Civil Avanzado",
                    "Taller de Argumentación y Retórica Legal",
                    "Análisis de Sentencias y Jurisprudencia",
                    "Taller de Tesis II"
                ]
            }
        ],
        profile: "Especialista en derecho civil con enfoque en solución de conflictos patrimoniales.",
        fieldOfWork: "Notarías, despachos civiles, mediación, consultoría patrimonial."
    },
    {
        active: true,
        activeForForm: true,
        id: "maestria-derecho-internacional",
        title: "Maestría en Derecho Internacional de Derechos Humanos y Litigio Estratégico",
        level: "Maestría",
        description: "Genera nuevo conocimiento y lidera la evolución de los sistemas educativos.",
        image: "bg-[url('/images/programs/maestria-derecho-internacional.png')] bg-cover bg-center",
        rvoe: "SICyT ESM142024140",
        duration: "6 cuatrimestres",
        modality: "Hiíbrida / En línea",
        curriculumTitle: "Plan de Estudios",
        curriculum: [
            {
                period: "1er Cuatrimestre",
                subjects: [
                    "Introducción al Derecho Internacional de los Derechos Humanos",
                    "Teoría y Filosofía de los Derechos Humanos",
                    "Sistemas de Protección Interamericana de los Derechos Humanos"
                ]
            },
            {
                period: "2do Cuatrimestre",
                subjects: [
                    "Derechos Humanos y Derecho Humanitario en Contextos de Violencia",
                    "Métodos de Investigación en Litigio Estratégico",
                    "Litigio Estratégico y Derechos Civiles y Políticos"
                ]
            },
            {
                period: "3er Cuatrimestre",
                subjects: [
                    "Derechos Económicos, Sociales y Culturales",
                    "Perspectivas de Género y Derechos Humanos",
                    "Derecho Penal Internacional y Justicia Universal"
                ]
            },
            {
                period: "4to Cuatrimestre",
                subjects: [
                    "Derechos Humanos y Medio Ambiente",
                    "Derechos Humanos y Migración",
                    "El Rol de las ONG y la Sociedad Civil en el Litigio Estratégico"
                ]
            },
            {
                period: "5to Cuatrimestre",
                subjects: [
                    "Derechos Humanos y Tecnologías de la Información",
                    "Derechos Humanos y Empresa",
                    "Mecanismos de Reparación y Restitución de Derechos"
                ]
            },
            {
                period: "6to Cuatrimestre",
                subjects: [
                    "Seminario de Casos Prácticos de Litigio Estratégico",
                    "Proyecto de Investigación Final",
                    "Ética y Responsabilidad en el Litigio de Derechos Humanos"
                ]
            }
        ],
        profile: "Doctor en Educación capaz de generar conocimiento científico y liderar transformaciones educativas.",
        fieldOfWork: "Investigación, docencia universitaria, diseño de políticas, consultoría educativa."
    },
    {
        active: true,
        activeForForm: false,
        id: "especialidad-criminalistica",
        title: "Especialidad en Criminalística y Ciencias Forenses",
        level: "Especialidad",
        description: "Integra la prueba científica al juicio penal. Una especialidad práctica que fortalece tu argumentación con base en evidencia forense.",
        image: "bg-[url('/images/programs/especialidad-criminalistica.png')] bg-cover bg-center",
        rvoe: "SICyT ESP142024141",
        duration: "3 cuatrimestres",
        modality: "Presencial /En línea",
        curriculumTitle: "Plan de Estudios",
        curriculum: [
            {
                period: "1er Cuatrimestre",
                subjects: [
                    "Introducción a las Ciencias Forenses",
                    "Historia de la Criminalística",
                    "Derecho Penal y Procesal Penal I",
                    "Bioética y Análisis de Casos"
                ]
            },
            {
                period: "2do Cuatrimestre",
                subjects: [
                    "Ciencias Auxiliares de la Criminalística",
                    "Medicina Legal y Forense",
                    "Identificación Forense y Técnicas de Rastreo",
                    "Química, Biología y Aplicaciones Especiales en Criminalística"
                ]
            },
            {
                period: "3er Cuatrimestre",
                subjects: [
                    "Metodología de la Investigación II",
                    "Procesal Forense",
                    "Genética y Derecho",
                    "Criminología Forensea"
                ]
            }
        ],
        profile: "Profesional de la educación con capacidad de innovar y gestionar instituciones educativas.",
        fieldOfWork: "Instituciones educativas, consultoría, investigación, capacitación."
    },
    // Doctorados
    {
        active: true,
        activeForForm: false,
        id: "doctorado-derecho-procesal",
        title: "Doctorado en Derecho Procesal y Sistemas Contemporáneos",
        level: "Doctorado",
        description: "Estudia el proceso a fondo y lidera su evolución. Un doctorado técnico, comparado e innovador para transformar el sistema jurídico.",
        image: "bg-[url('/images/programs/doctorado-derecho-procesal.png')] bg-cover bg-center",
        rvoe: "SICyT ESD142024139",
        duration: "4 semestres",
        modality: "Hiíbrida / En línea",
        curriculumTitle: "Plan de Estudios",
        curriculum: [
            {
                period: "1er Semestre",
                subjects: [
                    "Teoría General del Proceso",
                    "Derecho Procesal Civil I",
                    "Derecho Procesal Penal II",
                    "Derecho Procesal Mercantil I"
                ]
            },
            {
                period: "2do Semestre",
                subjects: [
                    "Derecho Procesal Civil II",
                    "Derecho Procesal Penal II",
                    "Derecho Procesal Mercantil II",
                    "Derecho Procesal Familiar I"
                ]
            },
            {
                period: "3er Semestre",
                subjects: [
                    "Derecho Procesal Laboral I",
                    "Derecho Procesal Familiar II",
                    "Derecho Procesal Constitucional",
                    "Seminario de Investigación Jurídica"
                ]
            },
            {
                period: "4to Semestre",
                subjects: [
                    "Sistemas Procesales Comparados",
                    "Litigación Avanzada",
                    "Derecho Procesal Laboral II",
                    "Taller de Redacción de Tesis Doctoral"
                ]
            }
        ],
        profile: "Doctor en Derecho con capacidad de investigación y docencia de alto nivel.",
        fieldOfWork: "Docencia universitaria, investigación, judicatura, consultoría especializada."
    }
];
