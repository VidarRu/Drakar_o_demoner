/**
 * Besvärjelserna utanför strid (förslagets avsnitt 2b): ÖPPNA, FÖRSEGLA, FINNA VATTEN,
 * VARSEBLIVNING, VÄXTKUNSKAP, TRÄELD, LÅGA, SPÅRLÖS, VATTENANDNING, SYN, TALA MED VARELSE,
 * TANKEÖVERFÖRING, TELEPATI, TANKELÄSNING och TILLKALLA VARELSE. Tolkningarna står i
 * docs/regelbeslut.md under Besvärjelser utanför strid.
 */
import { MODULES, NPCS } from '../content';
import { HERBS, herbSkill } from '../data/herbs';
import type { SpellDef } from '../data/types';
import { roll } from './dice';
import type { Game } from './game';
import { isCommonAnimal } from './hero';
import { isLocked, lockTargets, magicOpen, magicSeal, type LockSpot } from './locks';
import { distance, tileAt, walkable } from './map';
import { commonFor, herbsHere, prepareDose } from './poison';
import { advanceTime } from './time';
import { holdWeather, raining, underSky, weatherOf, weatherText } from './weather';
import { WEATHER } from './rules';
import { wound as woundActor } from './combat';
import type { ActiveEffect, Actor, PendingSpell } from './types';

/** Riktningen från en ruta till en annan, i väderstreck (norr är uppåt på kartan). */
export function compass(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (!dx && !dy) return 'här';
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const names = ['norr', 'nordost', 'öster', 'sydost', 'söder', 'sydväst', 'väster', 'nordväst'];
  return names[(Math.round(deg / 45) + 8) % 8];
}

/** VÄXTKUNSKAP: så många doser hittar magikern (tolkning). */
const HERB_FIND = '1T4';

/** Avstånd i meter (en ruta är 1,5 meter). */
const meters = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.round(distance(a.x, a.y, b.x, b.y) * 1.5);

// ------------------------------------------------------------------ val i Magi-fönstret

/** Vad VARSEBLIVNING kan leta efter. */
export const SEEK_KINDS: Record<string, string> = {
  fiende: 'fientliga varelser',
  person: 'personer',
  djur: 'djur',
  utgång: 'utgångar',
  kista: 'kistor',
  föremål: 'föremål på marken',
};

/** Örterna som VÄXTKUNSKAP kan hitta: de som växer här. */
export function herbChoices(g: Game, _a?: Actor): string[] {
  return herbsHere(g).map((h) => h.id);
}

/** Personer som magikern känner till namnet och kan nå med TELEPATI: de som gruppen har talat med. */
export function telepathyTargets(g: Game): Actor[] {
  return g.state.actors.filter((a) => a.alive && a.npc && NPCS[a.npc] && a.npc in (g.state.met ?? {}));
}

// ------------------------------------------------------------------ hinder

/** Varför besvärjelsen utanför strid inte kan läggas, eller null. */
export function worldProblem(g: Game, caster: Actor, spell: SpellDef, o: { target?: string; at?: { x: number; y: number }; seek?: string; herb?: string; change?: 1 | -1; grade: number }): string | null {
  const e = spell.effect!;
  switch (e.kind) {
    case 'öppna':
    case 'försegla': {
      const l = o.at ? lockTargets(g, caster).find((x) => x.x === o.at!.x && x.y === o.at!.y) : undefined;
      if (!l) return 'Välj en dörr eller kista som du kan röra vid.';
      if (e.kind === 'försegla' && l.kind === 'dörr' && g.actorAt(l.x, l.y)) return 'Någon står i dörröppningen.';
      return null;
    }
    case 'finnaVatten':
      return raining(g) ? 'Det regnar, och FINNA VATTEN hittar inget i regnet.' : null;
    case 'varseblivning':
      return o.seek && SEEK_KINDS[o.seek] ? null : 'Välj vad du letar efter.';
    case 'växtkunskap':
      if (g.state.mode !== 'explore' || !g.canRest()) return 'Det går inte att leta örter med fiender i närheten.';
      return o.herb && herbChoices(g, caster).includes(o.herb) ? null : 'Välj en ört som växer här.';
    case 'tankar': {
      if (e.mode !== 'telepati') return null;
      const t = o.target ? g.actor(o.target) : undefined;
      return t && telepathyTargets(g).includes(t) ? null : 'Välj någon som du känner till namnet på.';
    }
    case 'tillkalla':
      return g.state.mode === 'combat' ? 'Djuren hinner inte fram mitt i en strid.' : null;
    case 'vindkontroll':
    case 'regnkontroll': {
      if (!underSky(g, caster)) return 'Det går bara under bar himmel.';
      if (weatherOf(g).locked) return 'Vädret här går inte att ändra.';
      if (o.change !== 1 && o.change !== -1) return 'Välj mer eller mindre.';
      if (e.kind === 'regnkontroll' && o.change === 1 && weatherOf(g).sky < 2) return 'Det finns inga moln som kan regna.';
      if (e.kind === 'regnkontroll' && o.change === -1 && !raining(g)) return 'Det regnar inte.';
      return null;
    }
    case 'viggfångare':
      if (!underSky(g, caster) || weatherOf(g).sky < 4) return 'Det krävs åska, under bar himmel.';
      return null;
    default:
      return null;
  }
}


