import { underSky, weatherOf, weatherText } from '../engine/weather';
import { lightText } from '../engine/light';
import { shapeOf, shapeProblem } from '../engine/shapeshift';
import { channel, channelProblem, mediumChoices } from '../engine/channel';
import { HAMN } from '../engine/rules';
import { forceLock, forceProblem, isLocked, locksNear, lootChest, lootProblem, pickLock, pickProblem, sealedAt } from '../engine/locks';
import { dialogDef, requestTurn, scriptedTurn, type DialogEntry } from '../ai/dialogClient';
import { actorHas, canArmHero, meet } from '../engine/hero';
import { skillName } from '../engine/creation';
import { bodyControlProblem, luckProblem, luckSources, performanceKind, performanceProblem, performanceSkills, thiefLuckLeft } from '../engine/talents';
import { ARMOR, SHIELDS } from '../data/armor';
import { PROFESSIONS } from '../data/professions';
import { RACES } from '../data/races';
import { HERBS } from '../data/herbs';
import { activeHostiles, ammoLeft, damageExpr, effectiveMove, hasEffect, isOut, martialOk, rangedInfo } from '../engine/combat';
import { elementalAttacks } from '../engine/elementals';
import { attackModes, passiveTechniques } from '../engine/maneuvers';
import { carriedWeight, loadMod } from '../engine/inventory';
import type { Game } from '../engine/game';
import { INTENTS } from '../engine/intents';
import { HIT_LOCATIONS, type HitLocation } from '../engine/rules';
import type { Actor } from '../engine/types';
import { clockText } from '../engine/time';
import { portraitUrl } from '../game/art';
import { bodyFigure } from './figure';
import { renderSheet } from './sheet';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function button(text: string, onClick: () => void, cls = '', disabled = false): HTMLButtonElement {
  const b = el('button', cls, text);
  b.onclick = onClick;
  b.disabled = disabled;
  return b;
}

/** Kopplar en snabbtangent till en knapp. Tangenten visas i knappens hörn. */
function hot<T extends HTMLButtonElement>(b: T, key: string, hint = key.toUpperCase()): T {
  b.dataset.key = key;
  b.dataset.hint = hint;
  return b;
}

const LOC_SHORT: Record<HitLocation, string> = {
  huvud: 'Huvud',
  bröstkorg: 'Bröst',
  mage: 'Mage',
  'vänster arm': 'V. arm',
  'höger arm': 'H. arm',
  'vänster ben': 'V. ben',
  'höger ben': 'H. ben',
};

/** Raden för avståndsvapnet i statuspanelen: räckvidd, laddning och ammunition. */
function ammoRow(g: Game, p: Actor, kv: (k: string, v: string) => HTMLElement): HTMLElement[] {
  const r = rangedInfo(p, g);
  if (!r) return [];
  const parts = [`${r.range} rutor`];
  if (r.ammo) parts.push(`${ammoLeft(g, p, r)} ${r.ammo.item}`);
  if (p.reload) parts.push(`laddar ${p.reload} SR`);
  return [kv(`${r.name} (${g.skillFv(p, r.skill)})`, `${r.damage} · ${parts.join(' · ')}`)];
}

/** Statuspanel, rollformulär, logg och stridspanel. */
export class Hud {
  private logCount = -1;
  /** Färdigheten som munken senast valde att meditera inför. */
  private performanceSkill?: string;

