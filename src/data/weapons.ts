import { grip } from '../engine/rules/derived';
import type { MeleeWeaponDef, RangedWeaponDef, WeaponDef, WeaponGroupId } from './types';

/**
 * Vapentabellerna (Bok III s. 34–35). STY-kraven för skjut- och kastvapen följer Bok III
 * (se regelbeslut). Vikt i kg, pris i silvermynt, längd i rutor utöver grannrutan.
 */

type M = Omit<MeleeWeaponDef, 'id' | 'kind' | 'twoHandedOnly'> & { id: string; twoHandedOnly?: boolean };
const melee = (w: M): MeleeWeaponDef => ({ kind: 'närstrid', twoHandedOnly: false, ...w });

export const MELEE_WEAPONS: MeleeWeaponDef[] = [
  melee({ id: 'knogjarn', name: 'Knogjärn eller stålhätta', group: 'slagsmal', damage: '1', styReq: 1, length: 0, weight: 0.5, bv: null, price: 20, note: '+1 på skadan i Slagsmål.' }),
  melee({ id: 'parerdolk', name: 'Parerdolk', group: 'dolkar', damage: '1T4+1', styReq: 1, length: 0, weight: 0.5, bv: 13, price: 80 }),
  melee({ id: 'dolk', name: 'Dolk', group: 'dolkar', damage: '1T4+1', styReq: 1, length: 0, weight: 0.5, bv: 9, price: 70 }),
  melee({ id: 'klubba', name: 'Klubba', group: 'kross', damage: '1T6', styReq: 5, length: 0, weight: 1, bv: 7, price: 20 }),
  melee({ id: 'spikklubba', name: 'Spikklubba', group: 'kross', damage: '1T6+1', styReq: 5, length: 0, weight: 1, bv: 7, price: 30 }),
  melee({ id: 'kortsvard', name: 'Kortsvärd', group: 'svärd', damage: '1T6+1', styReq: 7, length: 0, weight: 2, bv: 15, price: 400 }),
  melee({ id: 'kortspjut', name: 'Kortspjut', group: 'stickvapen', damage: '1T6', styReq: 7, length: 1, weight: 2, bv: 11, price: 90, asStaff: true, noParryWear: true }),
  melee({ id: 'trastav', name: 'Trästav', group: 'trastav', damage: '1T6', styReq: 7, twoHandedOnly: true, length: 0, weight: 2, bv: 7, price: 100, noParryWear: true }),
  melee({ id: 'korpnabb', name: 'Korpnäbb', group: 'kross', damage: '1T8', styReq: 7, length: 0, weight: 2, bv: 15, price: 600 }),
  melee({ id: 'kroksabel', name: 'Kroksabel', group: 'svärd', damage: '1T8+2', styReq: 9, length: 0, weight: 3, bv: 15, price: 650 }),
  melee({ id: 'piska', name: 'Piska', group: 'piska', damage: '1T2', styReq: 9, length: 1, weight: 3, bv: 3, price: 120, entangling: true, note: 'Kan rycka ett enhandsvapen ur handen: träff i svärdsarmen, sedan STY mot STY.' }),
  melee({ id: 'handyxa', name: 'Handyxa', group: 'yxa', damage: '1T6+1', styReq: 9, length: 0, weight: 3, bv: 11, price: 60 }),
  melee({ id: 'hjalmkrossare', name: 'Hjälmkrossare', group: 'kross', damage: '1T8+1', styReq: 11, length: 0, weight: 4, bv: 15, price: 700 }),
  melee({ id: 'stridshammare', name: 'Stridshammare', group: 'kross', damage: '1T6+2', styReq: 11, length: 0, weight: 4, bv: 15, price: 850 }),
  melee({ id: 'stridsyxa', name: 'Stridsyxa', group: 'yxa', damage: '1T8+2', styReq: 11, length: 0, weight: 4, bv: 11, price: 450 }),
  melee({ id: 'langspjut', name: 'Långspjut', group: 'stickvapen', damage: '1T10', styReq: 11, twoHandedOnly: true, length: 2, weight: 4, bv: 11, price: 300, asStaff: true, noParryWear: true }),
  melee({ id: 'bredsvard', name: 'Bredsvärd', group: 'svärd', damage: '1T8+1', styReq: 13, length: 0, weight: 4.5, bv: 15, price: 1000 }),
  melee({ id: 'stridsgissel', name: 'Stridsgissel', group: 'kattingvapen', damage: '1T10', styReq: 13, length: 0, weight: 4.5, bv: 11, price: 1250, entangling: true }),
  melee({ id: 'morgonstjarna', name: 'Morgonstjärna', group: 'kross', damage: '1T8+2', styReq: 13, length: 0, weight: 4.5, bv: 11, price: 1500 }),
  melee({ id: 'treudd', name: 'Treudd', group: 'stickvapen', damage: '3T6-2', styReq: 15, length: 1, weight: 5, bv: 11, price: 1000, noParryWear: true }),
  melee({ id: 'bastardsvard', name: 'Bastardsvärd', group: 'svärd', damage: '1T10+1', styReq: 17, length: 0, weight: 5.5, bv: 15, price: 2500 }),
  melee({ id: 'stor_traklubba', name: 'Stor träklubba', group: 'kross', damage: '2T4', styReq: 21, length: 0, weight: 6, bv: 11, price: 50 }),
  melee({ id: 'stor_spikklubba', name: 'Stor spikklubba', group: 'kross', damage: '2T4+1', styReq: 21, length: 0, weight: 6, bv: 11, price: 70 }),
  melee({ id: 'stridsslaga', name: 'Stridsslaga', group: 'kattingvapen', damage: '1T10+1', styReq: 25, length: 0, weight: 6.5, bv: 11, price: 1500, entangling: true }),
  melee({ id: 'skaggyxa', name: 'Skäggyxa', group: 'yxa', damage: '2T8+1', styReq: 25, length: 0, weight: 6.5, bv: 11, price: 1100 }),
  melee({ id: 'pik', name: 'Pik', group: 'stickvapen', damage: '2T8-1', styReq: 25, twoHandedOnly: true, length: 3, weight: 6.5, bv: 11, price: 1900, noParryWear: true }),
  melee({ id: 'lans', name: 'Lans', group: 'stickvapen', damage: '2T8', styReq: 25, twoHandedOnly: true, length: 2, weight: 6.5, bv: 15, price: 650, noParryWear: true, note: 'Kan föras med en hand till häst, fastkilad under armen.' }),
  melee({ id: 'partisan', name: 'Partisan', group: 'stangvapen', damage: '2T8+2', styReq: 27, twoHandedOnly: true, length: 1, weight: 7, bv: 11, price: 1400, asStaff: true }),
  melee({ id: 'spetum', name: 'Spetum', group: 'stickvapen', damage: '2T8+1', styReq: 27, twoHandedOnly: true, length: 1, weight: 7, bv: 11, price: 1250, asStaff: true, noParryWear: true }),
  melee({ id: 'glav', name: 'Glav', group: 'stangvapen', damage: '2T10', styReq: 27, twoHandedOnly: true, length: 1, weight: 7, bv: 11, price: 1600, asStaff: true }),
  melee({ id: 'palyxa', name: 'Pålyxa', group: 'stangvapen', damage: '3T6', styReq: 29, twoHandedOnly: true, length: 1, weight: 7.5, bv: 11, price: 1150, asStaff: true }),
  melee({ id: 'hillebard', name: 'Hillebard', group: 'stangvapen', damage: '3T6+1', styReq: 29, twoHandedOnly: true, length: 1, weight: 7.5, bv: 11, price: 1900, asStaff: true }),
  melee({ id: 'tvahandsyxa', name: 'Tvåhandsyxa', group: 'yxa', damage: '2T10+1', styReq: 31, twoHandedOnly: true, length: 1, weight: 8, bv: 11, price: 1900 }),
  melee({ id: 'tvahandssvard', name: 'Tvåhandssvärd', group: 'svärd', damage: '2T10+2', styReq: 31, twoHandedOnly: true, length: 1, weight: 8, bv: 15, price: 3500 }),
];

