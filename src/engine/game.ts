import { CREATURES, MAPS, PROFESSION_SPRITES } from '../content';
import { ABILITY_BY_ID } from '../data/abilities';
import { ARMOR } from '../data/armor';
import { RACES } from '../data/races';
import { SKILLS } from '../data/skills';
import * as combat from './combat';
import * as time from './time';
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
  INITIATIVE_MODS,
  locationKp,
  maxKp,
  movement,
  skillCheck,
  type Check,
  type HitLocation,
} from './rules';
import type { Actor, Attrs, Character, GameState } from './types';

export const FOV_RADIUS = 8;
const LOG_LIMIT = 300;

/** Visuell effekt som gränssnittet kan visa (t.ex. skadesiffror). */
export interface Fx {
  actorId: string;
  text: string;
  kind: 'damage' | 'miss' | 'heal' | 'info';
}

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

/**
 * Spelmotorn. Äger hela speltillståndet och alla regler; känner inte till grafik eller gränssnitt.
 * Gränssnittet anropar metoderna och lyssnar på ändringar. Striden ligger i combat.ts.
 */
export class Game {
  readonly map: GameMap;
  visible = new Set<number>();
  private listeners: (() => void)[] = [];
  private fxListeners: ((fx: Fx) => void)[] = [];

  constructor(
    public state: GameState,
    public rng: Rng = Math.random,
  ) {
    this.map = parseMap(MAPS[state.mapId]);
    this.updateFov();
  }

