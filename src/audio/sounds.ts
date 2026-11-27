import { ARMOR } from '../data/armor';
import { HERBS } from '../data/herbs';
import { SPELLS } from '../data/spells';
import { MELEE_WEAPONS } from '../data/weapons';
import type { Cue, Game } from '../engine/game';
import { itemInfo } from '../engine/inventory';
import { inBounds, tileAt } from '../engine/map';
import type { Actor } from '../engine/types';

/**
 * Ljudtabellen: vilket ljud som hör till vilken ljudsignal. Det är den här filen som ändras när
 * nya ljud kommer. Filerna skrivs som sökvägar under public/audio/, utan .mp3.
 */

/** Ett ljud att spela: filen (under public/audio/, utan .mp3), volymen (0–1) och tonhöjden (1 = som inspelat). */
export interface SoundPick {
  file: string;
  volume: number;
  rate: number;
  /** Hur många ms efter signalen ljudet börjar (utan värdet: efter ordningen, se src/audio/index.ts). */
  delay?: number;
}

/** Flares ljud under public/audio/flare/sfx/. */
const fl = (...names: string[]) => names.map((n) => `flare/sfx/${n}`);
/** Ljud från OpenGameArt under public/audio/oga/ (tools/oga_audio.py), numrerade från 1. */
const oga = (name: string, count: number) => Array.from({ length: count }, (_, i) => `oga/${name}${i + 1}`);

/** Namngivna grupper av ljud. Ett av ljuden i gruppen väljs varje gång. */
export const SFX = {
  hugg: fl('melee_attack', 'melee_attack_2', 'melee_attack_3'),
  parera: fl('powers/block'),
  skott: fl('powers/shoot'),
  fummel: fl('no_mana'),
  manTraff: fl('male_hit'),
  kvinnaTraff: fl('female_hit'),
  manDor: fl('male_die'),
  kvinnaDor: fl('female_die'),
  svartalfTraff: fl('enemies/goblin_hit'),
  svartalfDor: fl('enemies/goblin_die'),
  skelettTraff: fl('enemies/skeleton_hit'),
  skelettDor: fl('enemies/skeleton_die'),
  zombieTraff: fl('enemies/zombie_hit'),
  zombieDor: fl('enemies/zombie_die'),
  storTraff: fl('enemies/minotaur_hit'),
  storDor: fl('enemies/minotaur_die'),
  eld: fl('powers/fireball', 'powers/burn'),
  blixt: fl('powers/shock', 'powers/thunder'),
  kold: fl('powers/freeze'),
  lak: fl('powers/heal'),
  skydd: fl('powers/shield'),
  flytt: fl('powers/teleport'),
  jord: fl('powers/spikes', 'powers/quake'),
  sinne: fl('powers/timestop'),
  misslyckad: fl('no_mana'),
  stridsrop: fl('powers/warcry'),
  steg_gras: oga('steg/gras', 9),
  steg_lov: oga('steg/lov', 2),
  steg_grus: oga('steg/grus', 10),
  steg_tra: oga('steg/tra', 9),
  steg_sten: oga('steg/sten', 9),
  steg_grotta: oga('steg/grotta', 9),
  steg_vatten: oga('steg/vatten', 5),
  svard: oga('strid/svard', 5),
  tanda: oga('ljus/tanda', 3),
  lagga: oga('vila/lagga', 1),
  kvitter: fl('utdrag/kvitter'),
  uggla: fl('utdrag/uggla'),
  lagereld: fl('utdrag/lagereld'),
  ringbrynja: oga('strid/ringbrynja', 2),
  dorr: fl('door_open'),
  kista: fl('wood_open'),
  metall: fl('inventory/inventory_metal'),
  lader: fl('inventory/inventory_leather'),
  tyg: fl('inventory/inventory_cloth'),
  dryck: fl('inventory/inventory_potion'),
  bok: fl('inventory/inventory_book'),
  mynt: fl('inventory/inventory_coins'),
  foremal: fl('inventory/inventory_object'),
  niva: fl('level_up'),
  knapp: fl('widget_activate'),
} satisfies Record<string, string[]>;

