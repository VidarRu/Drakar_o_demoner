import { BANDS, CREATURES, MAPS, MODULES, PROFESSION_SPRITES, RECRUITS, type BandDef } from '../content';
import { ARMOR } from '../data/armor';
import { RACES } from '../data/races';
import * as combat from './combat';
import * as time from './time';
import * as stealth from './stealth';
import * as maneuvers from './maneuvers';
import * as party from './party';
import * as elementals from './elementals';
import * as hero from './hero';
import * as talents from './talents';
import * as worldmap from './worldmap';
import { swapMap } from './modules';
import { roll, type Rng } from './dice';
import {
  computeFov,
  distance,
  findPath,
  idx,
  lineOfSight,
  parseMap,
  reachable,
  type GameMap,
  type Point,
} from './map';
import {
  DAY,
  HIT_LOCATIONS,
  HOUR,
  locationKp,
  maxKp,
  movement,
  skillCheck,
  type Check,
  type HitLocation,
} from './rules';
import type { Actor, Attrs, BandState, Character, CreatureDef, GameState } from './types';
import { fogBlocks, passable } from './spelleffects';
import { lockBlocks } from './locks';
import { startWeather } from './weather';
import { ensureLight, toggleLight } from './light';
import { syncItemEffects } from './magicitems';
import { shapeshift as shapeshiftActor } from './shapeshift';
import { wardCheck } from './magic';

export const FOV_RADIUS = 8;

/** Vyer som spelmotorn kan be gränssnittet öppna. */
export type UiView = 'training' | 'shop' | 'exit';
const LOG_LIMIT = 300;

/** Visuell effekt som gränssnittet kan visa (t.ex. skadesiffror). */
export interface Fx {
  actorId: string;
  text: string;
  kind: 'damage' | 'miss' | 'heal' | 'info';
}

/**
 * En ljudsignal: vad som hände, inte vilket ljud som ska spelas. Ljudmodulen (src/audio/)
 * lyssnar på dem med onCue och väljer ljudet själv; motorn känner inte till ljud.
 */
export type Cue =
  | { type: 'anfall'; actorId: string; targetId: string; weapon: string; natural: boolean; result: 'träff' | 'parerat' | 'miss' | 'fummel' }
  | { type: 'skott'; actorId: string; targetId: string; weapon: string; result: 'träff' | 'miss' | 'fummel' }
  | { type: 'skada'; actorId: string }
  | { type: 'död'; actorId: string }
  | { type: 'besvärjelse'; actorId: string; spell: string; result: 'lyckas' | 'misslyckas' | 'snedtändning' }
  | { type: 'förmåga'; actorId: string; ability: 'kroppskontroll' | 'handpåläggning' | 'framträdande' }
  | { type: 'steg'; actorId: string }
  | { type: 'ljus'; actorId: string; lit: boolean }
  | { type: 'vila'; how: 'sömn' | 'läger' }
  | { type: 'strid'; phase: 'börjar' | 'slutar' }
  | { type: 'lås'; kind: 'dörr' | 'kista'; how: 'dyrkat' | 'brutet' | 'öppnat' | 'misslyckat' }
  | { type: 'packning'; item: string; how: 'utrustat' | 'undanlagt' | 'köpt' | 'sålt' }
  | { type: 'träning'; actorId: string };

const describe = (c: Check) => `T20: ${c.roll} mot ${c.target}`;

interface ActorInit {
  id: string;
  defId: string;
  name: string;
  kind: Actor['kind'];
  sprite: string;
  x: number;
  y: number;
  attrs: Attrs;
  skills: Record<string, number>;
  weapon: string;
  offhand?: string;
  armor: string[];
  naturalArmor: number;
  shield?: string;
  move: number;
  hostile: boolean;
  detailed: boolean;
  sight: number;
  darkvision: boolean;
  silver: number;
  swordArm?: HitLocation;
}

/** Skapar en figur med kroppspoäng per kroppsdel och fulla BV på utrustningen. */
export function makeActor(init: ActorInit, extra: Partial<Actor> = {}): Actor {
  const kp = maxKp(init.attrs);
  const loc = locationKp(kp);
  const a: Actor = {
    ...init,
    kp,
    maxKp: kp,
    locKp: { ...loc },
    locMax: { ...loc },
    bleeding: [],
    bleedTimer: 0,
    disabled: [],
    critical: [],
    injuries: [],
    ep: {},
    epBlocked: [],
    psy: init.attrs.PSY,
    infections: [],
    combatWounds: [],
    healHours: 0,
    psyHours: 0,
    restSeconds: 0,
    medicineDay: 0,
    bv: {},
    swordArm: init.swordArm ?? 'höger arm',
    alive: true,
    unconscious: false,
    down: false,
    fled: false,
    facing: { dx: 0, dy: 1 },
    effects: [],
    morale: [],
    initiative: 0,
    ...extra,
  };
  a.bv = combat.initialBv(a);
  return a;
}