type R = Omit<RangedWeaponDef, 'reload'> & { reload?: number };
const ranged = (w: R): RangedWeaponDef => ({ reload: 0, ...w });

/** Projektilvapen förs alltid med två händer, kastvapen alltid med en. */
export const RANGED_WEAPONS: RangedWeaponDef[] = [
  ranged({ id: 'liten_bage', name: 'Liten båge', kind: 'projektil', group: 'bagar', damage: '1T4+1', styReq: 10, range: 135, weight: 1.5, price: 150 }),
  ranged({ id: 'kortbage', name: 'Kortbåge', kind: 'projektil', group: 'bagar', damage: '1T6+1', styReq: 18, range: 135, weight: 2, price: 400 }),
  ranged({ id: 'langbage', name: 'Långbåge', kind: 'projektil', group: 'bagar', damage: '1T8+1', styReq: 30, range: 180, weight: 3, price: 700 }),
  ranged({ id: 'sammansatt_bage', name: 'Sammansatt båge', kind: 'projektil', group: 'bagar', damage: '1T10+1', styReq: 30, range: 180, weight: 3.5, price: 1000 }),
  ranged({ id: 'slunga', name: 'Slunga', kind: 'projektil', group: 'slunga', damage: '1T6', styReq: 10, range: 90, weight: 0.5, price: 40 }),
  ranged({ id: 'stavslunga', name: 'Stavslunga', kind: 'projektil', group: 'slunga', damage: '1T8', styReq: 22, range: 120, reload: 1, weight: 2, price: 80 }),
  ranged({ id: 'blasror', name: 'Blåsrör', kind: 'projektil', group: 'blasror', damage: '0', styReq: 2, range: 20, weight: 0.5, price: 80, note: 'Gör ingen skada själv. Pilen tränger in om 1T8 är högre än rustningens abs, och verkar sedan med sitt gift.' }),
  ranged({ id: 'latt_armborst', name: 'Lätt armborst', kind: 'projektil', group: 'armborst', damage: '2T4+2', styReq: 26, range: 150, reload: 3, weight: 5, price: 1300 }),
  ranged({ id: 'tungt_armborst', name: 'Tungt armborst', kind: 'projektil', group: 'armborst', damage: '2T6+2', styReq: 28, range: 225, reload: 6, weight: 6, price: 2250 }),
  ranged({ id: 'arbalest', name: 'Arbalest', kind: 'projektil', group: 'armborst', damage: '3T6+3', styReq: 32, range: 250, reload: 12, weight: 8, price: 4000 }),
  ranged({ id: 'kastspjut', name: 'Kastspjut', kind: 'kast', group: 'kastvapen', damage: '1T6+1', styReq: 7, range: 'STY', weight: 1, price: 120 }),
  ranged({ id: 'kastkniv', name: 'Kastkniv', kind: 'kast', group: 'kastvapen', damage: '1T4+1', styReq: 3, range: 'STY', weight: 0.5, price: 100 }),
  ranged({ id: 'kastyxa', name: 'Kastyxa', kind: 'kast', group: 'kastvapen', damage: '1T6+2', styReq: 11, range: 'STY', weight: 3, price: 90 }),
];

