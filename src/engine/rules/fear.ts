import { die, roll, type Rng } from '../dice';
import type { TableRow } from './outcomes';

/**
 * Skräck (Bok III s. 8–10). Offret slår 1T20 − PSY + skräckvärdet och läser av tabellen.
 * Beskrivningarna är egna och korta. Rad 0 gäller resultat under 1 och rad 28 resultat på 28
 * eller mer.
 */
export const FEAR_TABLE: TableRow[] = [
  { text: 'Helt oberörd: −2 på Skräcktabellen resten av dagen.', effects: [{ kind: 'skräckMod', mod: -2, days: 1 }] },
  { text: 'Oberörd.', effects: [{ kind: 'ingenting' }] },
  { text: 'Försiktig: −1 på anfall och pareringar den här rundan.', effects: [{ kind: 'cl', mod: -1, scope: 'strid', rounds: 1 }] },
  { text: 'Försiktig: −2 på anfall och pareringar i 1T4 rundor.', effects: [{ kind: 'cl', mod: -2, scope: 'strid', rounds: '1T4' }] },
  { text: 'Paralyserad av skräck den här rundan.', effects: [{ kind: 'ingenHandling', rounds: 1 }] },
  { text: 'Försiktig: −1T4 på allt i 1T4 rundor.', effects: [{ kind: 'cl', mod: '1T4', scope: 'alla', rounds: '1T4' }] },
  { text: 'Paralyserad av skräck i 1T4 rundor.', effects: [{ kind: 'ingenHandling', rounds: '1T4' }] },
  { text: 'Illamående och kramper: kan inte göra något i 1T4+2 rundor.', effects: [{ kind: 'ingenHandling', rounds: '1T4+2' }] },
  { text: 'Går bärsärkagång och rusar mot skräckkällan.', effects: [{ kind: 'bärsärk', whileSource: true }] },
  { text: 'Drabbas av en mild fobi.', effects: [{ kind: 'fobi', level: 'mild' }] },
  { text: 'Flyr från skräckkällan i 3T6 rundor.', effects: [{ kind: 'flyr', rounds: '3T6' }] },
  { text: 'Darrar i hela kroppen: −2T4 på allt i 2T8 rundor.', effects: [{ kind: 'cl', mod: '2T4', scope: 'alla', rounds: '2T8' }] },
  { text: 'Flyr skrikande åt slumpmässigt håll i 3T6 rundor.', effects: [{ kind: 'flyr', random: true, rounds: '3T6' }] },
  { text: 'Svimmar och vaknar efter 2T8 rundor.', effects: [{ kind: 'medvetslös', rounds: '2T8' }] },
  { text: 'Svimmar och vaknar efter 2T8 minuter.', effects: [{ kind: 'medvetslös', rounds: '2T8*12' }] },
  { text: 'Drabbas av en normal fobi.', effects: [{ kind: 'fobi', level: 'normal' }] },
  {
    text: 'Skakar okontrollerat på marken tills skräckkällan är borta, och är sedan darrig i 1T4 timmar (halv SMI).',
    effects: [{ kind: 'liggande', whileSource: true }, { kind: 'ingenHandling', whileSource: true }, { kind: 'cl', mod: 'halv', scope: 'smi', rounds: '1T4*720' }],
  },
  {
    text: 'Står paralyserad tills skräckkällan är borta, och får +1 på Skräcktabellen resten av dagen.',
    effects: [{ kind: 'ingenHandling', whileSource: true }, { kind: 'skräckMod', mod: 1, days: 1 }],
  },
  { text: 'Flyr vilt och vågar inte återvända resten av dagen.', effects: [{ kind: 'flyr', whileSource: true }] },
  { text: 'Låtsas att skräckkällan inte finns och vägrar se den.', effects: [{ kind: 'ingenHandling', whileSource: true }] },
  {
    text: 'Hysterisk: står kvar och skriker tills skräckkällan är borta, och får +3 på Skräcktabellen resten av dagen.',
    effects: [{ kind: 'ingenHandling', whileSource: true }, { kind: 'skräckMod', mod: 3, days: 1 }],
  },
  {
    text: 'Svimmar i 2T8 minuter och håret vitnar. +15 på Skräcktabellen i 1T3 dagar.',
    effects: [{ kind: 'medvetslös', rounds: '2T8*12' }, { kind: 'skräckMod', mod: 15, days: '1T3' }, { kind: 'grundegenskaper' }],
  },
  { text: 'Drabbas av en svår fobi och får +4 på Skräcktabellen i 1T4 dagar.', effects: [{ kind: 'fobi', level: 'svår' }, { kind: 'skräckMod', mod: 4, days: '1T4' }] },
  { text: 'Faller medvetslös i 2T8 minuter och drabbas av en sinnessjukdom.', effects: [{ kind: 'medvetslös', rounds: '2T8*12' }] },
  {
    text: 'Hjärtattack: klarar hen inte ett Normalt FYS-slag dör hen, annars medvetslös i 1T8 timmar. +5 på Skräcktabellen i 2T4 dagar.',
    effects: [{ kind: 'hjärtattack', difficulty: 'Normalt' }, { kind: 'skräckMod', mod: 5, days: '2T4' }, { kind: 'grundegenskaper' }],
  },
  {
    text: 'En kraftig kroppslig förändring som SL bestämmer. +6 på Skräcktabellen i 2T6 dagar.',
    effects: [{ kind: 'skräckMod', mod: 6, days: '2T6' }, { kind: 'grundegenskaper' }],
  },
  { text: 'Hjärnblödning: INT sjunker med 1T4 för alltid.', effects: [{ kind: 'sänkInt', amount: '1T4' }, { kind: 'grundegenskaper' }] },
  {
    text: 'Massiv hjärtattack: klarar hen inte ett Svårt FYS-slag dör hen.',
    effects: [{ kind: 'hjärtattack', difficulty: 'Svårt' }, { kind: 'skräckMod', mod: 5, days: '2T4' }, { kind: 'grundegenskaper' }],
  },
  { text: 'Djup koma i 1T8 månader och en mild fobi som inte går att bota.', effects: [{ kind: 'koma' }, { kind: 'grundegenskaper' }] },
];