/** En figur för en rollperson eller följeslagare, byggd ur rollformuläret. */
export function actorFromCharacter(char: Character, id: string, x: number, y: number, sprite?: string): Actor {
  const race = RACES[char.race];
  const a = makeActor(
    {
      id,
      defId: id === 'player' ? 'player' : `rp:${slugName(char.name)}`,
      name: char.name,
      kind: 'player',
      sprite: sprite ?? char.sprite ?? PROFESSION_SPRITES[char.profession] ?? 'krigare',
      x,
      y,
      attrs: { ...char.attrs },
      skills: { ...char.skills },
      weapon: char.equipped.weapon ?? 'nave',
      offhand: char.equipped.offhand,
      armor: [...char.equipped.armor],
      naturalArmor: 0,
      shield: char.equipped.shield,
      move: movement(char.attrs, race.move),
      hostile: false,
      detailed: true,
      sight: FOV_RADIUS,
      darkvision: !!race.darkvision,
      silver: char.silver,
      swordArm: char.swordHand === 'vänster' ? 'vänster arm' : 'höger arm',
    },
    {
      profession: char.profession,
      techniques: [...char.techniques],
    },
  );
  // KP med Extremt smärttålig, initiativ och Snabbslående, även för förmågor köpta för hjältepoäng.
  hero.recompute(a, char);
  return a;
}


/**
 * Placerar ut kartans varelser och de personer som kan följa med. Varelser med en dödsflagga som
 * redan är satt (t.ex. en hövding som dödats) kommer inte tillbaka.
 */
export function spawnActors(state: GameState, map: GameMap, rng: Rng) {
  for (const s of map.spawns) {
    if (s.recruit) {
      // En person som redan följer med gruppen står inte kvar på sin plats.
      if (state.actors.some((a) => a.companion?.recruit === s.recruit)) continue;
      const r = RECRUITS[s.recruit];
      const ch = r.character();
      const a = actorFromCharacter(ch, `a${state.nextId++}`, s.x, s.y, r.sprite);
      a.kind = 'npc';
      a.npc = r.npc;
      a.companion = { recruit: r.id, pay: r.pay, wage: r.wage, morale: r.morale, home: { x: s.x, y: s.y }, homeMap: map.id };
      state.companions[a.id] = ch;
      state.actors.push(a);
      continue;
    }
    if (s.band) {
      const def = BANDS[s.band];
      if (def.deathFlag && state.flags[def.deathFlag]) continue;
      (state.bands ??= []).push(makeBand(state, def, s.x, s.y, rng));
      continue;
    }
    const def = CREATURES[s.creature!];
    if (def.deathFlag && state.flags[def.deathFlag]) continue;
    state.actors.push(spawnCreature(state, def, s.x, s.y, rng));
  }
}

/** En varelse ur innehållet på en ruta. */
export function spawnCreature(state: GameState, def: CreatureDef, x: number, y: number, rng: Rng): Actor {
  return makeActor(
    {
      id: `a${state.nextId++}`,
      defId: def.id,
      name: def.name,
      kind: def.npc ? 'npc' : 'monster',
      sprite: def.sprite,
      x,
      y,
      attrs: { ...def.attrs },
      skills: { ...def.skills, ...magicSkills(def) },
      weapon: def.weapon,
      armor: [...(def.armor ?? [])],
      naturalArmor: def.naturalArmor ?? 0,
      shield: def.shield,
      move: def.move,
      hostile: def.hostile,
      detailed: def.humanoid,
      sight: def.sight ?? 6,
      darkvision: !!def.darkvision,
      silver: def.silver ? roll(def.silver, rng) : 0,
    },
    {
      npc: def.npc,
      deathFlag: def.deathFlag,
      leader: def.leader,
      noMorale: def.noMorale,
      fear: def.fear,
      ...(def.ranged ? { ranged: def.ranged.weapon, rangedAmmo: def.ranged.ammo } : {}),
      ...(def.loot ? { loot: [...def.loot] } : {}),
      ...(def.magic ? { spells: [...def.magic.spells] } : {}),
    },
  );
}

/** En fiendegrupp på världskartan. Antalet varelser slås när gruppen placeras ut. */
export function makeBand(state: GameState, def: BandDef, x: number, y: number, rng: Rng): BandState {
  const members = def.members.flatMap((m) => new Array(Math.max(1, roll(m.count, rng))).fill(m.creature) as string[]);
  return {
    id: `b${state.nextId++}`,
    defId: def.id,
    name: def.name,
    sprite: def.sprite ?? CREATURES[members[0]].sprite,
    members,
    x,
    y,
    home: { x, y },
    mode: 'vandrar',
    budget: 0,
    ...(def.deathFlag ? { deathFlag: def.deathFlag } : {}),
  };
}

/** Magiskolorna som färdigheter (`magiskola:<skola>`). */
function magicSkills(def: CreatureDef): Record<string, number> {
  return Object.fromEntries(Object.entries(def.magic?.schools ?? {}).map(([k, v]) => [`magiskola:${k}`, v as number]));
}

const slugName = (n: string) => n.toLowerCase().replace(/[^a-zåäö]+/g, '_');

