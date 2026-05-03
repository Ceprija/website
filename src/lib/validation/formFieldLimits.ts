/**
 * Límites de texto en formularios (cliente + referencia para maxlength en HTML).
 * Claves = atributo `name` del control.
 */
export const TEXT_MAX_LENGTH_BY_NAME: Record<string, number> = {
  nombre: 100,
  apellidos: 100,
  name: 200,
  calle: 200,
  colonia: 120,
  ciudad: 120,
  carrera: 150,
  institucion: 150,
  cedulaNum: 20,
  message: 2000,
  nacionalidad: 80,
  detalleCapacidad: 500,
  detalleEnf: 500,
  detalleAlergia: 500,
  detalleTratamiento: 500,
  contactoEmergencia: 200,
  ocupacion: 100,
  // New enrollment fields
  genero: 30,
  fechaNacimiento: 10,
  curp: 18,
  estadoCivil: 50,
  entidadNacimiento: 50,
  estadoDireccion: 50,
  modalidadEstudio: 50,
  fechaInicioLic: 10,
  fechaFinLic: 10,
  estadoLic: 50,
  lenguaIndigena: 3,
  parentesco: 50,
  origen: 100,
};

export const DEFAULT_TEXT_MAX_LENGTH = 300;

/** Nombre o apellido(s) por separado (servidor). */
export const MAX_PERSON_NAME_PART_LEN = 100;