export type SfxGroup = keyof typeof SFX;

/** Alla filer som tabellen använder (för testet som ser att de finns). */
export const SFX_FILES: string[] = [...new Set(Object.values(SFX).flat())];

/** Besvärjelser med ett eget ljud, före effektens sort och skolan. */
const SPELL_SOUND: Record<string, SfxGroup> = {
  eld: 'eld',
  explosion: 'eld',
  flammande_hand: 'eld',
  traeld: 'eld',
  blixt: 'blixt',
  nedkalla_askvigg: 'blixt',
  frost: 'kold',
  ortrankor: 'jord',
};
const EFFECT_SOUND: Record<string, SfxGroup> = {
  läka: 'lak',
  motgift: 'lak',
  skydd: 'skydd',
  antimagi: 'skydd',
  beskyddare: 'skydd',
  virvelsköld: 'skydd',
  luftsköld: 'skydd',
  teleportera: 'flytt',
  språng: 'flytt',
  levitation: 'flytt',
  flyga: 'flytt',
  lyft: 'flytt',
  köld: 'kold',
};
const SCHOOL_SOUND: Record<string, SfxGroup> = { elementarmagi: 'eld', animism: 'jord', mentalism: 'sinne', allmän: 'sinne' };

/** Varelser efter figur: ljudet och grundtonen. Figurer som inte står här låter som en svartalf, lite mörkare. */
const CREATURE_VOICE: Record<string, { voice: 'svartalf' | 'skelett' | 'zombie' | 'stor' | 'man' | 'kvinna'; rate: number }> = {
  svartalf: { voice: 'svartalf', rate: 1 },
  hovding: { voice: 'svartalf', rate: 0.9 },
  haxkonstnar: { voice: 'svartalf', rate: 1.1 },
  varg: { voice: 'svartalf', rate: 0.8 },
  bjorn: { voice: 'stor', rate: 0.8 },
  knekt: { voice: 'man', rate: 1 },
  vard: { voice: 'man', rate: 1 },
  smed: { voice: 'man', rate: 1 },
  gumma: { voice: 'kvinna', rate: 1 },
};
const VOICE_GROUPS = {
  svartalf: ['svartalfTraff', 'svartalfDor'],
  skelett: ['skelettTraff', 'skelettDor'],
  zombie: ['zombieTraff', 'zombieDor'],
  stor: ['storTraff', 'storDor'],
  man: ['manTraff', 'manDor'],
  kvinna: ['kvinnaTraff', 'kvinnaDor'],
} as const satisfies Record<string, readonly [SfxGroup, SfxGroup]>;

/** Grundton för hugg efter vapengrupp: tunga vapen lägre, dolkar ljusare. */
const WEAPON_RATE: Record<string, number> = { kross: 0.85, yxa: 0.85, dolkar: 1.15 };

const pick = (group: SfxGroup, rng: () => number, base = 1, volume = 1): SoundPick => {
  const files = SFX[group];
  return { file: files[Math.min(files.length - 1, Math.floor(rng() * files.length))], volume, rate: base * (0.95 + 0.1 * rng()) };
};

const tileName = (g: Game, a: Actor) => (inBounds(g.map, a.x, a.y) ? tileAt(g.map, a.x, a.y)?.name : undefined);

/** Vem som låter: en person efter kön, en varelse efter figur. */
function voiceOf(g: Game, a: Actor): { voice: keyof typeof VOICE_GROUPS; rate: number } {
  const ch = g.charOf(a);
  if (ch) return { voice: ch.gender === 'kvinna' ? 'kvinna' : 'man', rate: 1 };
  return CREATURE_VOICE[a.sprite] ?? { voice: 'svartalf', rate: 0.8 };
}

/** Stegen låter efter marken, inte efter rustningen (Vidar). */
const STEP_SOUND: Record<string, SfxGroup> = {
  gräs: 'steg_gras',
  'öppen skog': 'steg_gras',
  kullar: 'steg_gras',
  'tät skog': 'steg_lov',
  stig: 'steg_grus',
  trägolv: 'steg_tra',
  bro: 'steg_tra',
  dörr: 'steg_tra',
  berg: 'steg_sten',
  grottgolv: 'steg_grotta',
  vadställe: 'steg_vatten',
};