/**
 * Spelmotorn. Äger hela speltillståndet och alla regler; känner inte till grafik eller gränssnitt.
 * Gränssnittet anropar metoderna och lyssnar på ändringar. Striden ligger i combat.ts.
 */
export class Game {
  /** Kartan som gruppen är på. Den byts med enterMap (världskartan, mötesplatser och stridskartor). */
  map: GameMap;
  visible = new Set<number>();
  private listeners: (() => void)[] = [];
  private mapListeners: (() => void)[] = [];
  private fxListeners: ((fx: Fx) => void)[] = [];
  private cueListeners: ((c: Cue) => void)[] = [];

  constructor(
    public state: GameState,
    public rng: Rng = Math.random,
  ) {
    this.map = parseMap(MAPS[state.mapId]);
    // Den som bär en tänd fackla utan brinntid (nytt spel, äldre sparning) tänder en ur packningen.
    for (const id of state.party) {
      const a = state.actors.find((x) => x.id === id);
      if (a) ensureLight(this, a);
    }
    syncItemEffects(this);
    this.updateFov();
  }

  /** Ny rollperson: börjar i modulens första karta (som standard speltestmodulen Gråvad). */
  static create(char: Character, rng: Rng = Math.random, moduleId = 'speltest'): Game {
    const mod = MODULES[moduleId];
    const mapId = mod.start;
    const map = parseMap(MAPS[mapId]);
    const player = actorFromCharacter(char, 'player', map.start.x, map.start.y);
    const state: GameState = {
      version: 7,
      moduleId,
      completed: [],
      places: {},
      moduleFlags: {},
      time: time.START_TIME,
      character: char,
      companions: {},
      party: [player.id],
      mapId,
      playerId: player.id,
      actors: [player],
      explored: new Array(map.w * map.h).fill(0),
      mode: 'explore',
      combat: null,
      flags: {},
      dropped: [],
      fearMet: [],
      trade: {},
      log: [],
      nextId: 1,
    };
    startWeather(state, mod.weather);
    spawnActors(state, map, rng);
    const game = new Game(state, rng);
    game.log(`${char.name} anländer till ${map.name}.`);
    return game;
  }

