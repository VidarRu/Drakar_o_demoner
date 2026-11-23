import type { AttrKey } from '../engine/types';
import type { AbilityPassive } from './types';

/**
 * Tabellen över särskilda förmågor (Bok I s. 25–27): 2T20 + spenderade BP.
 * Beskrivningarna är egna sammanfattningar. `effect` är det som påverkar skapandet av
 * rollpersonen; `passive` är regelvärden som motorn använder i spel (strid, skräck m.m.).
 */

export type AbilityEffect =
  /** Fast tillägg på FV i angivna färdigheter. */
  | { kind: 'fv'; skills: string[]; amount: number }
  /** Tillägg på FV i en valfri färdighet ur ett urval. */
  | { kind: 'fvChoice'; filter: 'sekundär' | 'alla' | 'vapen' | 'hantverk' | 'tva_vapen'; amount: number; raiseCap?: boolean }
  /** Ett fast FV i en valfri sekundär färdighet (kan inte höjas från start). */
  | { kind: 'fixedChoice'; fv: number }
  /** FV 20 i att tala och läsa/skriva ett valfritt språk. */
  | { kind: 'language'; fv: number }
  /** Ytterligare valfria sekundära färdigheter som yrkesfärdigheter. */
  | { kind: 'extraPicks'; count: number }
  | { kind: 'swordHand'; value: 'dubbelhänt' | 'ambidextriös' }
  /** +1 på tre olika eller +2 på en grundegenskap (inte STO). */
  | { kind: 'attrs' }
  | { kind: 'kpFactor'; factor: number }
  /** Lägre grundkostnad i EP för vissa färdigheter. */
  | { kind: 'baseCost'; skills: string[] | 'sekundär'; cost: number }
  /** Halverad kostnad för en valfri yrkesfärdighet eller besvärjelse. */
  | { kind: 'halfCost' }
  /** Välj ytterligare en yrkesförmåga från ett annat yrke. */
  | { kind: 'extraProfessionAbility' }
  /** Välj ett folkslag eller en ras (Baneman). */
  | { kind: 'foe' }
  | { kind: 'none' };

export interface AbilityDef {
  id: string;
  /** Lägsta och högsta tabellvärde. */
  min: number;
  max: number;
  name: string;
  desc: string;
  effect: AbilityEffect;
  passive?: AbilityPassive;
  /** Bara meningsfull för magiker (annars räknas den som en annan rad). */
  magicianOnly?: { otherwise: string };
}

const ab = (min: number, max: number, id: string, name: string, desc: string, effect: AbilityEffect = { kind: 'none' }, extra: Partial<AbilityDef> = {}): AbilityDef => ({
  id,
  min,
  max,
  name,
  desc,
  effect,
  ...extra,
});

