/**
 * Mellanspelet (steg 8): staden där gruppen är mellan äventyren. Tills det finns en stadskarta är
 * staden en meny på skärmen "Mellan äventyren" med lärare och en magiakademi. Besluten står i
 * docs/regelbeslut.md under Utveckling mellan äventyren.
 */
import { TRAINING } from '../engine/rules/tables';
import type { BookDef } from './types';

/** En lärare i staden. Stadens lärare kan alla färdigheter med samma FV (tolkning). */
export interface CityTeacher {
  id: string;
  name: string;
  race: string;
  int: number;
  fv: number;
  /** Undervisar i magiskolor och besvärjelser (och bara i dem). */
  magic: boolean;
}

export const CITY = {
  name: 'Staden',
  teachers: [
    { id: 'stadens_larare', name: 'Stadens lärare', race: 'manniska', int: TRAINING.cityTeacher.int, fv: TRAINING.cityTeacher.fv, magic: false },
    { id: 'akademins_magister', name: 'Magister vid akademin', race: 'manniska', int: TRAINING.cityTeacher.int, fv: TRAINING.cityTeacher.fv, magic: true },
  ] as CityTeacher[],
  academy: 'Magiakademin',
};

/** Böcker som inte hör till någon modul. Modulernas egna böcker står i modulen (ModuleDef.books). */
export const COMMON_BOOKS: BookDef[] = [];