// ------------------------------------------------------------------ verkan

/**
 * Verkan för besvärjelserna utanför strid. Returnerar false om besvärjelsen inte hör hit.
 * `effect` är de gemensamma fälten för effekten (etikett, varaktighet, besvärjelse och E).
 */
export function applyWorld(g: Game, caster: Actor, t: Actor, s: PendingSpell, spell: SpellDef, grade: number, effect: Pick<ActiveEffect, 'label' | 'spell' | 'grade' | 'persist' | 'rounds' | 'days'>, seconds: number, range: number): boolean {
  const e = spell.effect!;
  switch (e.kind) {
    case 'öppna':
    case 'försegla': {
      const l = s.at ? lockTargets(g, caster).find((x) => x.x === s.at!.x && x.y === s.at!.y) : undefined;
      if (!l) {
        g.log('Det finns ingen dörr eller kista där.');
        return true;
      }
      if (e.kind === 'öppna') magicOpen(g, l, grade);
      else magicSeal(g, l, grade, seconds);
      return true;
    }
    case 'finnaVatten': {
      // Räckvidden är den som står i regeldatan (S/4 rutor).
      const w = nearestTile(g, caster, range, (x, y) => tileAt(g.map, x, y).name === 'vatten');
      g.log(w ? `${caster.name} känner vatten ${meters(caster, w)} meter åt ${compass(caster, w)}.` : `${caster.name} känner inget vatten inom ${Math.round(range * 1.5)} meter.`);
      return true;
    }
    case 'varseblivning': {
      const found = seek(g, caster, s.seek ?? 'fiende', range).slice(0, grade);
      const what = SEEK_KINDS[s.seek ?? 'fiende'];
      g.log(
        found.length
          ? `${caster.name} förnimmer ${what}: ${found.map((f) => `${f.name} ${meters(caster, f)} m åt ${compass(caster, f)}`).join('; ')}.`
          : `${caster.name} förnimmer inga ${what} inom ${Math.round(range * 1.5)} meter.`,
      );
      return true;
    }
    case 'växtkunskap': {
      // Vidar: magikern hittar örten i närheten utan slag. Tolkning: det tar en timme och ger 1T4
      // doser, som bereds som vanligt med Drogkunskap eller Giftkunskap.
      const id = s.herb!;
      const h = HERBS[id];
      const ch = g.charOf(caster);
      const n = roll(HERB_FIND, g.rng);
      advanceTime(g, 3600, 'aktiv');
      const fv = g.skillFv(caster, herbSkill(h));
      for (let i = 0; i < n; i++) ch?.herbs.push(prepareDose(g, id, fv, commonFor(g, h)));
      g.log(`Magin leder ${caster.name} rakt till ${h.name.toLowerCase()}. På en timme hittar och bereder hen ${n} doser.`);
      return true;
    }
    case 'tända': {
      // Vidar: en kvist från marken tänds med magisk eld och brinner som en vanlig fackla.
      g.charOf(t)?.inventory.push('fackla');
      t.torchOut = false;
      if (e.glow) {
        t.effects = t.effects.filter((x) => x.kind !== 'ljus' || x.spell !== spell.id);
        t.effects.push({ ...effect, kind: 'ljus', mod: 1 });
      }
      g.log(`${t.name} plockar upp en kvist, och ${e.glow ? 'lågan från tummen' : 'magisk eld'} tänder den. Den brinner som en fackla.`);
      return true;
    }
    case 'spårlös':
      t.effects.push({ ...effect, kind: 'spårlös' });
      g.log(`${t.name} lämnar varken spår eller lukt efter sig.`);
      return true;
    case 'vattenandning':
      t.effects.push({ ...effect, kind: 'vattenandning' });
      g.log(`${t.name} kan andas under vatten och gå ut i sjöar och vattendrag.`);
      return true;
    case 'syn':
      // Vidar: SYN identifierar framför allt magiska föremål, och modulerna kan ge den scener.
      // Magiska föremål finns inte än, så utan en scen visar den ingenting.
      if (!s.scene) g.log(`${caster.name} ser ingenting särskilt. SYN identifierar magiska föremål när sådana finns.`);
      return true;
    case 'talaMed':
      caster.effects = caster.effects.filter((x) => x.kind !== 'talaMed');
      caster.effects.push({ ...effect, kind: 'talaMed', mod: grade });
      g.log(`${caster.name} kan tala med djur (FV ${grade} i deras språk). Gå fram till ett djur som inte är fientligt.`);
      return true;
    case 'tankar':
      return thoughts(g, caster, t, s, e.mode, effect);
    case 'tillkalla':
      summonAnimals(g, caster, grade, effect, seconds);
      return true;
    case 'vindkontroll': {
      // Tolkning av "E m/s": ett steg på vindmätaren per fyra E, minst ett. Det håller i S timmar.
      const w = weatherOf(g);
      const steps = Math.max(1, Math.floor(grade / WEATHER.windPerStep));
      holdWeather(g, w.sky, w.wind + steps * (s.change ?? 1), seconds);
      g.log(`Vinden lyder ${caster.name}: ${weatherText(weatherOf(g))}.`);
      return true;
    }
    case 'regnkontroll': {
      const w = weatherOf(g);
      holdWeather(g, s.change === 1 ? 3 : 2, w.wind, seconds);
      g.log(s.change === 1 ? 'Molnen öppnar sig och det börjar regna.' : 'Regnet upphör, och molnen hänger stilla.');
      return true;
    }
    case 'viggfångare': {
      // Tolkning: blixten gör 5T6. Hälften (nedåt) blir PSY, högst upp till grundvärdet, och resten
      // tar magikern i skada.
      const bolt = roll(WEATHER.lightning, g.rng);
      const psy = Math.min(Math.floor(bolt / 2), caster.attrs.PSY - caster.psy);
      caster.psy += psy;
      g.log(`En blixt slår ned i ${caster.name} (${bolt}): ${psy} blir PSY och ${bolt - psy} skadar.`);
      g.emit(caster.id, `+${psy} PSY`, 'heal');
      if (bolt - psy > 0) woundActor(g, caster, bolt - psy, null);
      return true;
    }
    default:
      return false;
  }
}