  // ---------------------------------------------------------------- händelser

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }
  onFx(fn: (fx: Fx) => void) {
    this.fxListeners.push(fn);
  }
  /** Ljudmodulen lyssnar på ljudsignalerna. */
  onCue(fn: (c: Cue) => void) {
    this.cueListeners.push(fn);
  }
  /** Skickar en ljudsignal. Ett fel hos en lyssnare får aldrig stoppa motorn. */
  cue(c: Cue) {
    for (const fn of this.cueListeners) {
      try {
        fn(c);
      } catch {
        // Ljudet är inte viktigare än spelet.
      }
    }
  }
  /** Gränssnittet bygger om kartvyn och minikartan när gruppen byter karta. */
  onMapChange(fn: () => void) {
    this.mapListeners.push(fn);
  }

  /**
   * Byter karta inom modulen: in på en mötesplats, ut på världskartan, till en stridskarta och
   * tillbaka. Kartan som lämnas sparas (utom stridskartor).
   */
  enterMap(mapId: string, at?: Point) {
    swapMap(this.state, mapId, this.rng, at);
    this.map = parseMap(MAPS[mapId]);
    this.updateFov();
    for (const fn of this.mapListeners) fn();
  }
  changed() {
    worldmap.battleOverHint(this);
    // Uppdrag och dåd som just blev klara ger bonus-EP och hjältepoäng (steg 8).
    hero.grantRewards(this);
    // Magiska föremål som verkar ständigt när de bärs.
    syncItemEffects(this);
    for (const fn of this.listeners) fn();
  }
  emit(actorId: string, text: string, kind: Fx['kind']) {
    for (const fn of this.fxListeners) fn({ actorId, text, kind });
  }
  log(text: string) {
    this.state.log.push(text);
    if (this.state.log.length > LOG_LIMIT) this.state.log.splice(0, this.state.log.length - LOG_LIMIT);
  }

  // ---------------------------------------------------------------- uppslag

  /** Huvudpersonen, den som spelaren skapade. Dör hen är äventyret slut. */
  get leader(): Actor {
    return this.actor(this.state.playerId)!;
  }

  /**
   * Gruppmedlemmen som spelaren styr och ser i panelerna: i strid den vars tur det är,
   * annars den som valts (som standard huvudpersonen).
   */
  get player(): Actor {
    const f = this.state.focus ? this.actor(this.state.focus) : undefined;
    return f && f.alive && f.kind === 'player' ? f : this.leader;
  }

  /** Rollformuläret för den som styrs (för en elementar: magikerns). */
  get char(): Character {
    const p = this.player;
    return this.charOf(p) ?? (p.elemental ? this.charOf(this.actor(p.elemental.caster)!) : undefined) ?? this.state.character;
  }

  /** Rollformuläret för en rollperson eller följeslagare, eller undefined för andra figurer. */
  charOf(a: Actor | undefined): Character | undefined {
    if (!a) return undefined;
    if (a.id === this.state.playerId) return this.state.character;
    return this.state.companions[a.id];
  }

  /** Gruppens levande medlemmar (rollpersonen och följeslagarna, inte elementarer). */
  partyMembers(): Actor[] {
    return this.state.party.map((id) => this.actor(id)!).filter((a) => a && a.alive);
  }

  /** Väljer vem som visas och styrs utanför strid. */
  setFocus(id: string) {
    const a = this.actor(id);
    if (!a || !a.alive || a.kind !== 'player' || this.state.mode === 'combat') return;
    this.state.focus = id;
    this.changed();
  }

  actor(id: string): Actor | undefined {
    return this.state.actors.find((a) => a.id === id);
  }
  actorAt(x: number, y: number): Actor | undefined {
    return this.state.actors.find((a) => a.alive && a.x === x && a.y === y);
  }
  isVisible(x: number, y: number): boolean {
    return this.visible.has(idx(this.map, x, y));
  }
  /** Står någon på rutan, eller stänger en låst dörr eller en kista vägen? */
  private occupied = (x: number, y: number) => !!this.actorAt(x, y) || lockBlocks(this, x, y) || !!this.bandAt(x, y);
  /** Fiendegruppen på en ruta på världskartan. */
  bandAt(x: number, y: number): BandState | undefined {
    return this.state.bands?.find((b) => b.x === x && b.y === y);
  }
  blocked(x: number, y: number): boolean {
    return this.occupied(x, y);
  }
  /**
   * Som `occupied`, men gruppens egna (rollpersoner, följeslagare och elementarer) stänger
   * inte vägen för den som går: man går igenom varandra genom att byta plats (husregel, Vidar).
   */
  private blockedFor = (who: Actor) => (x: number, y: number) => {
    const a = this.actorAt(x, y);
    if (a && !(a.kind === 'player' && who.kind === 'player' && a.id !== who.id)) return true;
    return lockBlocks(this, x, y) || !!this.bandAt(x, y);
  };
  /** Byter plats med en kamrat på rutan `to`, om det står någon där. */
  private swapWith(who: Actor, to: Point) {
    const a = this.actorAt(to.x, to.y);
    if (!a || a.id === who.id) return;
    combat.face(a, who.x, who.y);
    a.x = who.x;
    a.y = who.y;
  }

  /** Väg för den som går (ledaren utanför strid) till en ruta, eller till en ruta intill om `adjacentOk`. */
  pathTo(x: number, y: number, adjacentOk = false): Point[] | null {
    const who = this.state.mode === 'combat' ? this.player : this.leader;
    if (this.map.kind === 'värld') return worldmap.travelPath(this, { x, y }, adjacentOk);
    return findPath(this.map, who, { x, y }, this.blockedFor(who), adjacentOk, (px, py) => passable(this, who, px, py));
  }

  /** Rutor som den som har turen kan nå med sin återstående förflyttning i strid. */
  reachableTiles(): Point[] {
    if (!this.isPlayerTurn()) return [];
    const p = this.player;
    return reachable(this.map, p, this.state.combat!.movesLeft, this.blockedFor(p), (x, y) => passable(this, p, x, y));
  }

  /** Gruppen ser tillsammans: synfälten för alla som är vid medvetande läggs ihop. */
  updateFov() {
    this.visible = new Set();
    const eyes = this.state.actors.filter((a) => a.alive && a.kind === 'player' && (!a.unconscious || a.id === this.state.playerId));
    // På världskartan är en ruta en kvarts väg, och synhållet beror på dagsljuset.
    const radius = this.map.kind === 'värld' ? worldmap.partySight(this) : FOV_RADIUS;
    for (const a of eyes) for (const i of computeFov(this.map, a.x, a.y, radius)) this.visible.add(i);
    for (const i of this.visible) this.state.explored[i] = 1;
  }

  canSee(a: Actor, b: Actor): boolean {
    // DIMMA: ingen ser längre än 10 rutor in i eller ut ur dimman.
    return distance(a.x, a.y, b.x, b.y) <= a.sight && lineOfSight(this.map, a.x, a.y, b.x, b.y) && !fogBlocks(this, a, b);
  }

  // ---------------------------------------------------------------- utforskning

  /**
   * Flyttar ledaren ett steg under utforskning, och följeslagarna går efter i ett led. Varje steg
   * räknas som en stridsrunda. De som smyger slår Smyga när en fiende kan se dem.
   */
  stepPlayer(to: Point): boolean {
    if (this.state.mode !== 'explore') return false;
    // Världskartan: en ruta är en kvart, och gruppen går som en figur.
    if (this.map.kind === 'värld') return worldmap.travelStep(this, to);
    const p = this.leader;
    if (!combat.canAct(p) || distance(p.x, p.y, to.x, to.y) !== 1 || this.blockedFor(p)(to.x, to.y)) return false;
    const members = this.partyMembers();
    const before = members.map((m) => ({ x: m.x, y: m.y }));
    combat.face(p, to.x, to.y);
    this.swapWith(p, to);
    p.x = to.x;
    p.y = to.y;
    this.cue({ type: 'steg', actorId: p.id });
    // Följeslagarna går i ledarens spår. Den som inte kan gå bärs av de andra (tolkning).
    for (let i = 1; i < members.length; i++) {
      const m = members[i];
      const goal = before[i - 1];
      if (distance(m.x, m.y, goal.x, goal.y) > 1) {
        const path = findPath(this.map, m, goal, this.occupied, true);
        if (path?.length) {
          combat.face(m, path[0].x, path[0].y);
          m.x = path[0].x;
          m.y = path[0].y;
        }
      } else if (!this.occupied(goal.x, goal.y)) {
        combat.face(m, goal.x, goal.y);
        m.x = goal.x;
        m.y = goal.y;
      }
    }
    // Djur och personer som magin styr (TILLKALLA VARELSE, KONTROLLERA) går efter gruppen.
    for (const f of this.state.actors.filter((a) => a.alive && a.effects.some((e) => e.kind === 'kontrollerad' && e.by && this.state.party.includes(e.by)))) {
      const last = members[members.length - 1];
      if (distance(f.x, f.y, last.x, last.y) <= 1) continue;
      const path = findPath(this.map, f, last, this.occupied, true);
      if (path?.length) {
        combat.face(f, path[0].x, path[0].y);
        f.x = path[0].x;
        f.y = path[0].y;
      }
    }
    this.updateFov();
    wardCheck(this);
    for (const m of members) combat.pickUp(this, m);
    for (const m of members) combat.tick(this, m);
    time.advanceTime(this, 5, 'aktiv');
    if (this.state.mode === 'explore') {
      stealth.sneakRound(this);
      this.checkAmbush();
    }
    this.changed();
    // En utgång till en annan karta i modulen tas direkt. En utgång ur modulen: gränssnittet
    // frågar om gruppen vill lämna äventyret.
    const exit = this.state.mode === 'explore' ? this.exitHere() : undefined;
    if (exit?.to) worldmap.takeExit(this, exit);
    else if (exit) this.openUi('exit');
    return true;
  }

  /** Anfaller en fiendegrupp intill på världskartan: ett stridsmöte börjar. */
  attackBand(id: string): boolean {
    return worldmap.attackBand(this, id);
  }

  /** Utgången som ledaren står på, om någon. */
  exitHere(): { x: number; y: number; name: string; to?: string } | undefined {
    const p = this.leader;
    return this.map.exits.find((e) => e.x === p.x && e.y === p.y);
  }

  /** Fiender som ser någon i gruppen som inte är dold. */
  private hostilesAware(): Actor[] {
    const seen = this.state.actors.filter((a) => a.alive && a.kind === 'player' && !a.hidden);
    return this.state.actors.filter((a) => a.alive && a.hostile && !a.fled && seen.some((m) => this.canSee(a, m) && !hero.spares(this, a, m)));
  }

  private checkAmbush() {
    const aware = this.hostilesAware();
    if (aware.length) combat.startCombat(this, aware);
  }

  // ---------------------------------------------------------------- strid

  /** Startar en strid med de fiender rollpersonen ser (knappen "Till strid"). */
  startCombat(): boolean {
    if (this.state.mode !== 'explore') return false;
    const seen = this.state.actors.filter((a) => a.alive && a.hostile && !a.fled && this.isVisible(a.x, a.y));
    if (!seen.length) {
      this.log('Det finns inga fiender i sikte.');
      this.changed();
      return false;
    }
    combat.startCombat(this, seen);
    this.changed();
    return true;
  }

  /**
   * Spelaren styr turen: den som agerar hör till gruppen (rollpersonen, en följeslagare eller en
   * elementar) och är inte medvetslös, paralyserad, på flykt eller i bärsärkagång.
   */
  isPlayerTurn(): boolean {
    const c = this.state.combat;
    if (this.state.mode !== 'combat' || !c) return false;
    const a = this.actor(c.order[c.turn]);
    if (!a || a.kind !== 'player' || a.id !== this.player.id) return false;
    return combat.canAct(a) && !combat.hasEffect(a, 'flyr') && !combat.hasEffect(a, 'bärsärk');
  }

  /** Flyttar rollpersonen ett steg i strid. Föremål på marken plockas upp om handlingen finns kvar. */
  combatStep(to: Point): boolean {
    if (!this.isPlayerTurn()) return false;
    const c = this.state.combat!;
    const p = this.player;
    if (c.movesLeft <= 0 || distance(p.x, p.y, to.x, to.y) !== 1 || this.blockedFor(p)(to.x, to.y)) return false;
    combat.face(p, to.x, to.y);
    this.swapWith(p, to);
    p.x = to.x;
    p.y = to.y;
    c.movesLeft--;
    p.movedLast = (p.movedLast ?? 0) + 1;
    this.cue({ type: 'steg', actorId: p.id });
    wardCheck(this);
    this.updateFov();
    if (!c.acted[p.id] && this.state.dropped.some((d) => d.x === p.x && d.y === p.y) && combat.pickUp(this)) {
      c.acted[p.id] = true;
      c.movesLeft = 0;
    }
    this.changed();
    return true;
  }

  /** Rollpersonen har ett avståndsvapen i handen. */
  holdsRanged(): boolean {
    return !!combat.rangedInfo(this.player);
  }

  /** Varför rollpersonen inte kan anfalla målet just nu, eller null. */
  attackProblem(targetId: string): string | null {
    const t = this.actor(targetId);
    const p = this.player;
    if (!this.isPlayerTurn()) return 'Det är inte din tur.';
    if (this.state.combat!.acted[p.id]) return 'Du har redan gjort din handling.';
    if (!t || !t.alive || !t.hostile) return 'Inget fientligt mål.';
    if (this.holdsRanged()) return combat.shootProblem(this, p, t);
    const mode = this.state.combat!.attackMode;
    if (mode && mode !== 'vanligt') return maneuvers.maneuverProblem(this, p, t, mode);
    if (!combat.canAttackNow(p)) return 'Du kan inte anfalla nu.';
    return combat.inReach(this, p, t) ? null : 'Målet är utom räckhåll.';
  }

  canAttack(targetId: string): boolean {
    return this.attackProblem(targetId) === null;
  }

  /** Anfaller i närstrid, eller skjuter och kastar med ett avståndsvapen. */
  playerAttack(targetId: string): boolean {
    if (!this.canAttack(targetId)) return false;
    const t = this.actor(targetId)!;
    const mode = this.state.combat!.attackMode;
    if (this.holdsRanged()) combat.shoot(this, this.player, t);
    else if (mode && mode !== 'vanligt') maneuvers.maneuver(this, this.player, t, mode);
    else combat.playerAttack(this, t);
    if (this.state.combat) {
      this.state.combat.acted[this.player.id] = true;
      if (this.holdsRanged()) this.state.combat.movesLeft = 0;
    }
    combat.finishTurn(this);
    this.changed();
    return true;
  }

  /** Laddar om armborstet eller stavslungan en runda (tar hela turen). */
  canReload(): boolean {
    return this.isPlayerTurn() && !this.state.combat!.acted[this.player.id] && (this.player.reload ?? 0) > 0;
  }

  reload(): boolean {
    if (!this.canReload()) return false;
    combat.reloadStep(this, this.player);
    this.state.combat!.acted[this.player.id] = true;
    combat.finishTurn(this);
    this.changed();
    return true;
  }

  /** Söker skydd mot skyttar (Normalt SMI-slag) och gör inget annat i rundan. */
  canTakeCover(): boolean {
    return this.isPlayerTurn() && !this.state.combat!.acted[this.player.id] && combat.participants(this).some((a) => a.hostile && !!a.ranged && !combat.isOut(a));
  }

  takeCover(): boolean {
    if (!this.canTakeCover()) return false;
    combat.takeCover(this, this.player);
    this.state.combat!.acted[this.player.id] = true;
    combat.finishTurn(this);
    this.changed();
    return true;
  }

  /** Väljer en kroppsdel att sikta på (−5 på CL), eller null för slumpvis träff. */
  setAim(loc: HitLocation | null) {
    if (this.state.combat) this.state.combat.aim = loc;
    this.changed();
  }

  /** Väljer hur nästa anfall görs: vanligt, Avväpna, Fasthållning eller en stridskonstteknik. */
  setAttackMode(mode: string) {
    if (this.state.combat) this.state.combat.attackMode = mode;
    this.changed();
  }

  /** Fint tillsammans med nästa anfall (stridskonsttekniken Fint). */
  setFeint(on: boolean) {
    if (this.state.combat) this.state.combat.feint = on;
    this.changed();
  }

  /** Släpper taget om den som hålls fast. */
  releaseHold() {
    maneuvers.release(this, this.player);
    this.changed();
  }

  /** Fallteknik: rulla iväg upp till 5 rutor. */
  rollAway(): string | null {
    const r = maneuvers.roll5(this, this.player);
    if (r) this.log(r);
    this.changed();
    return r;
  }

  // ---------------------------------------------------------------- smyga, facklor och kamrater

  /** Slår på eller av smygarläget för den som styrs. */
  toggleSneak(): string | null {
    const r = stealth.toggleSneak(this, this.player);
    if (r) this.log(r);
    this.changed();
    return r;
  }

  /** Tänder eller släcker facklan för den som styrs. */
  toggleTorch() {
    const r = toggleLight(this, this.player);
    if (r) this.log(r);
    this.changed();
  }

  /** Vad den som styrs kan göra för en kamrat just nu. */
  helpOptions(): maneuvers.HelpOption[] {
    return maneuvers.helpOptions(this, this.player);
  }

  /** Hjälper en kamrat: förband, häva kvävning, resa upp, ge en ört eller Läkekonst. */
  help(kind: maneuvers.HelpKind, targetId: string, arg?: number): string | null {
    const r = maneuvers.help(this, this.player, kind, targetId, arg);
    if (r) this.log(r);
    this.changed();
    return r;
  }

  /** Värvar en person som vill följa med. */
  recruit(npcId: string): string {
    return party.recruit(this, npcId);
  }

  /** Låter en följeslagare gå hem. */
  dismiss(id: string) {
    party.dismiss(this, id, 'avskedad');
    this.changed();
  }

  // ---------------------------------------------------------------- elementarer

  /** Elementarens särskilda handlingar på dess tur. */
  elementalActions(): elementals.ElementalAction[] {
    return elementals.actions(this, this.player);
  }

  elementalAct(action: string, targetId?: string): string | null {
    const r = elementals.act(this, this.player, action, targetId);
    if (r) this.log(r);
    this.changed();
    return r;
  }

  endTurn(): boolean {
    if (!this.isPlayerTurn()) return false;
    combat.finishTurn(this);
    this.changed();
    return true;
  }

  /** Lägger förband på en blödande kroppsdel (Första hjälpen). I strid tar det hela handlingen. */
  canBandage(): boolean {
    const p = this.player;
    if (!p.bleeding.length || !combat.canAct(p) || p.down || p.kp <= 1) return false;
    if (!(['vänster arm', 'höger arm'] as HitLocation[]).every((a) => combat.limbUsable(p, a))) return false;
    if (this.state.mode === 'combat') return this.isPlayerTurn() && !this.state.combat!.acted[p.id];
    return this.state.mode === 'explore';
  }

  bandage(): boolean {
    if (!this.canBandage()) return false;
    const p = this.player;
    maneuvers.bandageOnce(this, p, p);
    if (this.state.mode === 'combat') {
      this.state.combat!.acted[p.id] = true;
      combat.finishTurn(this);
    } else combat.tick(this, p);
    this.changed();
    return true;
  }

  /** Fel som kräver en hel runda att rätta till (t.ex. trasiga kläder efter en fummel). */
  canFix(): boolean {
    return this.isPlayerTurn() && !this.state.combat!.acted[this.player.id] && this.player.effects.some((e) => e.untilFixed);
  }

  fix(): boolean {
    if (!this.canFix()) return false;
    const p = this.player;
    p.effects = p.effects.filter((e) => !e.untilFixed);
    this.log(`${p.name} lägger rundan på att rätta till utrustningen.`);
    this.state.combat!.acted[p.id] = true;
    combat.finishTurn(this);
    this.changed();
    return true;
  }

  /** Utför en tur som rollpersonen inte styr: en varelse, eller rollpersonen under skräck. */
  enemyTurn(): boolean {
    const c = this.state.combat;
    if (this.state.mode !== 'combat' || !c || this.isPlayerTurn()) return false;
    combat.autoTurn(this);
    this.changed();
    return true;
  }

  /** Vapnet som aktören för: namn, skada, färdighet och räckvidd. */
  weaponOf(a: Actor, slot: 'weapon' | 'offhand' = 'weapon') {
    return combat.weaponInfo(a, slot);
  }

  /**
   * FV med en färdighet. Vapengrupper ger minst halva FV (avrundat uppåt) från bästa grupp
   * av samma slag (husregel, se docs/regelbeslut.md).
   */
  skillFv(a: Actor, skill: string): number {
    return combat.skillFvOf(a, skill);
  }

  /** Erfarenhetspoäng för en lyckad användning (se time.ts). */
  gainExperience(a: Actor, skill: string, check: Check) {
    time.gainExperience(this, a, skill, check);
  }

  /** Avdraget på alla färdighetsslag för kroppsdelar på 0 KP. */
  woundPenaltyOf(a: Actor): number {
    return combat.woundPenalty(a);
  }

  die(a: Actor) {
    combat.kill(this, a);
  }

  private uiListeners: ((name: UiView, arg?: string) => void)[] = [];
  onUi(fn: (name: UiView, arg?: string) => void) {
    this.uiListeners.push(fn);
  }
  /** Ber gränssnittet öppna en vy (träningen efter en veckas vila, eller en handlares bod). */
  openUi(name: UiView, arg?: string) {
    for (const fn of this.uiListeners) fn(name, arg);
  }

  /** Absorbering på en kroppsdel: rustningsdelen som täcker den plus naturligt skydd. */
  armorAt(a: Actor, loc: HitLocation): number {
    return a.naturalArmor + (combat.armorPiece(a, loc)?.abs ?? 0) + combat.magicArmor(a);
  }

  /** Tar på en rustningsdel och tar av de delar som täcker samma kroppsdelar. */
  equipArmor(id: string) {
    const p = this.player;
    const covers = new Set(ARMOR[id].covers);
    const off = p.armor.filter((a) => ARMOR[a].covers.some((c) => covers.has(c)));
    for (const a of off) delete p.bv[a];
    p.armor = [...p.armor.filter((a) => !off.includes(a)), id];
    p.bv[id] = combat.armorBv(id);
    this.char.equipped.armor = [...p.armor];
    if (!this.char.inventory.includes(id)) this.char.inventory.push(id);
  }

  // ---------------------------------------------------------------- övrigt

  /** Gör en person fientlig och inleder strid. */
  provoke(actorId: string) {
    const a = this.actor(actorId);
    if (!a || !a.alive) return;
    a.hostile = true;
    a.kind = 'monster';
    combat.startCombat(this, [a]);
    this.changed();
  }

  /** Färdighetsslag för rollpersonen, med logg och erfarenhetskryss. */
  playerCheck(skill: string, modifier = 0): Check {
    const p = this.player;
    const check = hero.heroic(this, p, skillCheck(this.skillFv(p, skill), this.rng, modifier + combat.skillMod(this, p, skill)));
    combat.consumeSkillEffects(p, skill);
    this.gainExperience(p, skill, check);
    this.log(`${skill} (${describe(check)}): ${check.result}.`);
    return check;
  }

  /** Turgubbe eller Tjuvtur: ett tryck till köper +1 på nästa slag, och efter taket stängs den av. */
  cycleLuck(source: talents.LuckSource) {
    talents.cycleLuck(this, this.player, source);
    this.changed();
  }

  /** God kroppskontroll: +5 STY i tre rundor efter ett Normalt FYS-slag. */
  bodyControl(): string | null {
    const r = talents.bodyControl(this, this.player);
    if (r) this.log(r);
    this.changed();
    return r;
  }

  /** Bardens Förtrollande framträdande eller munkens Meditation: +5 i en timme. */
  perform(skill?: string): string | null {
    const r = talents.perform(this, this.player, skill);
    if (r) this.log(r);
    this.changed();
    return r;
  }

  /** Kan ledaren tala med figuren? Personer, och djur som inte är fientliga med TALA MED VARELSE. */
  canTalk(a: Actor): boolean {
    // Ett djur kan inte tala med människor.
    if (this.leader.shape) return false;
    if (a.kind === 'npc') return true;
    return !a.hostile && hero.isCommonAnimal(this, a) && this.leader.effects.some((e) => e.kind === 'talaMed');
  }

  /** LEVITATION och FLYGA: den som svävar landar på sin ruta (eller närmaste lediga ruta). */
  land(): string | null {
    const p = this.player;
    const air = p.effects.filter((e) => e.kind === 'svävar');
    if (!air.length) return 'Du svävar inte.';
    for (const e of air) combat.endSpellEffect(this, p, e);
    this.log(`${p.name} landar.`);
    this.changed();
    return null;
  }

  /** Hamnbytare: förvandlas till djuret, eller tillbaka till människa. */
  shapeshift(): string | null {
    const r = shapeshiftActor(this, this.player);
    if (r) this.log(r);
    this.changed();
    return r;
  }

  /** Laddar (eller avbryter) en hjältepoäng för nästa egna slag hos den som styrs. */
  toggleHero() {
    hero.toggleHero(this, this.player);
    this.changed();
  }

  /** Sover ett antal timmar (som standard en natt). */
  sleep(hours = 8, how: 'sömn' | 'läger' = 'sömn') {
    this.cue({ type: 'vila', how });
    time.advanceTime(this, hours * HOUR, 'sömn');
    this.changed();
  }

  /** Kan gruppen vila här? Inte med fiender i sikte. */
  canRest(): boolean {
    return (
      this.state.mode === 'explore' &&
      combat.canAct(this.leader) &&
      !this.state.actors.some((a) => a.alive && a.hostile && !a.fled && this.isVisible(a.x, a.y)) &&
      !(this.state.bands ?? []).some((b) => b.mode === 'jagar' || this.isVisible(b.x, b.y))
    );
  }

  /** Vilar en vecka (sju nätter). Därefter kan EP växlas in mot FV och fobier mildras. */
  restWeek() {
    time.advanceTime(this, 7 * DAY, 'sömn');
    time.easePhobias(this);
    this.changed();
  }

  /** Läkekonst på sig själv, en gång per dag. */
  canSelfMedicine(): boolean {
    const p = this.player;
    return this.state.mode === 'explore' && combat.canAct(p) && p.skills.lakekonst !== undefined && time.canMedicine(this, p);
  }

  selfMedicine() {
    if (!this.canSelfMedicine()) return;
    time.medicine(this, this.player, this.player);
    this.changed();
  }

  /** Läker KP i totala KP och fördelar samma mängd på de mest skadade kroppsdelarna. */
  heal(amount: number, p: Actor = this.player) {
    // Läkning (HELA, läkeörter) stabiliserar en döende först (husregel, steg 8).
    if (amount > 0 && p.dying) combat.stabilize(this, p, 'av läkningen');
    const before = p.kp;
    p.kp = Math.min(p.maxKp, p.kp + amount);
    let left = p.kp - before;
    while (left > 0) {
      const worst = HIT_LOCATIONS.filter((l) => p.locKp[l] < p.locMax[l]).sort((a, b) => p.locKp[a] - p.locMax[a] - (p.locKp[b] - p.locMax[b]))[0];
      if (!worst) break;
      p.locKp[worst]++;
      if (p.locKp[worst] > 0 && !p.injuries.some((i) => i.loc === worst && i.lost)) p.disabled = p.disabled.filter((l) => l !== worst);
      left--;
    }
    if (p.kp > 1 && !(['bröstkorg', 'mage'] as HitLocation[]).some((l) => p.locKp[l] <= 0)) p.down = false;
    this.emit(p.id, `+${p.kp - before}`, 'heal');
  }
}
