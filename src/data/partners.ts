export type Partner = {
  name: string;
  logo: string;
  /** Empty string = no link */
  url: string;
  type: "institucion" | "universidad" | "empresa" | "colegio";
  /** When false, hidden from the homepage logo cloud */
  active?: boolean;
  /** White/light logo — render on a dark pill so it stays visible */
  onDark?: boolean;
};

export const partners: Partner[] = [
  {
    name: "ASINEP",
    logo: "/images/convenios/asinep.png",
    url: "",
    type: "institucion",
    active: true,
  },
  {
    name: "Impulsa 50",
    logo: "/images/convenios/impulsa-50.png",
    url: "https://impulsa50.mx/",
    type: "empresa",
    active: true,
  },
  {
    name: "IDEFT",
    logo: "/images/convenios/ideft.png",
    url: "https://ideft.edu.mx/",
    type: "institucion",
    active: true,
  },
  {
    name: "Colegio de Abogados de México — Capítulo Occidente",
    logo: "/images/convenios/colegio-abogados-occidente.png",
    url: "https://incamoccidente.org/",
    type: "colegio",
    active: true,
  },
  {
    name: "Secretaría del Trabajo y Previsión Social",
    logo: "/images/convenios/stps.png",
    url: "https://stps.jalisco.gob.mx/inicio",
    type: "institucion",
    active: true,
  },
  {
    name: "UAG",
    logo: "/images/convenios/uag.png",
    url: "https://www.uag.mx/",
    type: "universidad",
    active: true,
  },
];