/** Raden i Skräcktabellen för ett resultat. */
export function fearRow(result: number): TableRow {
  return FEAR_TABLE[Math.max(0, Math.min(FEAR_TABLE.length - 1, result))];
}

/** Skräckvärden för andra händelser än varelser (Bok III s. 9). */
export const FEAR_EVENTS = {
  'Död kropp': '1',
  'Nära vän död': '1T4',
  'Nära vän lemlästad': '1T6',
  'Svårt lemlästad kropp': '1T4',
  'Svårt sjuk person': '1T4',
  'Onaturlig händelse': '1T10',
  'Ytterst onaturlig händelse': '1T20',
  'Mild fobi': '5',
  'Normal fobi': '10',
  'Svår fobi': '15',
} as const;

/** Modifikationer på slaget. Bara den högsta används när flera gäller. */
export const FEAR_MODS = {
  'Möter skräckkällan ofta': -6,
  'Har hunnit förbereda sig': -3,
  'Har mött skräckkällan förut': -2,
  'Överraskad av skräckkällan': 4,
  'Onaturliga händelser': 4,
  'Ytterst onaturliga händelser': 15,
} as const;

/**
 * Slaget på Skräcktabellen: 1T20 − PSY + skräckvärdet + den högsta modifikationen
 * (eller den lägsta, om alla är negativa).
 */
export function fearRoll(psy: number, value: number | string, mods: number[], rng: Rng): { die: number; result: number } {
  const d = die(20, rng);
  const v = typeof value === 'number' ? value : roll(value, rng);
  const positive = mods.filter((m) => m > 0);
  const mod = positive.length ? Math.max(...positive) : mods.length ? Math.min(...mods) : 0;
  return { die: d, result: d - psy + v + mod };
}
