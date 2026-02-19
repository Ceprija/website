import { programs as juridica } from './programs-juridica.js';
import { programs as diplomadosJuridicos } from './programs-diplomados-juridica.js';
import { programs as administrativa } from './programs-administrativa.js';
import { programs as integral } from './programs-integral.js';

export const programs = [
    ...diplomadosJuridicos,
    ...juridica,
    ...administrativa,
    ...integral
];