export const ABILITIES: AbilityDef[] = [
  ab(3, 4, 'liten_talang', 'Liten talang', '+1 på FV i en valfri sekundär färdighet.', { kind: 'fvChoice', filter: 'sekundär', amount: 1 }),
  ab(5, 6, 'sjofararbakgrund', 'Sjöfararbakgrund', '+2 på FV i Sjökunnighet och Navigera.', { kind: 'fv', skills: ['sjokunnighet', 'navigera'], amount: 2 }),
  ab(7, 8, 'starka_vrister', 'Starka vrister', '+3 på FV i Hoppa.', { kind: 'fv', skills: ['hoppa'], amount: 3 }),
  ab(9, 10, 'brakig_uppvaxt', 'Bråkig uppväxt', '+3 på FV i Slagsmål.', { kind: 'fv', skills: ['slagsmal'], amount: 3 }),
  ab(11, 12, 'hantverkarbakgrund', 'Hantverkarbakgrund', '+3 på FV i ett valfritt hantverk.', { kind: 'fvChoice', filter: 'hantverk', amount: 3 }),
  ab(13, 14, 'smidig_kropp', 'Smidig kropp', '+3 på FV i Akrobatik.', { kind: 'fv', skills: ['akrobatik'], amount: 3 }),
  ab(15, 16, 'kopmannabakgrund', 'Köpmannabakgrund', '+3 på FV i Värdera.', { kind: 'fv', skills: ['vardera'], amount: 3 }),
  ab(17, 18, 'god_koordination', 'God koordinationsförmåga', '+3 på FV i Två vapen.', { kind: 'fvChoice', filter: 'tva_vapen', amount: 3 }),
  ab(19, 20, 'hobbyist', 'Hobbyist', 'FV 3 i en valfri sekundär färdighet redan från start.', { kind: 'fixedChoice', fv: 3 }),
  ab(21, 22, 'starka_nypor', 'Starka nypor', 'Alltid +3 på CL i Klättra.', { kind: 'none' }, { passive: { cl: { klattra: 3 } } }),
  ab(23, 24, 'mottagligt_medium', 'Mottagligt medium', '+5 på CL i Magisk kanalisering som passiv part.'),
  ab(25, 26, 'hangiven_student', 'Hängiven student', '+2 på ett valfritt FV; ett tak för färdigheten höjs också med 2.', { kind: 'fvChoice', filter: 'alla', amount: 2, raiseCap: true }),
  ab(27, 28, 'overtygande_tonfall', 'Övertygande tonfall', 'Alltid +3 på CL i Övertala och Muta.', { kind: 'none' }, { passive: { cl: { overtala: 3, muta: 3 } } }),
  ab(29, 30, 'sjatte_sinne', 'Sjätte sinne', '+1 på FV i Upptäcka fara och Finna dolda ting.', { kind: 'fv', skills: ['upptacka_fara', 'finna_dolda_ting'], amount: 1 }),
  ab(31, 32, 'stirrande_blick', 'Stirrande blick', 'Alltid +5 på CL i Hypnotisera.', { kind: 'none' }, { passive: { cl: { hypnotisera: 5 } } }),
  ab(33, 34, 'magikansla', 'Magikänsla', 'Alltid +5 på CL i Känna magi.', { kind: 'none' }, { passive: { cl: { kanna_magi: 5 } } }),
  ab(35, 36, 'gott_spraksinne', 'Gott språksinne', 'FV 20 (B5) i att tala och läsa/skriva ett valfritt språk.', { kind: 'language', fv: 20 }),
  ab(37, 38, 'stort_kunskapsomrade', 'Stort kunskapsområde', 'Två valfria sekundära färdigheter till som yrkesfärdigheter.', { kind: 'extraPicks', count: 2 }),
  ab(39, 40, 'god_bagskytt', 'God bågskytt', 'Alla räckvidder för projektilvapen ökar med 25 %.'),
  ab(41, 42, 'absolut_gehor', 'Absolut gehör', 'Grundkostnaden för Spela instrument och Sjunga är alltid 1.', { kind: 'baseCost', skills: ['spela_instrument', 'sjunga'], cost: 1 }),
  ab(43, 44, 'precisionssinne', 'Precisionssinne', '+1 på CL med alla vapen.', { kind: 'none' }, { passive: { cl: { vapen: 1 } } }),
  ab(45, 46, 'dubbelhant', 'Dubbelhänt', 'Kan använda båda händerna lika bra, men inte samtidigt.', { kind: 'swordHand', value: 'dubbelhänt' }),
  ab(47, 48, 'god_tidskansla', 'God tidskänsla', 'Vet alltid vad klockan är på tio minuter när.'),
  ab(49, 51, 'absolut_ogonmatt', 'Absolut ögonmått', 'Bedömer avstånd med 5 % felmarginal.'),
  ab(52, 54, 'mycket_uppmarksam', 'Mycket uppmärksam', 'Alltid +2 på CL i Finna dolda ting och Upptäcka fara.', { kind: 'none' }, { passive: { cl: { finna_dolda_ting: 2, upptacka_fara: 2 } } }),
  ab(55, 55, 'blixtrande_reflexer', 'Blixtrande reflexer', '+3 på alla initiativslag.', { kind: 'none' }, { passive: { initiative: 3 } }),
  ab(56, 56, 'barsark', 'Bärsärk', '+5 på FV i Bärsärkagång.', { kind: 'fv', skills: ['barsarkagang'], amount: 5 }),
  ab(57, 57, 'gott_balanssinne', 'Gott balanssinne', '+5 på SMI vid balansakter och för att landa på fötterna.'),
  ab(58, 58, 'hastarnas_herre', 'Hästarnas herre', '+10 på FV i Rida och kastas aldrig av hästen.', { kind: 'fv', skills: ['rida'], amount: 10 }),
  ab(59, 59, 'ambidextrios', 'Ambidextriös', 'Kan använda båda händerna samtidigt till olika saker.', { kind: 'swordHand', value: 'ambidextriös' }),
  ab(60, 60, 'djurvan', 'Djurvän', 'Anfalls aldrig av vanliga djur.'),
  ab(61, 61, 'turgubbe', 'Turgubbe', 'Kan alltid köpa +1 på en CL för 1 PSY-poäng.'),
  ab(62, 62, 'magisk_empati', 'Magisk empati', 'Identifierar besvärjelserna i ett magiskt föremål om PSY övervinner deras effektgrader.'),
  ab(63, 63, 'gudarnas_gunstling', 'Gudarnas gunstling', '25 % chans att guden återställer alla KP när de når noll (inte kritiska skador).'),
  ab(64, 64, 'lattlard', 'Lättlärd', 'Grundkostnaden för sekundära färdigheter är 4.', { kind: 'baseCost', skills: 'sekundär', cost: 4 }),
  ab(65, 65, 'extremt_smarttalig', 'Extremt smärttålig', 'Totala KP gångras med 1,5, och träffområdena räknas om efter det.', { kind: 'kpFactor', factor: 1.5 }),
  ab(66, 66, 'snabbslaende', 'Snabbslående', 'Slår alltid först i varje runda.'),
  ab(67, 67, 'baneman', 'Baneman', '+5 på CL vid alla anfall mot ett valt folkslag eller en vald ras.', { kind: 'foe' }, { passive: { foeCl: 5 } }),
  ab(68, 68, 'god_kroppskontroll', 'God kroppskontroll', 'Ett Normalt FYS-slag ger +5 på STY i 3 rundor, två gånger per dag.'),
  ab(69, 69, 'jarnnave', 'Järnnäve', 'Gör alltid maximal skada obeväpnad.'),
  ab(70, 70, 'extremt_orädd', 'Extremt orädd', '−5 på alla slag på Skräcktabellen.', { kind: 'none' }, { passive: { fear: -5 } }),
  ab(71, 71, 'orubblig_vilja', 'Orubblig vilja', '+5 på PSY i kamp PSY mot PSY.', { kind: 'none' }, { passive: { psyResist: 5 } }),
  ab(72, 72, 'hardig_mot_element', 'Härdig mot element', '+5 på FYS i motståndsslag mot eld, köld, vatten, vind och liknande.', { kind: 'none' }, { passive: { elementResist: 5 } }),
  ab(73, 73, 'gott_lakekott', 'Gott läkekött', 'Skador av våld och elementarbesvärjelser läker dubbelt så fort.'),
  ab(74, 74, 'god_mental_kontroll', 'God mental kontroll', 'PSY-poäng som besvärjelser kostat återfås dubbelt så fort.', { kind: 'none' }, { magicianOnly: { otherwise: 'gott_lakekott' } }),
  ab(75, 75, 'naturlig_vapenfardighet', 'Naturlig färdighet med vapen', '+5 på FV i en valfri vapenfärdighet.', { kind: 'fvChoice', filter: 'vapen', amount: 5 }),
  ab(76, 76, 'kluven_personlighet', 'Kluven personlighet', 'Får också yrkesförmågan från ett annat valfritt yrke.', { kind: 'extraProfessionAbility' }),
  ab(77, 77, 'god_kansla_for_yrket', 'God känsla för yrket', 'Halverad kostnad för en vald yrkesfärdighet eller besvärjelse (avrundas uppåt).', { kind: 'halfCost' }),
  ab(78, 78, 'hamnbytare', 'Hamnbytare', 'Kan förvandla sig till ett djur (1T6: varg, björn, hök, hjort, svan, katt). Fastnar för alltid i hamnen om ett PSY-slag misslyckas.'),
  ab(79, 79, 'snabb_uppfattning', 'Snabb uppfattningsförmåga', '+5 på CL vid pareringar i närstrid, och kan parera projektiler med ett närstridsvapen.'),
  ab(80, 80, 'god_psy_potential', 'God PSY-potential', '−5 på slaget när PSY ska höjas.'),
  ab(81, Infinity, 'hojd_grundegenskap', 'Höjd grundegenskap', '+1 på tre olika grundegenskaper eller +2 på en (inte STO).', { kind: 'attrs' }),
];

export function abilityFor(total: number, magician = false): AbilityDef {
  const row = ABILITIES.find((a) => total >= a.min && total <= a.max) ?? ABILITIES[0];
  if (row.magicianOnly && !magician) return ABILITIES.find((a) => a.id === row.magicianOnly!.otherwise)!;
  return row;
}

export const ABILITY_BY_ID: Record<string, AbilityDef> = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

export type RaisableAttr = Exclude<AttrKey, 'STO'>;