const stepGroup = (g: Game, a: Actor): SfxGroup => STEP_SOUND[tileName(g, a) ?? ''] ?? 'steg_gras';

function spellGroup(id: string): SfxGroup {
  const s = SPELLS[id];
  return SPELL_SOUND[id] ?? (s && (EFFECT_SOUND[s.effect?.kind ?? ''] ?? SCHOOL_SOUND[s.school])) ?? 'sinne';
}

function itemGroup(id: string): SfxGroup {
  if (HERBS[id]) return 'dryck';
  const info = itemInfo(id);
  if (!info) return 'foremal';
  if (info.kind === 'vapen' || info.kind === 'sköld') return 'metall';
  if (info.kind === 'rustning') return ARMOR[id]?.metal ? 'metall' : 'lader';
  if (info.category === 'kläder') return 'tyg';
  if (info.category === 'bok') return 'bok';
  return 'foremal';
}

/** Ljuden för en ljudsignal, i den ordning de ska spelas (oftast ett, ibland två). */
export function soundFor(g: Game, cue: Cue, rng: () => number = Math.random): SoundPick[] {
  switch (cue.type) {
    case 'anfall': {
      if (cue.result === 'fummel') return [pick('fummel', rng)];
      const group = MELEE_WEAPONS.find((w) => w.id === cue.weapon)?.group ?? '';
      const base = cue.natural ? 0.9 : (WEAPON_RATE[group] ?? 1);
      const swing = pick('hugg', rng, base);
      return cue.result === 'parerat' ? [swing, pick('parera', rng)] : [swing];
    }
    case 'skott':
      return [pick(cue.result === 'fummel' ? 'fummel' : 'skott', rng)];
    case 'skada':
    case 'död': {
      const a = g.actor(cue.actorId);
      if (!a) return [];
      const { voice, rate } = voiceOf(g, a);
      return [pick(VOICE_GROUPS[voice][cue.type === 'skada' ? 0 : 1], rng, rate)];
    }
    case 'besvärjelse':
      return [pick(cue.result === 'lyckas' ? spellGroup(cue.spell) : 'misslyckad', rng)];
    case 'förmåga':
      return [pick(cue.ability === 'handpåläggning' ? 'lak' : 'stridsrop', rng)];
    case 'steg': {
      const a = g.actor(cue.actorId);
      if (!a) return [];
      const out = [pick(stepGroup(g, a), rng, 1, 0.35)];
      if (tileName(g, a) === 'dörr') out.push(pick('dorr', rng));
      return out;
    }
    case 'ljus':
      return [cue.lit ? pick('tanda', rng) : pick('tyg', rng, 1, 0.6)];
    case 'vila': {
      // Man lägger sig, natten går (lägereld och uggla ute i lägret) och man vaknar till fågelkvitter.
      const lie = pick('lagga', rng, 1, 0.7);
      const dawn = (delay: number) => ({ ...pick('kvitter', rng, 1, 0.6), delay });
      if (cue.how === 'sömn') return [lie, dawn(1800)];
      return [lie, { ...pick('lagereld', rng, 1, 0.6), delay: 200 }, { ...pick('uggla', rng, 1, 0.5), delay: 900 }, dawn(3200)];
    }
    case 'strid':
      return cue.phase === 'börjar' ? [pick('svard', rng), pick('ringbrynja', rng)] : [];
    case 'lås':
      if (cue.how === 'misslyckat') return [pick('metall', rng, 1.2, 0.5)];
      return [pick(cue.kind === 'kista' ? 'kista' : 'dorr', rng)];
    case 'packning': {
      const item = pick(itemGroup(cue.item), rng);
      return cue.how === 'köpt' || cue.how === 'sålt' ? [item, pick('mynt', rng)] : [item];
    }
    case 'träning':
      return [pick('niva', rng)];
  }
}

/** Ljudet när man klickar på en knapp. */
export const buttonSound = (rng: () => number = Math.random): SoundPick => pick('knapp', rng, 1, 0.3);
