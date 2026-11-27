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
 * nya ljud kommer. Filerna ligger under public/audio/flare/sfx/ och skrivs utan .mp3.
 */

/** Ett ljud att spela: filen, volymen (0–1) och tonhöjden (1 = som inspelat). */
export interface SoundPick {
  file: string;
  volume: number;
  rate: number;
}

const steps = (kind: string) => [1, 2, 3, 4].map((n) => `steps/step_${kind}${n}`);

/** Namngivna grupper av ljud. Ett av ljuden i gruppen väljs varje gång. */
export const SFX = {
  hugg: ['melee_attack', 'melee_attack_2', 'melee_attack_3'],
  parera: ['powers/block'],
  skott: ['powers/shoot'],
  fummel: ['no_mana'],
  manTraff: ['male_hit'],
  kvinnaTraff: ['female_hit'],
  manDor: ['male_die'],
  kvinnaDor: ['female_die'],
  svartalfTraff: ['enemies/goblin_hit'],
  svartalfDor: ['enemies/goblin_die'],
  skelettTraff: ['enemies/skeleton_hit'],
  skelettDor: ['enemies/skeleton_die'],
  zombieTraff: ['enemies/zombie_hit'],
  zombieDor: ['enemies/zombie_die'],
  storTraff: ['enemies/minotaur_hit'],
  storDor: ['enemies/minotaur_die'],
  eld: ['powers/fireball', 'powers/burn'],
  blixt: ['powers/shock', 'powers/thunder'],
  kold: ['powers/freeze'],
  lak: ['powers/heal'],
  skydd: ['powers/shield'],
  flytt: ['powers/teleport'],
  jord: ['powers/spikes', 'powers/quake'],
  sinne: ['powers/timestop'],
  misslyckad: ['no_mana'],
  stridsrop: ['powers/warcry'],
  steg_tyg: steps('cloth'),
  steg_lader: steps('leather'),
  steg_metall: steps('metal'),
  steg_eko: steps('echo'),
  dorr: ['door_open'],
  kista: ['wood_open'],
  eld_tand: ['environment/open_fire'],
  metall: ['inventory/inventory_metal'],
  lader: ['inventory/inventory_leather'],
  tyg: ['inventory/inventory_cloth'],
  dryck: ['inventory/inventory_potion'],
  bok: ['inventory/inventory_book'],
  mynt: ['inventory/inventory_coins'],
  foremal: ['inventory/inventory_object'],
  niva: ['level_up'],
  knapp: ['widget_activate'],
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

function stepGroup(g: Game, a: Actor): SfxGroup {
  if (tileName(g, a) === 'grottgolv') return 'steg_eko';
  const armor = a.armor.map((id) => ARMOR[id]).filter(Boolean);
  if (armor.some((p) => p.metal)) return 'steg_metall';
  return armor.length ? 'steg_lader' : 'steg_tyg';
}

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
      return [cue.lit ? pick('eld_tand', rng) : pick('tyg', rng, 1, 0.6)];
    case 'vila':
      return [pick('eld_tand', rng, 0.9, 0.6)];
    case 'strid':
      return cue.phase === 'börjar' ? [pick('stridsrop', rng), pick('metall', rng)] : [];
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