  static create(char: Character, rng: Rng = Math.random, mapId = 'gravad'): Game {
    const map = parseMap(MAPS[mapId]);
    const race = RACES[char.race];
    const ability = char.ability ? ABILITY_BY_ID[char.ability.id] : undefined;
    const player = makeActor(
      {
        id: 'player',
        defId: 'player',
        name: char.name,
        kind: 'player',
        sprite: PROFESSION_SPRITES[char.profession] ?? 'krigare',
        x: map.start.x,
        y: map.start.y,
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
        initiative:
          (char.profession === 'krigare' ? INITIATIVE_MODS.stridsvana : 0) +
          (ability?.passive?.initiative ?? 0) +
          (char.techniques.includes('initiativbonus') ? INITIATIVE_MODS.initiativbonus : 0),
        firstAlways: ability?.id === 'snabbslaende',
      },
    );
    const state: GameState = {
      version: 4,
      time: time.START_TIME,
      character: char,
      mapId,
      playerId: player.id,
      actors: [player],
      explored: new Array(map.w * map.h).fill(0),
      mode: 'explore',
      combat: null,
      flags: {},
      dropped: [],
      fearMet: [],
      log: [],
      nextId: 1,
    };
    for (const s of map.spawns) {
      const def = CREATURES[s.creature];
      state.actors.push(
        makeActor(
          {
            id: `a${state.nextId++}`,
            defId: def.id,
            name: def.name,
            kind: def.npc ? 'npc' : 'monster',
            sprite: def.sprite,
            x: s.x,
            y: s.y,
            attrs: { ...def.attrs },
            skills: { ...def.skills },
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
          { npc: def.npc, deathFlag: def.deathFlag, leader: def.leader, noMorale: def.noMorale, fear: def.fear },
        ),
      );
    }
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
  changed() {
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

  get player(): Actor {
    return this.actor(this.state.playerId)!;
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
  private occupied = (x: number, y: number) => !!this.actorAt(x, y);

  /** Väg för rollpersonen till en ruta, eller till en ruta intill om `adjacentOk`. */
  pathTo(x: number, y: number, adjacentOk = false): Point[] | null {
    return findPath(this.map, this.player, { x, y }, this.occupied, adjacentOk);
  }

  /** Rutor rollpersonen kan nå med sin återstående förflyttning i strid. */
  reachableTiles(): Point[] {
    if (!this.isPlayerTurn()) return [];
    return reachable(this.map, this.player, this.state.combat!.movesLeft, this.occupied);
  }

  private updateFov() {
    const p = this.player;
    this.visible = computeFov(this.map, p.x, p.y, FOV_RADIUS);
    for (const i of this.visible) this.state.explored[i] = 1;
  }

  canSee(a: Actor, b: Actor): boolean {
    return distance(a.x, a.y, b.x, b.y) <= a.sight && lineOfSight(this.map, a.x, a.y, b.x, b.y);
  }

  // ---------------------------------------------------------------- utforskning

  /** Flyttar rollpersonen ett steg under utforskning. Varje steg räknas som en stridsrunda. */
  stepPlayer(to: Point): boolean {
    if (this.state.mode !== 'explore') return false;
    const p = this.player;
    if (!combat.canAct(p) || distance(p.x, p.y, to.x, to.y) !== 1 || this.occupied(to.x, to.y)) return false;
    combat.face(p, to.x, to.y);
    p.x = to.x;
    p.y = to.y;
    this.updateFov();
    combat.pickUp(this);
    combat.tick(this, p);
    time.advanceTime(this, 5, 'aktiv');
    if (this.state.mode === 'explore') this.checkAmbush();
    this.changed();
    return true;
  }

  private hostilesAware(): Actor[] {
    return this.state.actors.filter((a) => a.alive && a.hostile && !a.fled && this.canSee(a, this.player));
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

  /** Rollpersonen styr sin tur själv (inte medvetslös, paralyserad, på flykt eller i bärsärkagång). */
  isPlayerTurn(): boolean {
    const c = this.state.combat;
    if (this.state.mode !== 'combat' || !c || c.order[c.turn] !== this.state.playerId) return false;
    const p = this.player;
    return combat.canAct(p) && !combat.hasEffect(p, 'flyr') && !combat.hasEffect(p, 'bärsärk');
  }

  /** Flyttar rollpersonen ett steg i strid. Föremål på marken plockas upp om handlingen finns kvar. */
  combatStep(to: Point): boolean {
    if (!this.isPlayerTurn()) return false;
    const c = this.state.combat!;
    const p = this.player;
    if (c.movesLeft <= 0 || distance(p.x, p.y, to.x, to.y) !== 1 || this.occupied(to.x, to.y)) return false;
    combat.face(p, to.x, to.y);
    p.x = to.x;
    p.y = to.y;
    c.movesLeft--;
    this.updateFov();
    if (!c.acted[p.id] && this.state.dropped.some((d) => d.x === p.x && d.y === p.y) && combat.pickUp(this)) {
      c.acted[p.id] = true;
      c.movesLeft = 0;
    }
    this.changed();
    return true;
  }

  canAttack(targetId: string): boolean {
    const t = this.actor(targetId);
    const p = this.player;
    return (
      this.isPlayerTurn() &&
      !this.state.combat!.acted[p.id] &&
      !!t &&
      t.alive &&
      t.hostile &&
      combat.canAttackNow(p) &&
      combat.inReach(this, p, t)
    );
  }

  playerAttack(targetId: string): boolean {
    if (!this.canAttack(targetId)) return false;
    combat.playerAttack(this, this.actor(targetId)!);
    this.state.combat && (this.state.combat.acted[this.player.id] = true);
    combat.finishTurn(this);
    this.changed();
    return true;
  }

  /** Väljer en kroppsdel att sikta på (−5 på CL), eller null för slumpvis träff. */
  setAim(loc: HitLocation | null) {
    if (this.state.combat) this.state.combat.aim = loc;
    this.changed();
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
    const loc = p.bleeding[0];
    const check = skillCheck(this.skillFv(p, 'forsta_hjalpen'), this.rng, combat.woundPenalty(p));
    if (check.success) {
      p.bleeding = p.bleeding.filter((l) => l !== loc);
      this.gainExperience(p, 'forsta_hjalpen', check);
      this.log(`${p.name} lägger förband på ${loc} (Första hjälpen, ${describe(check)}). Blödningen stannar.`);
    } else this.log(`${p.name} försöker lägga förband på ${loc} men misslyckas (Första hjälpen, ${describe(check)}).`);
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
    const own = a.skills[skill];
    const family = SKILLS[skill]?.weaponGroup;
    if (!family || family === 'sköld' || family === 'piska') return own ?? 0;
    let best = 0;
    for (const [id, fv] of Object.entries(a.skills)) if (SKILLS[id]?.weaponGroup === family) best = Math.max(best, fv);
    return Math.max(own ?? 0, Math.ceil(best / 2));
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

  private uiListeners: ((name: 'training') => void)[] = [];
  onUi(fn: (name: 'training') => void) {
    this.uiListeners.push(fn);
  }
  /** Ber gränssnittet öppna en vy (t.ex. träningen efter en veckas vila). */
  openUi(name: 'training') {
    for (const fn of this.uiListeners) fn(name);
  }

  /** Absorbering på en kroppsdel: rustningsdelen som täcker den plus naturligt skydd. */
  armorAt(a: Actor, loc: HitLocation): number {
    return a.naturalArmor + (combat.armorPiece(a, loc)?.abs ?? 0);
  }

  /** Tar på en rustningsdel och tar av de delar som täcker samma kroppsdelar. */
  equipArmor(id: string) {
    const p = this.player;
    const covers = new Set(ARMOR[id].covers);
    const off = p.armor.filter((a) => ARMOR[a].covers.some((c) => covers.has(c)));
    for (const a of off) delete p.bv[a];
    p.armor = [...p.armor.filter((a) => !off.includes(a)), id];
    p.bv[id] = combat.armorBv(id);
    this.state.character.equipped.armor = [...p.armor];
    if (!this.state.character.inventory.includes(id)) this.state.character.inventory.push(id);
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
    const check = skillCheck(this.skillFv(p, skill), this.rng, modifier + combat.woundPenalty(p));
    this.gainExperience(p, skill, check);
    this.log(`${skill} (${describe(check)}): ${check.result}.`);
    return check;
  }

  /** Sover ett antal timmar (som standard en natt). */
  sleep(hours = 8) {
    time.advanceTime(this, hours * HOUR, 'sömn');
    this.changed();
  }

  /** Kan rollpersonen vila här? Inte med fiender i sikte. */
  canRest(): boolean {
    return this.state.mode === 'explore' && combat.canAct(this.player) && !this.state.actors.some((a) => a.alive && a.hostile && !a.fled && this.isVisible(a.x, a.y));
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
  heal(amount: number) {
    const p = this.player;
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