function nearestTile(g: Game, from: Actor, r: number, ok: (x: number, y: number) => boolean): { x: number; y: number } | null {
  let best: { x: number; y: number; d: number } | null = null;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = from.x + dx;
      const y = from.y + dy;
      if (x < 0 || y < 0 || x >= g.map.w || y >= g.map.h || !ok(x, y)) continue;
      // Närmast först, och vid lika avstånd den som ligger mest rakt fram.
      const d = distance(from.x, from.y, x, y) + Math.hypot(dx, dy) / 1000;
      if (!best || d < best.d) best = { x, y, d };
    }
  return best;
}

/** VARSEBLIVNING: det närmaste av det valda slaget inom räckvidden, närmast först. */
function seek(g: Game, a: Actor, kind: string, r: number): { name: string; x: number; y: number }[] {
  const near = (p: { x: number; y: number }) => distance(a.x, a.y, p.x, p.y) <= r;
  let out: { name: string; x: number; y: number }[] = [];
  const alive = g.state.actors.filter((x) => x.alive && !x.fled && x !== a && x.kind !== 'player' && near(x));
  if (kind === 'fiende') out = alive.filter((x) => x.hostile);
  if (kind === 'person') out = alive.filter((x) => x.detailed && !x.hostile);
  if (kind === 'djur') out = alive.filter((x) => isCommonAnimal(g, x));
  if (kind === 'utgång') out = g.map.exits.filter(near);
  if (kind === 'kista') out = g.map.locks.filter((l) => l.kind === 'kista' && near(l));
  if (kind === 'föremål') out = g.state.dropped.filter(near).map((d) => ({ name: d.item, x: d.x, y: d.y }));
  return [...out].sort((l, m) => distance(a.x, a.y, l.x, l.y) - distance(a.x, a.y, m.x, m.y));
}

/**
 * TANKEÖVERFÖRING och TELEPATI: ett tyst samtal med en person, TELEPATI på vilket avstånd som helst.
 * Med någon annan än en person förmedlas bara känslorna. TANKELÄSNING: i nästa samtal med personen
 * får AI-spelledaren avslöja vad den tänker, utan att den märker något.
 */
