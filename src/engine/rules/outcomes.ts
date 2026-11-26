import type { HitLocation } from './tables';

/**
 * Spelmekaniska följder som tabellerna (fummel, skräck, kritiska skador) kan ge. Motorn
 * (src/engine/combat.ts) vet hur varje sort verkar. Tärningsuttryck skrivs som strängar.
 */

/** Vilka slag en modifikation gäller. */
export type Scope =
  /** Anfall och pareringar. */
  | 'strid'
  | 'anfall'
  | 'parering'
  /** Alla färdighetsslag. */
  | 'alla'
  /** Anfall och pareringar med det vapen som fumlade. */
  | 'vapen'
  /** SMI-baserade färdigheter (och därmed alla vapen). */
  | 'smi'
  /** SMI- och STY-baserade färdigheter. */
  | 'smiSty'
  | 'avstånd'
  /** Färdigheter som bygger på en viss grundegenskap (gifter). Besvärjelser bygger på PSY. */
  | 'int'
  | 'kar'
  | 'psy'
  | 'sty'
  /** Alla besvärjelser, eller allt utom besvärjelser. */
  | 'magi'
  | 'ejMagi'
  /** En enda färdighet, den i effektens `skill`. */
  | 'färdighet';

/** Hur länge en följd varar. Rundor räknas med den pågående rundan som den första. */
export interface Duration {
  rounds?: number | string;
  days?: number | string;
  /** Antal slag som påverkas. */
  uses?: number;
  /** Tills man slår ett perfekt slag. */
  untilPerfect?: boolean;
  /** Tills man lägger en hel runda på att rätta till felet. */
  untilFixed?: boolean;
  /** Tills nästa vila. */
  untilRest?: boolean;
  /** Så länge skräckkällan finns kvar. */
  whileSource?: boolean;
}

export type Outcome =
  | { kind: 'ingenting' }
  | ({ kind: 'cl'; mod: number | string; scope: Scope } & Duration)
  /** Alla anfall och pareringar (eller bara anfall) misslyckas automatiskt. */
  | ({ kind: 'misslyckas'; scope: 'strid' | 'anfall' } & Duration)
  | ({ kind: 'endastParera' } & Duration)
  | ({ kind: 'ingenHandling' } & Duration)
  | ({ kind: 'ingenParering' } & Duration)
  | ({ kind: 'liggande' } & Duration)
  | ({ kind: 'medvetslös' } & Duration)
  /** Den som anfaller nästa gång (eller under rundan) får en bonus. */
  | ({ kind: 'motståndarBonus'; mod: number } & Duration)
  /** Nästa fientliga anfall lyckas automatiskt. */
  | { kind: 'utsatt'; noParry: boolean }
  | ({ kind: 'förflyttning'; mod: number | 'halv' } & Duration)
  | { kind: 'vapenSönder' }
  | { kind: 'sköldSönder' }
  | { kind: 'tappaVapen'; distance: string }
  | { kind: 'tappaSköld'; distance: string }
  | { kind: 'tappaRustning' }
  /** Sköldarmen ur led: varken armen eller skölden kan användas resten av striden. */
  | { kind: 'sköldarmUr' }
  /** Egen skada, utan avdrag för rustning. 'ben' väljer ett slumpvis ben. */
  | { kind: 'skada'; kp: number; loc: HitLocation | 'ben' | 'svärdsarm' }
  /** Träffar närmsta vän; finns ingen följeslagare slås det om (husregel). */
  | { kind: 'vän'; perfect?: boolean }
  /** Kvävs om ingen hjälper till inom så här många rundor. */
  | { kind: 'kvävs'; rounds: number }
  | { kind: 'tvåGånger' }
  // ------------------------------------------------ bara på Skräcktabellen
  | ({ kind: 'flyr'; random?: boolean } & Duration)
  | ({ kind: 'bärsärk' } & Duration)
  | { kind: 'fobi'; level: 'mild' | 'normal' | 'svår' }
  /** Modifikation på kommande slag på Skräcktabellen. */
  | ({ kind: 'skräckMod'; mod: number } & Duration)
  /** Slå 1T20 för varje grundegenskap utom STO: 19–20 sänker den med 1T2. */
  | { kind: 'grundegenskaper' }
  /** FYS-slag med svårighetsgrad; misslyckas det dör offret. */
  | { kind: 'hjärtattack'; difficulty: 'Normalt' | 'Svårt' }
  | { kind: 'sänkInt'; amount: string }
  /** Djup koma i månader: äventyret är slut för rollpersonen. */
  | { kind: 'koma' };

export interface TableRow {
  /** Egen kort beskrivning av utfallet. */
  text: string;
  effects: Outcome[];
}