/** Obeväpnade anfall med Slagsmål (Bok II). Näven ger två anfall per runda. */
export const UNARMED = {
  nave: { name: 'Knytnäve', damage: '1T3', attacks: 2 },
  spark: { name: 'Spark', damage: '1T6', attacks: 1 },
};

export const WEAPON_LIST: WeaponDef[] = [...MELEE_WEAPONS, ...RANGED_WEAPONS];
export const WEAPONS: Record<string, WeaponDef> = Object.fromEntries(WEAPON_LIST.map((w) => [w.id, w]));

const ONE_HANDED: Record<'svärd' | 'yxa' | 'kross', WeaponGroupId> = {
  svärd: 'enhandssvard',
  yxa: 'enhandsyxor',
  kross: 'enhandskross',
};

/**
 * Vapengruppen (färdigheten) som används med vapnet för en rollperson med viss STY.
 * Svärd, yxor och krossvapen som inte går att föra med en hand hör till Tvåhandsvapen.
 * Knogjärn använder Slagsmål.
 */
export function weaponSkill(weapon: WeaponDef, sty: number): WeaponGroupId | 'slagsmal' {
  if (weapon.kind !== 'närstrid') return weapon.group;
  const g = weapon.group;
  if (g === 'svärd' || g === 'yxa' || g === 'kross') {
    return grip(weapon.styReq, sty, weapon.twoHandedOnly) === 'en hand' ? ONE_HANDED[g] : 'tvahandsvapen';
  }
  return g;
}

/** Vapen och rustningar av ovanliga material (Bok III s. 38–39). */
export const MATERIALS: Record<string, { name: string; damage: number; bv: number; abs: number; priceFactor: number; weightFactor: number; note: string }> = {
  tra: { name: 'Trä', damage: -3, bv: -3, abs: 0, priceFactor: 1, weightFactor: 1, note: 'Vässade spetsar i primitiva kulturer.' },
  sten: { name: 'Sten', damage: 0, bv: -4, abs: 0, priceFactor: 1, weightFactor: 1, note: 'Dolk, hjälmkrossare, spjut och pil. Kräver Stenhuggning B4.' },
  brons: { name: 'Brons', damage: -1, bv: -2, abs: -1, priceFactor: 0.8, weightFactor: 1, note: 'Skadeavdraget gäller eggvapen, stickvapen och pilspetsar.' },
  mithril: { name: 'Mithril', damage: 1, bv: 2, abs: 1, priceFactor: 20, weightFactor: 0.5, note: 'Kan förtrollas. Bara dvärgsmeder med Smide B5 kan bearbeta det.' },
  silver: { name: 'Silver', damage: 0, bv: -2, abs: 0, priceFactor: 9, weightFactor: 1.5, note: 'Skadar varelser som bara tar skada av silver.' },
  linne: { name: 'Linne', damage: 0, bv: 0, abs: 0, priceFactor: 2, weightFactor: 0.5, note: 'Harnesk som motsvarar härdat läder.' },
  drakfjall: { name: 'Drakfjäll', damage: 0, bv: 0, abs: 0, priceFactor: 1, weightFactor: 1, note: 'Rustning med drakens skydd och immunitet mot eld och syra; sköld med BV 23. Säljs inte öppet.' },
};