  constructor(
    private g: Game,
    private open: { pack: () => void; magic: () => void; quests: () => void } = { pack: () => {}, magic: () => {}, quests: () => {} },
  ) {
    $('hud').hidden = false;
    $('btn-sheet').onclick = () => $('status').classList.toggle('open');
    $('rf-close').onclick = () => this.toggleSheet(false);
    $('rollformular').onclick = (e) => {
      if (e.target === $('rollformular')) this.toggleSheet(false);
    };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.toggleSheet(false);
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (!$('panel').hidden || !$('dialog').hidden) return;
      if (!$('modal').hidden || this.g.state.mode === 'ended') return;
      if (e.key === 'r' || e.key === 'R') this.toggleSheet($('rollformular').hidden);
      if (e.key === 'u' || e.key === 'U') this.open.quests();
      if (this.g.player.elemental) return;
      if (e.key === 'p' || e.key === 'P') this.open.pack();
      if ((e.key === 'm' || e.key === 'M') && this.g.char.spells.length) this.open.magic();
      if (e.key === 'i' || e.key === 'I') $('status').classList.toggle('open');
      // Snabbtangenterna på knapparna i panelen (se hot()).
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key === ' ' ? 'space' : e.key.toLowerCase();
      const b = document.querySelector<HTMLButtonElement>(`#combat button[data-key="${k}"]:not(:disabled)`);
      if (b) {
        e.preventDefault();
        b.click();
      }
    });
    g.onChange(() => this.render());
    this.render();
  }

  private toggleSheet(open: boolean) {
    $('rollformular').hidden = !open;
    if (open) this.renderFullSheet();
  }

  render() {
    this.renderParty();
    this.renderStatus();
    this.renderLog();
    this.renderActions();
    if (!$('rollformular').hidden) this.renderFullSheet();
    $('dead').hidden = this.g.state.mode !== 'dead';
  }

  private renderFullSheet() {
    if (this.g.player.elemental) {
      $('rf-content').replaceChildren(el('p', 'note', 'En elementar har inget rollformulär. Välj en rollperson i gruppen.'));
      return;
    }
    $('rf-content').replaceChildren(renderSheet(this.g));
  }

  /** Gruppen: ett kort per rollperson, följeslagare och elementar. Klicka för att visa och styra. */
  private renderParty() {
    const g = this.g;
    const box = $('party');
    const members = [...g.partyMembers(), ...g.state.actors.filter((a) => a.alive && a.elemental)];
    box.hidden = members.length < (document.body.classList.contains('iso') ? 1 : 2) || g.state.mode === 'dialog' || g.state.mode === 'dead' || g.state.mode === 'ended';
    if (box.hidden) return;
    box.replaceChildren(
      ...members.map((m) => {
        const card = el('div', `member${m === g.player ? ' focus' : ''}${isOut(m) ? ' out' : ''}`);
        card.title = g.state.mode === 'combat' ? m.name : `Visa ${m.name}`;
        const img = el('img');
        img.src = portraitUrl(m.sprite);
        const text = el('div');
        const kp = el('span', 'kp');
        const fill = el('i');
        fill.style.width = `${Math.max(0, (100 * m.kp) / m.maxKp)}%`;
        kp.append(fill);
        const tags = [m.sneaking ? 'smyger' : '', m.dying ? `döende ${m.kp} KP` : m.unconscious ? 'medvetslös' : '', m.elemental ? `${m.elemental.rounds} SR` : ''].filter(Boolean).join(', ');
        text.append(el('b', '', m.name), kp);
        if (tags) text.append(el('span', 'tag', tags));
        card.append(img, text);
        card.onclick = () => g.setFocus(m.id);
        if (m.companion && g.state.mode === 'explore') {
          const pay = m.companion.pay === 'dagslön' ? `${m.companion.wage} sm/dag` : m.companion.pay === 'andel' ? 'del av bytet' : 'gratis';
          const bye = el('button', 'dismiss', '✕');
          bye.title = `Låt ${m.name} gå hem`;
          bye.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Låta ${m.name} gå hem? (${pay})`)) g.dismiss(m.id);
          };
          card.append(bye);
        }
        return card;
      }),
    );
  }

  /** Den lilla panelen: KP per kroppsdel, vapen, rustning och tillstånd. */
  private renderStatus() {
    const g = this.g;
    const p = g.player;
    const box = $('status');
    box.replaceChildren();
    if (p.elemental) {
      this.renderElementalStatus(box, p);
      return;
    }
    const ch = g.char;

    const who = el('div', 'who');
    const img = el('img');
    img.src = portraitUrl(p.sprite);
    const names = el('div');
    names.append(el('h2', '', p.name), el('small', '', `${RACES[ch.race].name}, ${PROFESSIONS[ch.profession].name.toLowerCase()}`));
    who.append(img, names);

    const bar = el('div', 'bar');
    const fill = el('i');
    fill.style.width = `${Math.max(0, (100 * p.kp) / p.maxKp)}%`;
    bar.append(fill, el('span', '', `KP ${p.kp} / ${p.maxKp}`));

    const doll = el('div', 'doll');
    const locs = el('div', 'locs');
    for (const loc of HIT_LOCATIONS) {
      const row = el('div', `loc${p.locKp[loc] <= 0 ? ' hurt' : p.locKp[loc] < p.locMax[loc] ? ' scratched' : ''}`);
      const abs = g.armorAt(p, loc);
      row.append(el('span', '', LOC_SHORT[loc]), el('b', '', `${p.locKp[loc]}/${p.locMax[loc]}`), el('small', '', abs ? `abs ${abs}` : ''));
      if (p.bleeding.includes(loc)) row.append(el('em', 'bleed', '●'));
      locs.append(row);
    }
    doll.append(bodyFigure(p), locs);

    const kv = (key: string, value: string) => {
      const row = el('div', 'kv');
      row.append(el('span', '', key), el('b', '', value));
      return row;
    };
    const gear: HTMLElement[] = [];
    for (const slot of ['weapon', 'offhand'] as const) {
      if (slot === 'offhand' && !p.offhand) continue;
      if (slot === 'weapon' && rangedInfo(p)) continue;
      const w = g.weaponOf(p, slot);
      const bv = w.bvKey && p.bv[w.bvKey] !== undefined ? ` · BV ${p.bv[w.bvKey]}` : '';
      gear.push(kv(`${w.name} (${g.skillFv(p, w.skill)})`, `${damageExpr(p, w)}${bv}`));
    }
    if (p.shield) gear.push(kv(`${SHIELDS[p.shield].name} (${g.skillFv(p, 'skoldar')})`, `BV ${p.bv.shield ?? 0}`));
    for (const id of p.armor) {
      const broken = (p.bv[id] ?? 1) <= 0;
      gear.push(kv(ARMOR[id].name, broken ? 'sönder' : `abs ${ARMOR[id].abs} · BV ${p.bv[id]}`));
    }

    const states: string[] = [];
    if (p.sneaking) states.push(p.hidden ? 'Smyger oupptäckt' : 'Smyger');
    if (p.torchOut) states.push('Facklan är släckt');
    if (p.companion) states.push(p.companion.pay === 'dagslön' ? `Följer med för ${p.companion.wage} silver om dagen` : p.companion.pay === 'andel' ? 'Följer med för en del av bytet' : 'Följer med utan betalning');
    const passive = passiveTechniques(p);
    if (passive.length) states.push(`Stridskonst: ${passive.join(', ')}`);
    if (p.dying) states.push(`Döende: förlorar 1 KP per runda och dör vid −${p.attrs.FYS} KP`);
    else if (p.unconscious) states.push('Medvetslös');
    if (p.down) states.push('Utslagen – kan bara krypa');
    if (p.kp === 2) states.push('2 KP: halverad CL');
    if (p.kp === 1) states.push('1 KP: kan inte använda färdigheter, halv förflyttning');
    if (p.bleeding.length) states.push(`Blöder: ${p.bleeding.join(', ')}`);
    for (const label of new Set(p.effects.map((e) => e.label))) states.push(label);
    for (const inj of p.injuries) states.push(`${inj.loc}: ${inj.text}`);
    for (const ph of ch.phobias ?? []) states.push(`Fobi (${ph.level}): ${ph.source}`);
    for (const po of p.poisons ?? []) states.push(`Förgiftad: ${HERBS[po.herb]?.name ?? po.herb} (STY ${po.sty})`);

    box.append(
      who,
      bar,
      doll,
      el('h3', '', 'Utrustning'),
      ...gear,
      ...ammoRow(g, p, kv),
      kv('Förflyttning', `${effectiveMove(p, g)} rutor`),
      kv('Börda', `${carriedWeight(g)} / ${p.attrs.STY} kg${loadMod(g, p) ? ` (${loadMod(g, p) ?? 'för tungt'})` : ''}`),
      kv('PSY-poäng', `${p.psy} / ${p.attrs.PSY}`),
      ...(ch.heroTotal ? [kv('Hjältepoäng', String(ch.heroPoints ?? 0))] : []),
      kv('Silvermynt', String(p.silver)),
      kv('Tid', clockText(g.state.time)),
      kv('Väder', underSky(g, p) ? weatherText(weatherOf(g)) : 'inomhus'),
      kv('Ljus', lightText(g, p)),
      ...(states.length ? [el('h3', '', 'Tillstånd'), ...states.map((s) => el('p', 'state', s))] : []),
      button('Rollformulär (R)', () => this.toggleSheet(true), 'primary sheet-btn'),
    );
  }

  /** Statuspanelen för en elementar: grundegenskaper, grad och hur länge den finns kvar. */
  private renderElementalStatus(box: HTMLElement, e: Actor) {
    const g = this.g;
    const info = e.elemental!;
    const who = el('div', 'who');
    const img = el('img');
    img.src = portraitUrl(e.sprite);
    const names = el('div');
    names.append(el('h2', '', e.name), el('small', '', `Styrs av ${g.actor(info.caster)?.name ?? 'magikern'}`));
    who.append(img, names);
    const bar = el('div', 'bar');
    const fill = el('i');
    fill.style.width = `${Math.max(0, (100 * e.kp) / e.maxKp)}%`;
    bar.append(fill, el('span', '', `KP ${e.kp} / ${e.maxKp}`));
    const kv = (key: string, value: string) => {
      const row = el('div', 'kv');
      row.append(el('span', '', key), el('b', '', value));
      return row;
    };
    const w = g.weaponOf(e);
    box.append(
      who,
      bar,
      kv('STO och STY', String(e.attrs.STO)),
      kv('PSY', String(e.attrs.PSY)),
      kv('SMI', String(e.attrs.SMI)),
      kv('Grad', `E${info.grade}`),
      kv('Finns kvar', `${info.rounds} SR`),
      kv('Förflyttning', `${effectiveMove(e, g)} rutor`),
      ...(elementalAttacks(e) ? [kv(`${w.name} (CL ${e.skills.elementar})`, w.damage)] : []),
    );
  }

  private renderLog() {
    const log = this.g.state.log;
    if (log.length === this.logCount) return;
    this.logCount = log.length;
    const box = $('log');
    box.replaceChildren(...log.slice(-80).map((line) => el('p', line.startsWith('—') ? 'round' : '', line)));
    box.scrollTop = box.scrollHeight;
  }

  /** Stridspanelen med turordning och handlingar, eller knapparna under utforskning. */
  private renderActions() {
    const { g } = this;
    const c = g.state.combat;
    const p = g.player;
    const panel = $('combat');
    panel.replaceChildren();
    if (g.state.mode === 'dialog' || g.state.mode === 'dead' || g.state.mode === 'ended') {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    if (g.state.mode !== 'combat' || !c) {
      const hostiles = g.state.actors.some((a) => a.alive && a.hostile && !a.fled && g.isVisible(a.x, a.y));
      panel.append(hot(button('⚔ Till strid', () => g.startCombat(), 'danger', !hostiles), 'b'));
      if (p.bleeding.length) panel.append(hot(button('Lägg förband', () => g.bandage(), '', !g.canBandage()), 'l'));
      if (g.canSelfMedicine()) panel.append(button('Läkekonst', () => g.selfMedicine()));
      for (const h of g.helpOptions()) panel.append(button(h.label, () => g.help(h.kind, h.target)));
      panel.append(this.sneakButton(), this.torchButton());
      if (g.charOf(p)?.heroPoints || p.heroArmed) panel.append(this.heroButton());
      panel.append(...this.talentControls());
      panel.append(...this.lockControls());
      panel.append(hot(button('Sov 8 timmar', () => g.sleep(8), '', !g.canRest()), 'v'));
      panel.append(button('Packning (P)', () => this.open.pack()));
      panel.append(button('Uppdrag (U)', () => this.open.quests()));
      if (g.char.spells.length) panel.append(button('Magi (M)', () => this.open.magic()));
      panel.classList.remove('fighting');
      return;
    }
    panel.classList.add('fighting');

    const order = el('div', 'order');
    c.order.forEach((id, i) => {
      const a = g.actor(id);
      if (!a || (!a.hostile && a.kind !== 'player')) return;
      const chip = el('span', `chip${i === c.turn ? ' now' : ''}${isOut(a) ? ' out' : ''}${a.kind === 'player' ? ' me' : ''}`);
      if (a.hidden) chip.title = 'Smyger oupptäckt';
      chip.append(el('b', '', String(c.initiative[id] ?? '')), document.createTextNode(` ${a.name}`));
      order.append(chip);
    });

    const mine = g.isPlayerTurn();
    const acted = !!c.acted[p.id];
    const current = g.actor(c.order[c.turn]);
    const holding = hasEffect(p, 'håller');
    const info = el(
      'span',
      'info',
      mine
        ? `Runda ${c.round} · ${p.name}s tur · ${c.movesLeft} steg kvar${holding ? ' · håller fast' : acted ? ' · handlingen är gjord' : g.holdsRanged() ? ' · stå still och klicka på en fiende för att skjuta' : ' · klicka på en fiende för att anfalla'}`
        : `Runda ${c.round} · ${current?.name ?? 'Fienden'} agerar…`,
    );
    if (mine && p.elemental) {
      panel.append(order, this.elementalControls(info));
      return;
    }

    const aim = el('select');
    aim.title = 'Sikta på en kroppsdel ger −5 på anfallet';
    aim.append(new Option('Slumpvis träff', ''));
    for (const loc of HIT_LOCATIONS) aim.append(new Option(`Sikta: ${loc} (−5)`, loc, false, c.aim === loc));
    aim.onchange = () => g.setAim((aim.value || null) as HitLocation | null);
    aim.disabled = !mine;

    const controls = el('div', 'controls');
    controls.append(info, aim);
    const modes = attackModes(g, p);
    if (modes.length > 1 && !g.holdsRanged()) {
      const mode = el('select');
      mode.title = 'Hur nästa anfall görs';
      for (const m of modes) {
        const o = new Option(m.name, m.id, false, (c.attackMode ?? 'vanligt') === m.id);
        o.title = m.desc;
        mode.append(o);
      }
      mode.onchange = () => g.setAttackMode(mode.value);
      mode.disabled = !mine || acted;
      controls.append(mode);
    }
    if (p.techniques?.includes('fint') && !g.holdsRanged()) {
      const lab = el('label', 'check');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = !!c.feint;
      box.disabled = !mine;
      box.onchange = () => g.setFeint(box.checked);
      lab.append(box, document.createTextNode('Fint'));
      lab.title = 'Lyckas finten (Stridskonster) halveras motståndarens parering';
      controls.append(lab);
    }
    if (holding) controls.append(button('Släpp taget', () => g.releaseHold(), '', !mine));
    if (p.techniques?.includes('fallteknik') && martialOk(g, p)) controls.append(button('Rulla', () => g.rollAway(), '', !mine || acted || (p.movedLast ?? 0) > 0));
    for (const h of g.helpOptions()) controls.append(button(h.label, () => g.help(h.kind, h.target)));
    if (mine) controls.append(this.sneakButton(), this.torchButton());
    if (mine && (g.charOf(p)?.heroPoints || p.heroArmed)) controls.append(this.heroButton());
    if (mine) controls.append(...this.talentControls());
    if (p.bleeding.length) controls.append(hot(button('Lägg förband', () => g.bandage(), '', !g.canBandage()), 'l'));
    if (g.canFix()) controls.append(button('Rätta till', () => g.fix()));
    if ((p.reload ?? 0) > 0) controls.append(button(`Ladda om (${p.reload} SR)`, () => g.reload(), '', !g.canReload()));
    if (g.canTakeCover()) controls.append(button('Sök skydd', () => g.takeCover()));
    controls.append(button('Packning', () => this.open.pack(), '', !mine));
    if (g.char.spells.length) controls.append(button('Magi', () => this.open.magic(), '', !mine || acted));
    controls.append(hot(button('Avsluta tur', () => g.endTurn(), 'primary', !mine), 'space', '␣'));
    if (!activeHostiles(g).length) controls.append(el('span', 'info', 'Inga fiender kvar.'));
    panel.append(order, controls);
  }

  private sneakButton(): HTMLButtonElement {
    const p = this.g.player;
    const b = button(p.sneaking ? 'Sluta smyga' : 'Smyg', () => this.g.toggleSneak(), p.sneaking ? 'primary' : '');
    hot(b, 'g');
    b.title = 'Smyga (G): ett slag i Smyga varje runda som en fiende kan se dig. Tänd fackla i mörker −10, dagsljus nära fienden −5.';
    return b;
  }

  /** Förmågor som används på turen: Turgubbe, Tjuvtur, God kroppskontroll, framträdandet och Meditation. */
  private talentControls(): HTMLElement[] {
    const g = this.g;
    const p = g.player;
    const out: HTMLElement[] = [];
    for (const source of luckSources(g, p)) {
      const armed = p.luckArmed?.source === source ? p.luckArmed.n : 0;
      const name = source === 'turgubbe' ? 'Turgubbe' : 'Tjuvtur';
      const left = source === 'tjuvtur' ? ` · ${thiefLuckLeft(g, p)} kvar` : '';
      const b = button(armed ? `${name} +${armed} (${armed} PSY)` : `${name}${left}`, () => g.cycleLuck(source), armed ? 'primary hero' : 'hero', !armed && !!luckProblem(g, p, source, 1));
      b.title = `Köp +1 på CL för 1 PSY på nästa egna slag. Tryck igen för mer, högst +3. ${source === 'tjuvtur' ? 'Två gånger mellan varje sömn, fyra för alver.' : ''}`;
      out.push(b);
    }
    const hamn = p.shape ? p.shape.animal : shapeOf(g, p);
    if (hamn !== null) {
      const b = button(p.shape ? 'Bli människa igen' : `Byt hamn: ${HAMN[hamn].name}`, () => g.shapeshift(), 'hero', !!shapeProblem(g, p));
      b.title = 'Hamnbytare: förvandlingen tar en stridsrunda. För varje timme över ditt PSY-värde i djurhamn slår du ett Normalt PSY-slag; misslyckas det fastnar du för alltid.';
      out.push(b);
    }
    // Magisk kanalisering: koppla ihop sig med en villig person i gruppen.
    if ((p.skills.magisk_kanalisering ?? 0) > 0 && !p.shape) {
      const media = mediumChoices(g, p);
      if (media.length) {
        const pick = el('select');
        pick.title = 'Mediet';
        for (const m of media) pick.append(new Option(m.name, m.id));
        const b = button('Kanalisera', () => {
          const r = channel(g, p, g.actor(pick.value)!);
          if (r) g.log(r);
          g.changed();
        }, '', !!channelProblem(g, p, g.actor(pick.value)));
        b.title = 'Magisk kanalisering: ett lyckat slag kopplar ihop dig med en villig person intill, och sedan kan du använda personens PSY till dina besvärjelser (till nästa sömn).';
        out.push(pick, b);
      }
    }
    if (p.effects.some((e) => e.kind === 'svävar')) {
      const b = button('Landa', () => g.land());
      b.title = 'Avsluta LEVITATION eller FLYGA och sjunk till marken.';
      out.push(b);
    }
    if (actorHas(g, p, 'god_kroppskontroll')) {
      const b = button('Kroppskontroll', () => g.bodyControl(), '', !!bodyControlProblem(g, p));
      b.title = 'Normalt FYS-slag: +5 STY (och skadebonus) i tre rundor. Två gånger om dagen.';
      out.push(b);
    }
    const kind = performanceKind(g, p);
    if (kind === 'bard') {
      const skills = performanceSkills(p);
      const pick = el('select');
      pick.title = 'Sjunga eller spela';
      for (const k of skills) pick.append(new Option(skillName(k), k, false, k === this.performanceSkill));
      pick.onchange = () => (this.performanceSkill = pick.value);
      const b = button('Framträd', () => g.perform(pick.value || undefined), '', !!performanceProblem(g, p, pick.value || undefined));
      b.title = 'Förtrollande framträdande: en minuts sång eller spel och ett lyckat slag ger +5 på KAR-färdigheter i en timme. Inte i strid.';
      if (skills.length > 1) out.push(pick);
      out.push(b);
    } else if (kind === 'munk') {
      const b = button('Meditera', () => g.perform(), '', !!performanceProblem(g, p));
      b.title = 'Meditation: en minut och ett lyckat Normalt PSY-slag ger +5 på INT-färdigheter i en timme. Inte i strid.';
      out.push(b);
    }
    return out;
  }

  /** Låsta dörrar och kistor intill: dyrka upp, bryta upp och tömma en kista. */
  private lockControls(): HTMLElement[] {
    const g = this.g;
    const p = g.player;
    const out: HTMLElement[] = [];
    for (const l of locksNear(g, p)) {
      if (!l.def && !sealedAt(g, l.x, l.y)) continue;
      if (isLocked(l) && !sealedAt(g, l.x, l.y) && (p.skills.lasdyrkning ?? 0) > 0) {
        const why = pickProblem(g, p, l);
        const b = button(`Dyrka upp ${l.name}`, () => pickLock(g, p, l), '', !!why);
        b.title = why ?? 'Låsdyrkning: ett försök tar en minut, och differensvärdet nöter ned låsets svårighetsgrad.';
        out.push(b);
      }
      if (!forceProblem(g, p, l)) {
        const b = button(`Bryt upp ${l.name}`, () => forceLock(g, p, l));
        b.title = 'STY mot låsets svårighetsgrad (20 mer om den är förseglad). Ett försök tar en minut.';
        out.push(b);
      }
      if (!lootProblem(g, p, l)) out.push(button(`Öppna ${l.name}`, () => lootChest(g, p, l), 'primary'));
    }
    return out;
  }

  /** Hjältepoäng före slaget (Bok I): nästa egna slag blir ett steg bättre. */
  private heroButton(): HTMLButtonElement {
    const g = this.g;
    const p = g.player;
    const n = g.charOf(p)?.heroPoints ?? 0;
    const b = button(p.heroArmed ? `Hjältepoäng laddad (${n})` : `Hjältepoäng (${n})`, () => g.toggleHero(), p.heroArmed ? 'primary hero' : 'hero', !p.heroArmed && !canArmHero(g, p));
    b.title = 'Spendera en hjältepoäng på nästa egna slag: fummel blir misslyckat, misslyckat blir lyckat, lyckat blir perfekt. Ett perfekt slag ger tillbaka poängen.';
    return b;
  }

  private torchButton(): HTMLButtonElement {
    const p = this.g.player;
    const lantern = p.light?.kind === 'oljelykta';
    const b = button(p.torchOut ? (lantern ? 'Tänd lyktan' : 'Tänd en fackla') : lantern ? 'Släck lyktan' : 'Släck facklan', () => this.g.toggleTorch());
    hot(b, 't');
    b.title = 'Fackla (T): en fackla brinner en timme och en oljelykta sex timmar (fylls på med lampolja). Utan ljus syns du sämre i mörker, men du strider själv i mörker (−15) om du inte har mörkersyn.';
    return b;
  }

  /** Elementarens tur: flytta, anfalla (om den kan) och dess särskilda handlingar. */
  private elementalControls(info: HTMLElement): HTMLElement {
    const g = this.g;
    const controls = el('div', 'controls');
    controls.append(info);
    for (const a of g.elementalActions()) {
      if (!a.targets.length) {
        controls.append(button(a.label, () => g.elementalAct(a.id), a.id === 'släpp' ? 'danger' : ''));
        continue;
      }
      const pick = el('select');
      for (const id of a.targets) pick.append(new Option(g.actor(id)?.name ?? id, id));
      controls.append(pick, button(a.label, () => g.elementalAct(a.id, pick.value)));
    }
    controls.append(hot(button('Avsluta tur', () => g.endTurn(), 'primary'), 'space', '␣'));
    return controls;
  }
}

/** Samtalsrutan. Språkmodellen står för replikerna, spelmotorn för allt som har konsekvenser. */
export class DialogUi {
  private npc: Actor | null = null;
  private history: DialogEntry[] = [];
  private options: string[] = [];
  private ai = true;
  private waiting = false;

  constructor(private g: Game) {
    $<HTMLFormElement>('dialog-form').onsubmit = (e) => {
      e.preventDefault();
      const input = $<HTMLInputElement>('dialog-input');
      const text = input.value.trim();
      if (!text || this.waiting) return;
      input.value = '';
      void this.say(text);
    };
    // Sifferknapparna väljer dialogvalen (1 är det första), utom när man skriver i textfältet.
    document.addEventListener('keydown', (e) => {
      if ($('dialog').hidden || this.waiting || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = /^[1-9]$/.test(e.key) ? Number(e.key) : e.code.startsWith('Numpad') ? Number(e.code.slice(6)) : NaN;
      if (!(n >= 1 && n <= 9)) return;
      const b = $('dialog-options').querySelectorAll('button')[n - 1];
      if (!b) return;
      e.preventDefault();
      b.click();
    });
  }

  async open(npc: Actor) {
    this.npc = npc;
    this.history = [];
    this.options = [];
    this.ai = true;
    // Det är ledaren som talar och betalar.
    this.g.state.focus = this.g.state.playerId;
    this.g.state.mode = 'dialog';
    $('dialog').hidden = false;
    $('bottom').hidden = true;
    $('dialog-name').textContent = npc.name;
    $<HTMLImageElement>('dialog-portrait').src = portraitUrl(npc.sprite);
    // Första mötet: känner personen igen hjälten? (steg 8)
    if (meet(this.g, npc)) this.history.push({ role: 'event', text: `${npc.name} känner igen ${this.g.leader.name}: ryktet om hjälten har gått före.` });
    this.g.changed();
    await this.npcTurn();
  }

  private close() {
    this.npc = null;
    $('dialog').hidden = true;
    $('bottom').hidden = false;
    if (this.g.state.mode === 'dialog') this.g.state.mode = 'explore';
    this.g.changed();
  }

  private async npcTurn() {
    const npc = this.npc!;
    this.waiting = true;
    this.render();
    let turn = this.ai ? await requestTurn(this.g, npc, this.history) : null;
    if (this.npc !== npc) return;
    if (!turn) {
      this.ai = false;
      turn = scriptedTurn(npc, this.history);
    }
    this.history.push({ role: 'npc', text: turn.line });
    this.options = turn.options;
    this.waiting = false;
    this.render();
  }

  private async say(text: string) {
    this.history.push({ role: 'player', text });
    await this.npcTurn();
  }

  private async act(id: string) {
    const npc = this.npc!;
    const intent = INTENTS[id];
    const result = intent.apply(this.g, npc);
    const shown = result.replace(/^Spelaren/, this.g.player.name);
    if (intent.ends) {
      this.close();
      return;
    }
    this.g.log(shown);
    this.history.push({ role: 'event', text: result });
    this.g.changed();
    await this.npcTurn();
  }

  private render() {
    const npc = this.npc!;
    const playerName = this.g.player.name;
    $('dialog-mode').textContent = this.ai ? '' : 'Förskriven dialog (ingen AI ansluten)';
    $('dialog-form').hidden = !this.ai;

    const text = $('dialog-text');
    text.replaceChildren(
      ...this.history.slice(-8).map((h) => {
        if (h.role === 'npc') return el('p', '', h.text);
        if (h.role === 'player') return el('p', 'player', `${playerName}: ${h.text}`);
        return el('p', 'event', h.text.replace(/^Spelaren/, playerName));
      }),
    );
    if (this.waiting) text.append(el('p', 'wait', '…'));
    text.scrollTop = text.scrollHeight;

    const box = $('dialog-options');
    box.replaceChildren();
    if (this.waiting) return;
    let n = 1;
    const add = (label: string, cls: string, fn: () => void) => {
      const b = el('button', cls, `${n++}. ${label}`);
      b.onclick = fn;
      box.append(b);
    };
    for (const o of this.options) add(o, '', () => void this.say(o));
    for (const id of dialogDef(npc).intents) {
      const intent = INTENTS[id];
      if (!intent.available(this.g, npc)) continue;
      add(`[${intent.label(this.g, npc)}]`, id === 'anfall' ? 'act danger' : 'act', () => void this.act(id));
    }
    add('Farväl.', 'bye', () => this.close());
  }
}