function thoughts(g: Game, caster: Actor, t: Actor, s: PendingSpell, mode: 'överföring' | 'telepati' | 'läsning', effect: Pick<ActiveEffect, 'label' | 'spell' | 'grade' | 'persist' | 'rounds' | 'days'>): boolean {
  const target = mode === 'telepati' && s.target ? g.actor(s.target) ?? t : t;
  if (mode === 'läsning') {
    if (!target.npc || !NPCS[target.npc]) {
      g.log(`${caster.name} läser ${target.name}s tankar: ${target.hostile ? 'fientliga och hungriga' : 'lugna och vaksamma'}.`);
      return true;
    }
    caster.effects = caster.effects.filter((x) => x.kind !== 'tankeläsning');
    caster.effects.push({ ...effect, kind: 'tankeläsning', by: target.npc });
    g.log(`${caster.name} läser ${target.name}s tankar utan att ${target.name} märker något. I samtalet framgår vad ${target.name} egentligen tänker.`);
    return true;
  }
  if (!target.npc || !NPCS[target.npc]) {
    g.log(`${caster.name} når ${target.name}s känslor: ${target.hostile ? 'vrede och hunger' : 'lugn och nyfikenhet'}.`);
    return true;
  }
  caster.effects = caster.effects.filter((x) => x.kind !== 'tankekontakt');
  caster.effects.push({ ...effect, kind: 'tankekontakt', by: target.npc });
  g.log(`${caster.name} når ${target.name} med tanken.`);
  if (g.state.mode === 'explore') g.openUi('talk', target.id);
  return true;
}

/**
 * TILLKALLA VARELSE: ointelligenta djur i trakten, närmast först och högst 20 STO per E, kommer
 * inom 1T10 minuter. De följer med och slåss för gruppen i S minuter eller tills nästa strid är slut
 * (tolkning).
 */
function summonAnimals(g: Game, caster: Actor, grade: number, effect: Pick<ActiveEffect, 'label' | 'spell' | 'grade' | 'persist' | 'rounds' | 'days'>, seconds: number) {
  const animals = g.state.actors
    .filter((a) => a.alive && !a.fled && isCommonAnimal(g, a) && !a.effects.some((e) => e.kind === 'kontrollerad'))
    .sort((l, r) => distance(caster.x, caster.y, l.x, l.y) - distance(caster.x, caster.y, r.x, r.y));
  const come: Actor[] = [];
  let sto = 0;
  for (const a of animals) {
    if (sto + a.attrs.STO > grade * 20) continue;
    sto += a.attrs.STO;
    come.push(a);
  }
  if (!come.length) {
    g.log('Inga djur i trakten hör kallelsen.');
    return;
  }
  const minutes = roll('1T10', g.rng);
  advanceTime(g, minutes * 60, 'vila');
  for (const a of come) {
    const spot = freeSquareNear(g, caster);
    if (spot) {
      a.x = spot.x;
      a.y = spot.y;
    }
    a.effects.push({ ...effect, kind: 'kontrollerad', by: caster.id, was: { hostile: a.hostile }, rounds: Math.ceil(seconds / 5), days: undefined, label: `Tillkallad av ${caster.name}`, summoned: true });
    a.hostile = false;
  }
  g.updateFov();
  g.log(`Efter ${minutes} minuter kommer ${come.map((a) => a.name.toLowerCase()).join(', ')} fram till ${caster.name} och följer med.`);
}

function freeSquareNear(g: Game, at: { x: number; y: number }): { x: number; y: number } | null {
  for (let r = 1; r <= 4; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = at.x + dx;
        const y = at.y + dy;
        if (walkable(g.map, x, y) && !g.blocked(x, y)) return { x, y };
      }
  return null;
}

/** Låsen som Magi-fönstret kan välja för ÖPPNA och FÖRSEGLA, med en kort text. */
export function lockChoices(g: Game, a: Actor): { spot: LockSpot; text: string }[] {
  return lockTargets(g, a).map((l) => ({ spot: l, text: `${l.name} (${compassText(a, l)}${isLocked(l) ? ', låst' : ''})` }));
}

const compassText = (a: Actor, l: { x: number; y: number }) => compass(a, l);

// ------------------------------------------------------------------ scener i modulerna

/**
 * Scener som besvärjelsen visar i modulen (`ModuleDef.spellScenes`): texten skrivs i loggen och
 * flaggan sätts. Returnerar hur många som visades.
 */
export function showScenes(g: Game, caster: Actor, spellId: string): number {
  const scenes = MODULES[g.state.moduleId]?.spellScenes ?? [];
  let n = 0;
  for (const sc of scenes) {
    if (!sc.spells.includes(spellId)) continue;
    if (sc.map && sc.map !== g.state.mapId) continue;
    if (sc.at && distance(caster.x, caster.y, sc.at.x, sc.at.y) > sc.at.r) continue;
    if (sc.ifFlag && !g.state.flags[sc.ifFlag]) continue;
    if (sc.unlessFlag && g.state.flags[sc.unlessFlag]) continue;
    if (sc.once && g.state.flags[`scen_${sc.id}`]) continue;
    g.state.flags[`scen_${sc.id}`] = true;
    if (sc.setFlag) g.state.flags[sc.setFlag] = true;
    g.log(sc.text);
    n++;
  }
  return n;
}
