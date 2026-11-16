import { ARMORS, CREATURES, MAPS, PROFESSIONS, WEAPONS } from '../content';
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
import { damageBonus, improvementRoll, maxKp, RULES, skillCheck, type Check } from './rules';
import type { Actor, CombatState, GameState, NewCharacter } from './types';

export const FOV_RADIUS = 8;
const LOG_LIMIT = 200;

/** Visuell effekt som gränssnittet kan visa (t.ex. skadesiffror). */
export interface Fx {
  actorId: string;
  text: string;
  kind: 'damage' | 'miss' | 'heal' | 'info';
}

const describe = (c: Check) => `T20: ${c.roll} mot ${c.target}`;

/**
 * Spelmotorn. Äger hela speltillståndet och alla regler; känner inte till grafik eller gränssnitt.
 * Gränssnittet anropar metoderna och lyssnar på ändringar.
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

  static create(char: NewCharacter, rng: Rng = Math.random, mapId = 'gravad'): Game {
    const map = parseMap(MAPS[mapId]);
    const prof = PROFESSIONS[char.profession];
    const kp = maxKp(char.attrs);
    const player: Actor = {
      id: 'player',
      defId: 'player',
      name: char.name,
      kind: 'player',
      sprite: prof.sprite,
      x: map.start.x,
      y: map.start.y,
      attrs: { ...char.attrs },
      kp,
      maxKp: kp,
      skills: { ...prof.skills },
      marks: [],
      weapon: prof.weapon,
      armor: prof.armor,
      shield: !!prof.shield,
      move: RULES.baseMove,
      hostile: false,
      sight: FOV_RADIUS,
      alive: true,
      silver: roll(prof.silver, rng),
      profession: prof.id,
      stunned: false,
    };
    const state: GameState = {
      version: 1,
      mapId,
      playerId: player.id,
      actors: [player],
      explored: new Array(map.w * map.h).fill(0),
      mode: 'explore',
      combat: null,
      flags: {},
      log: [],
      nextId: 1,
    };
    for (const s of map.spawns) {
      const def = CREATURES[s.creature];
      const hp = def.kp ?? maxKp(def.attrs);
      state.actors.push({
        id: `a${state.nextId++}`,
        defId: def.id,
        name: def.name,
        kind: def.npc ? 'npc' : 'monster',
        sprite: def.sprite,
        x: s.x,
        y: s.y,
        attrs: { ...def.attrs },
        kp: hp,
        maxKp: hp,
        skills: { ...def.skills },
        marks: [],
        weapon: def.weapon,
        armor: def.armor,
        shield: !!def.shield,
        move: def.move,
        hostile: def.hostile,
        sight: def.sight ?? 6,
        alive: true,
        silver: def.silver ? roll(def.silver, rng) : 0,
        npc: def.npc,
        deathFlag: def.deathFlag,
        stunned: false,
      });
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
  private fx(actorId: string, text: string, kind: Fx['kind']) {
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

  private canSee(a: Actor, b: Actor): boolean {
    return distance(a.x, a.y, b.x, b.y) <= a.sight && lineOfSight(this.map, a.x, a.y, b.x, b.y);
  }

  // ---------------------------------------------------------------- utforskning

  /** Flyttar rollpersonen ett steg under utforskning. Returnerar false om steget inte gick. */
  stepPlayer(to: Point): boolean {
    if (this.state.mode !== 'explore') return false;
    const p = this.player;
    if (distance(p.x, p.y, to.x, to.y) !== 1 || this.occupied(to.x, to.y)) return false;
    p.x = to.x;
    p.y = to.y;
    this.updateFov();
    this.checkAmbush();
    this.changed();
    return true;
  }

  private hostilesAware(): Actor[] {
    return this.state.actors.filter((a) => a.alive && a.hostile && this.canSee(a, this.player));
  }

  private checkAmbush() {
    const aware = this.hostilesAware();
    if (aware.length) this.startCombat(aware);
  }

  // ---------------------------------------------------------------- strid

  startCombat(enemies: Actor[]) {
    const p = this.player;
    const order = [p, ...enemies]
      .map((a) => ({ a, tie: this.rng() }))
      .sort((l, r) => r.a.attrs.SMI - l.a.attrs.SMI || r.tie - l.tie)
      .map((e) => e.a.id);
    this.state.mode = 'combat';
    this.state.combat = { round: 1, order, turn: -1, movesLeft: 0, acted: {}, parrying: {}, shieldUsed: {} };
    const names = [...new Set(enemies.map((e) => e.name))].join(', ');
    this.log(`⚔ Strid! ${names} går till anfall.`);
    this.log(`— Runda 1 —`);
    this.nextTurn();
  }

  isPlayerTurn(): boolean {
    const c = this.state.combat;
    return this.state.mode === 'combat' && !!c && c.order[c.turn] === this.state.playerId;
  }

  private nextTurn() {
    const c = this.state.combat!;
    for (;;) {
      c.turn++;
      if (c.turn >= c.order.length) {
        if (!this.newRound(c)) return;
        continue;
      }
      const a = this.actor(c.order[c.turn])!;
      if (!a.alive) continue;
      c.movesLeft = a.move;
      if (a.stunned) {
        a.stunned = false;
        c.acted[a.id] = true;
        this.log(`${a.name} återfår balansen och förlorar sin handling.`);
      }
      return;
    }
  }

  /** Startar en ny runda. Returnerar false om striden tog slut. */
  private newRound(c: CombatState): boolean {
    const p = this.player;
    const enemies = this.state.actors.filter(
      (a) => a.alive && a.hostile && (this.canSee(a, p) || (c.order.includes(a.id) && distance(a.x, a.y, p.x, p.y) <= 10)),
    );
    if (!enemies.length) {
      this.endCombat('Striden är över.');
      return false;
    }
    for (const e of enemies) {
      if (!c.order.includes(e.id)) {
        c.order.push(e.id);
        this.log(`${e.name} ansluter till striden!`);
      }
    }
    c.order = c.order.filter((id) => this.actor(id)!.alive && (id === p.id || enemies.some((e) => e.id === id)));
    c.round++;
    c.turn = -1;
    c.acted = {};
    c.parrying = {};
    c.shieldUsed = {};
    this.log(`— Runda ${c.round} —`);
    return true;
  }

  private endCombat(message: string) {
    this.state.combat = null;
    this.state.mode = 'explore';
    this.log(message);
  }

  /** Flyttar rollpersonen ett steg i strid. */
  combatStep(to: Point): boolean {
    if (!this.isPlayerTurn()) return false;
    const c = this.state.combat!;
    const p = this.player;
    if (c.movesLeft <= 0 || distance(p.x, p.y, to.x, to.y) !== 1 || this.occupied(to.x, to.y)) return false;
    p.x = to.x;
    p.y = to.y;
    c.movesLeft--;
    this.updateFov();
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
      distance(p.x, p.y, t.x, t.y) <= 1
    );
  }

  playerAttack(targetId: string): boolean {
    if (!this.canAttack(targetId)) return false;
    this.resolveAttack(this.player, this.actor(targetId)!);
    this.finishTurn();
    return true;
  }

  /** Rollpersonen avstår sitt anfall för att parera nästa träff. */
  playerParry(): boolean {
    if (!this.isPlayerTurn() || this.state.combat!.acted[this.player.id]) return false;
    this.state.combat!.parrying[this.player.id] = true;
    this.log(`${this.player.name} höjer garden och gör sig redo att parera.`);
    this.finishTurn();
    return true;
  }

  endTurn(): boolean {
    if (!this.isPlayerTurn()) return false;
    this.finishTurn();
    return true;
  }

  private finishTurn() {
    const c = this.state.combat;
    if (this.state.mode === 'combat' && c) {
      c.acted[c.order[c.turn]] = true;
      this.nextTurn();
    }
    this.changed();
  }

  /** Utför en fiendes hela tur. Anropas av gränssnittet tills det är rollpersonens tur igen. */
  enemyTurn(): boolean {
    const c = this.state.combat;
    if (this.state.mode !== 'combat' || !c || this.isPlayerTurn()) return false;
    const a = this.actor(c.order[c.turn])!;
    const p = this.player;
    const path = findPath(this.map, a, p, (x, y) => this.occupied(x, y), true);
    if (path) {
      for (const step of path) {
        if (c.movesLeft <= 0 || distance(a.x, a.y, p.x, p.y) <= 1) break;
        a.x = step.x;
        a.y = step.y;
        c.movesLeft--;
      }
    }
    if (!c.acted[a.id] && distance(a.x, a.y, p.x, p.y) <= 1) this.resolveAttack(a, p);
    this.finishTurn();
    return true;
  }

  private weaponSkill(a: Actor): number {
    return a.skills[WEAPONS[a.weapon].skill] ?? Math.ceil(a.attrs.SMI / 2);
  }

  private mark(a: Actor, skill: string) {
    if (a.kind === 'player' && a.skills[skill] !== undefined && !a.marks.includes(skill)) a.marks.push(skill);
  }

  private resolveAttack(att: Actor, def: Actor) {
    const c = this.state.combat!;
    const weapon = WEAPONS[att.weapon];
    const check = skillCheck(this.weaponSkill(att), this.rng);
    const head = `${att.name} anfaller ${def.name} med ${weapon.name.toLowerCase()} (${describe(check)})`;

    if (check.result === 'fummel') {
      att.stunned = true;
      this.log(`${head}: fummel! ${att.name} tappar balansen.`);
      this.fx(att.id, 'Fummel!', 'miss');
      return;
    }
    if (!check.success) {
      this.log(`${head}: miss.`);
      this.fx(def.id, 'Miss', 'miss');
      return;
    }
    this.mark(att, weapon.skill);

    // Parering: med vapnet om försvararen valt att parera, annars med sköld (en gång per runda).
    // Ett perfekt anfall går inte att parera.
    let failedParry = '';
    if (check.result !== 'perfekt' && !def.stunned) {
      let parrySkill: string | null = null;
      if (c.parrying[def.id]) {
        parrySkill = WEAPONS[def.weapon].skill;
        c.parrying[def.id] = false;
      } else if (def.shield && !c.shieldUsed[def.id]) {
        parrySkill = 'Sköld';
        c.shieldUsed[def.id] = true;
      }
      if (parrySkill) {
        const fv = def.skills[parrySkill] ?? Math.ceil(def.attrs.SMI / 2);
        const parry = skillCheck(fv, this.rng);
        if (parry.success) {
          this.mark(def, parrySkill);
          this.log(`${head}: träff, men ${def.name} parerar (${describe(parry)}).`);
          this.fx(def.id, 'Parerat', 'miss');
          return;
        }
        failedParry = ` ${def.name} misslyckas med pareringen (${describe(parry)}).`;
      }
    }

    let dmg = roll(weapon.damage, this.rng);
    if (weapon.useDamageBonus) dmg += roll(damageBonus(att.attrs), this.rng);
    const abs = check.result === 'perfekt' ? 0 : def.armor ? ARMORS[def.armor].abs : 0;
    dmg = Math.max(0, dmg - abs);
    def.kp -= dmg;
    const perfect = check.result === 'perfekt' ? ' Perfekt slag – rustningen hjälper inte!' : '';
    this.log(
      dmg > 0
        ? `${head}: träff för ${dmg} i skada${abs ? ` (rustningen tar ${abs})` : ''}.${perfect}${failedParry}`
        : `${head}: träff, men rustningen tar hela smällen.${failedParry}`,
    );
    this.fx(def.id, dmg > 0 ? `-${dmg}` : '0', 'damage');
    if (def.kp <= 0) this.kill(def, att);
  }

  private kill(victim: Actor, killer: Actor) {
    victim.alive = false;
    victim.kp = 0;
    if (victim.kind === 'player') {
      this.state.mode = 'dead';
      this.state.combat = null;
      this.log(`☠ ${victim.name} faller till marken. Äventyret är slut.`);
      return;
    }
    this.log(`${victim.name} dör.`);
    if (victim.deathFlag) this.state.flags[victim.deathFlag] = true;
    if (victim.silver > 0 && killer.kind === 'player') {
      killer.silver += victim.silver;
      this.log(`Du hittar ${victim.silver} silvermynt.`);
    }
    if (!this.state.actors.some((a) => a.alive && a.hostile && this.state.combat?.order.includes(a.id))) {
      this.endCombat('Striden är vunnen!');
    }
  }

  // ---------------------------------------------------------------- övrigt

  /** Gör en person fientlig och inleder strid. */
  provoke(actorId: string) {
    const a = this.actor(actorId);
    if (!a || !a.alive) return;
    a.hostile = true;
    a.kind = 'monster';
    this.startCombat([a]);
    this.changed();
  }

  /** Färdighetsslag för rollpersonen, med logg och erfarenhetskryss. */
  playerCheck(skill: string, modifier = 0): Check {
    const p = this.player;
    const check = skillCheck(p.skills[skill] ?? 5, this.rng, modifier);
    if (check.success) this.mark(p, skill);
    this.log(`${skill} (${describe(check)}): ${check.result}.`);
    return check;
  }

  /** Vila: full läkning och förbättringsslag för alla färdigheter med erfarenhetskryss. */
  rest(): string[] {
    const p = this.player;
    p.kp = p.maxKp;
    const improved: string[] = [];
    for (const skill of p.marks) {
      if (improvementRoll(p.skills[skill], this.rng)) {
        p.skills[skill]++;
        improved.push(`${skill} ${p.skills[skill]}`);
      }
    }
    p.marks = [];
    return improved;
  }

  heal(amount: number) {
    const p = this.player;
    const before = p.kp;
    p.kp = Math.min(p.maxKp, p.kp + amount);
    this.fx(p.id, `+${p.kp - before}`, 'heal');
  }
}
