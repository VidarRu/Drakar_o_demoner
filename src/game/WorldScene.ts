import Phaser from 'phaser';
import type { Fx, Game } from '../engine/game';
import { distance, idx, inBounds, type Point } from '../engine/map';
import type { Actor, BandState } from '../engine/types';
import { partyDarkvision, stepMinutes, terrainAt } from '../engine/worldmap';
import { activeZones } from '../engine/spelleffects';
import { torchBurns } from '../engine/weather';
import { bakeGround, bakeRows, caveMask, OVER, PADX, PLACE_ICONS, SPRITES, TILE } from './art';

const STEP_MS = 95;
const ENEMY_MS = 420;
const ZOOMS = [1, 2, 3];
/** Ljuskartans upplösning: punkter per ruta. */
const LIGHT_RES = 4;
/** Hur mörk grottan är utanför facklans sken (0–1). */
const CAVE_DARK = 0.72;
/** Facklans räckvidd i rutor. */
const TORCH_RADIUS = 4.2;
const GLINT_MS = 260;
/** Djup: marken 0, markeringar 5, sedan kartrader och figurer omväxlande, överst dimma och text. */
const rowDepth = (y: number) => 10 + y * 2;
const actorDepth = (y: number) => rowDepth(y) + 1;
const FX_COLOR: Record<Fx['kind'], string> = { damage: '#ff5a4a', miss: '#d8d4c8', heal: '#6fe08a', info: '#f0d070' };

/** Ritar världen och översätter klick till handlingar i spelmotorn. */
export class WorldScene extends Phaser.Scene {
  private fog!: Phaser.Textures.CanvasTexture;
  private bars!: Phaser.GameObjects.Graphics;
  private light!: Phaser.Textures.CanvasTexture;
  private lightImg!: ImageData;
  /** Grottmörker per ljuspunkt, utjämnat så att övergången till dagsljus blir mjuk. */
  private ambient!: Float32Array;
  /** Ett varmt sken per fackla eller luminal. */
  private glows: Phaser.GameObjects.Image[] = [];
  /** Figuren som kameran följer. */
  private followId = '';
  private zoom = 2;
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  /** Antal steg varje figur tagit, för att växla fot i gå-animationen. */
  private steps = new Map<string, number>();
  private overlay!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Rectangle;
  private reach: Point[] = [];
  private walking = false;
  private enemiesActing = false;
  /** Fiendegrupperna på världskartan: ikonen och antalet. */
  private bandSprites = new Map<string, { img: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }>();
  /** Terrängen och tiden per ruta under muspekaren på världskartan. */
  private terrainLabel!: Phaser.GameObjects.Text;
  private hooked = false;

  constructor(
    private g: Game,
    private onTalk: (npc: Actor) => void,
  ) {
    super('world');
    // Ny karta (mötesplats, världskarta eller stridskarta): scenen byggs om från början.
    g.onMapChange(() => this.scene.restart());
  }

  get busy() {
    return this.walking || this.enemiesActing;
  }

  create() {
    const { g } = this;
    this.sprites = new Map();
    this.steps = new Map();
    this.glows = [];
    this.bandSprites = new Map();
    this.followId = '';
    this.reach = [];
    this.walking = false;
    this.enemiesActing = false;
    for (const [key, el] of Object.entries({ ...SPRITES, ...PLACE_ICONS })) if (!this.textures.exists(key)) this.textures.addCanvas(key, el);
    // Dimman och ljuset ritas om för varje karta.
    for (const key of [`fog-${g.map.id}`, `light-${g.map.id}`]) if (this.textures.exists(key)) this.textures.remove(key);

    // Marken som en enda bild, och en bild per kartrad för det som har höjd.
    const groundKey = `ground-${g.map.id}`;
    const baked = bakeGround(g.map);
    if (!this.textures.exists(groundKey)) this.textures.addCanvas(groundKey, baked.ground);
    this.add.image(0, 0, groundKey).setOrigin(0).setDepth(0);
    if (baked.glints) {
      const { frames, x, y } = baked.glints;
      const keys = frames.map((frame, i) => {
        const key = `glint-${g.map.id}-${i}`;
        if (!this.textures.exists(key)) this.textures.addCanvas(key, frame);
        return key;
      });
      const glints = this.add.image(x, y, keys[0]).setOrigin(0).setDepth(1);
      let f = 0;
      this.time.addEvent({ delay: GLINT_MS, loop: true, callback: () => glints.setTexture(keys[++f % keys.length]) });
    }
    bakeRows(g.map).forEach((row, y) => {
      if (!row) return;
      const key = `row-${g.map.id}-${y}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, row);
      this.add.image(-PADX, y * TILE - OVER, key).setOrigin(0).setDepth(rowDepth(y));
    });

    // Dimman: en pixel per ruta, uppförstorad med mjuk interpolering så att kanterna tonar ut.
    this.fog = this.textures.createCanvas(`fog-${g.map.id}`, g.map.w, g.map.h)!;
    this.fog.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.add.image(0, 0, this.fog).setOrigin(0).setScale(TILE).setDepth(950);

    this.createLight();

    this.overlay = this.add.graphics().setDepth(5);
    this.bars = this.add.graphics().setDepth(960);
    this.cursor = this.add
      .rectangle(0, 0, TILE, TILE)
      .setOrigin(0)
      .setStrokeStyle(1, 0xffffff, 0.8)
      .setDepth(1001)
      .setVisible(false);

    const cam = this.cameras.main;
    cam.setBounds(-TILE * 4, -TILE * 4, (g.map.w + 8) * TILE, (g.map.h + 8) * TILE);
    cam.setRoundPixels(true);
    this.zoom = this.scale.width < 720 ? 1 : 2;
    cam.setZoom(this.zoom);
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const i = ZOOMS.indexOf(this.zoom) + (dy > 0 ? -1 : 1);
      this.zoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i))];
      cam.setZoom(this.zoom);
    });

    // Mötesplatsernas ikoner på världskartan.
    for (const p of g.map.places) this.add.image(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, p.icon).setDepth(actorDepth(p.y) - 0.5);
    this.terrainLabel = this.add
      .text(0, 0, '', { fontFamily: 'Georgia, serif', fontSize: '10px', color: '#f0e6c8', stroke: '#141016', strokeThickness: 3, resolution: 4 })
      .setDepth(1003)
      .setVisible(false);

    this.sync();

    if (!this.hooked) {
      // Lyssnarna läggs till en gång; de pekar på samma scen även när den byggs om.
      this.hooked = true;
      g.onChange(() => {
        if (this.sys.isActive()) this.sync();
      });
      g.onFx((fx) => {
        if (this.sys.isActive()) this.showFx(fx);
      });
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => void this.click(this.tileOf(p)));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.hover(this.tileOf(p)));
  }

  /** Kistor, förseglade dörrar och besvärjelser på kartan (MÖRKER, DIMMA och BESKYDDARE). */
  private drawMagicAndLocks(o: Phaser.GameObjects.Graphics) {
    const { g } = this;
    for (const z of activeZones(g)) {
      const x0 = (z.x - z.r) * TILE;
      const y0 = (z.y - z.r) * TILE;
      const size = (2 * z.r + 1) * TILE;
      if (z.kind === 'mörker') {
        o.fillStyle(0x000000, 0.55);
        o.fillRect(x0, y0, size, size);
      } else if (z.kind === 'dimma') {
        o.fillStyle(0xd8dde4, 0.18);
        o.fillRect(x0, y0, size, size);
      } else {
        o.lineStyle(2, 0x7fb8ff, 0.7);
        o.strokeRect(x0 + 1, y0 + 1, size - 2, size - 2);
      }
    }
    for (const l of g.map.locks) {
      if (!g.state.explored[l.y * g.map.w + l.x] || l.kind !== 'kista') continue;
      const st = g.state.locks?.[`${g.state.mapId}:${l.x},${l.y}`];
      const cx = l.x * TILE + TILE / 2;
      const cy = l.y * TILE + TILE / 2 + 2;
      o.fillStyle(0x3a2414, 1);
      o.fillRect(cx - 9, cy - 6, 18, 12);
      o.fillStyle(0x6b4424, 1);
      o.fillRect(cx - 8, cy - 5, 16, st?.looted ? 3 : 5);
      o.fillStyle(0xc8a040, 1);
      o.fillRect(cx - 9, cy - 1, 18, 2);
      if (!st?.open) o.fillRect(cx - 1, cy - 2, 3, 4);
    }
    for (const [k, st] of Object.entries(g.state.locks ?? {})) {
      if (!st.sealed || st.sealed.until <= g.state.time || !k.startsWith(`${g.state.mapId}:`)) continue;
      const [x, y] = k.slice(g.state.mapId.length + 1).split(',').map(Number);
      o.lineStyle(2, 0x9fd0ff, 0.9);
      o.strokeRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6);
    }
  }

  update(time: number) {
    const { g } = this;
    this.drawLight(time);
    const o = this.overlay;
    o.clear();
    const b = this.bars;
    b.clear();
    if (g.isPlayerTurn() && !this.busy) {
      o.fillStyle(0x7fc8ff, 0.22);
      for (const t of this.reach) o.fillRect(t.x * TILE + 1, t.y * TILE + 1, TILE - 2, TILE - 2);
    }
    // Föremål som tappats i strid: en liten glänsande klinga på marken.
    for (const d of g.state.dropped) {
      if (!g.isVisible(d.x, d.y)) continue;
      const cx = d.x * TILE + TILE / 2;
      const cy = d.y * TILE + TILE / 2 + 4;
      o.lineStyle(2, 0x2a2024, 1);
      o.lineBetween(cx - 6, cy + 3, cx + 6, cy - 3);
      o.lineStyle(1, 0xd8d4c8, 1);
      o.lineBetween(cx - 6, cy + 3, cx + 6, cy - 3);
      o.fillStyle(0xe3c476, 1);
      o.fillRect(cx - 3, cy, 2, 2);
    }
    this.drawMagicAndLocks(o);
    for (const a of g.state.actors) {
      const s = this.sprites.get(a.id);
      if (!s || !s.visible || a.kp >= a.maxKp) continue;
      b.fillStyle(0x1a1418, 0.9);
      b.fillRect(s.x - 11, s.y - 20, 22, 4);
      b.fillStyle(a.kind === 'player' ? 0x5fd070 : 0xd04a3a, 1);
      b.fillRect(s.x - 10, s.y - 19, Math.max(1, Math.round((20 * a.kp) / a.maxKp)), 2);
    }
    // Den som styrs: en ring vid fötterna när gruppen är fler än en.
    const me = this.sprites.get(g.player.id);
    if (me && g.state.party.length + g.state.actors.filter((a) => a.alive && a.elemental).length > 1) {
      o.lineStyle(1, 0xf0d070, 0.9);
      o.strokeEllipse(me.x, me.y + 12, 20, 7);
    }
  }

  private tileOf(p: Phaser.Input.Pointer): Point {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
  }

  private targetAt(t: Point): Actor | undefined {
    const a = this.g.actorAt(t.x, t.y);
    return a && a.id !== this.g.player.id && (this.g.isVisible(t.x, t.y) || a.kind === 'player') ? a : undefined;
  }

  private hover(t: Point) {
    const { g } = this;
    const known = inBounds(g.map, t.x, t.y) && !!g.state.explored[idx(g.map, t.x, t.y)];
    this.cursor.setVisible(known);
    if (!known) return;
    const a = this.targetAt(t);
    const band = this.bandAt(t);
    this.cursor.setPosition(t.x * TILE, t.y * TILE);
    this.cursor.setStrokeStyle(1, band || a?.hostile ? 0xff5a4a : a ? 0xf0d070 : 0xffffff, 0.9);
    this.input.setDefaultCursor(a || band ? 'pointer' : 'default');
    if (g.map.kind === 'värld') {
      const place = g.map.places.find((p) => p.x === t.x && p.y === t.y);
      const min = stepMinutes(g, t.x, t.y);
      const text = band
        ? `${band.name} (${band.members.length})`
        : place
          ? place.name
          : g.map.tiles[idx(g.map, t.x, t.y)] === '~'
            ? 'flod'
            : `${terrainAt(g, t.x, t.y)}, ${min < 60 ? `${min} minuter` : `${min / 60} timme`}`;
      this.terrainLabel.setText(text).setPosition(t.x * TILE + TILE + 2, t.y * TILE).setVisible(true);
    } else this.terrainLabel.setVisible(false);
  }

  /** En fiendegrupp som syns på rutan. */
  private bandAt(t: Point): BandState | undefined {
    const b = this.g.bandAt(t.x, t.y);
    return b && this.g.isVisible(t.x, t.y) ? b : undefined;
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => this.time.delayedCall(ms, () => resolve()));
  }

  private async click(t: Point) {
    const { g } = this;
    if (this.busy || !inBounds(g.map, t.x, t.y) || !g.state.explored[idx(g.map, t.x, t.y)]) return;
    const target = this.targetAt(t);

    const band = this.bandAt(t);
    if (g.state.mode === 'explore' && band) {
      // Världskartan: gå fram till fiendegruppen och anfall den.
      const path = g.pathTo(t.x, t.y, true);
      if (!path) return;
      await this.walk(path, (step) => g.stepPlayer(step));
      if (g.state.mode === 'explore' && g.state.bands?.includes(band)) g.attackBand(band.id);
      return;
    }
    if (g.state.mode === 'explore') {
      // Ett klick på någon i gruppen visar hen i panelerna.
      if (target?.kind === 'player') {
        g.setFocus(target.id);
        return;
      }
      const path = g.pathTo(t.x, t.y, !!target);
      if (!path) return;
      await this.walk(path, (step) => g.stepPlayer(step));
      const p = g.leader;
      if (target && g.canTalk(target) && g.state.mode === 'explore' && distance(p.x, p.y, target.x, target.y) <= 1) {
        this.onTalk(target);
      }
    } else if (g.isPlayerTurn()) {
      if (target?.hostile && g.holdsRanged()) {
        // Med ett avståndsvapen går man inte fram till målet: man står still och skjuter.
        const problem = g.attackProblem(target.id);
        if (problem) {
          g.log(problem);
          g.changed();
        } else g.playerAttack(target.id);
      } else if (target?.hostile) {
        if (!g.canAttack(target.id)) {
          const path = g.pathTo(t.x, t.y, true);
          if (path) await this.walk(path, (step) => g.combatStep(step));
        }
        if (g.canAttack(target.id)) g.playerAttack(target.id);
      } else if (!target) {
        const path = g.pathTo(t.x, t.y);
        if (path) await this.walk(path, (step) => g.combatStep(step));
      }
    }
  }

  private async walk(path: Point[], step: (p: Point) => boolean) {
    this.walking = true;
    const mapId = this.g.state.mapId;
    // Vandringen avbryts om gruppen byter karta eller hamnar i strid på vägen.
    for (const p of path) {
      if (this.g.state.mapId !== mapId || !step(p)) break;
      if (this.g.state.mapId !== mapId) return;
      await this.delay(this.g.map.kind === 'värld' ? STEP_MS * 2 : STEP_MS);
    }
    this.walking = false;
    this.sync();
  }

  private async runEnemies() {
    const { g } = this;
    this.enemiesActing = true;
    while (g.state.mode === 'combat' && !g.isPlayerTurn()) {
      await this.delay(ENEMY_MS);
      if (!g.enemyTurn()) break;
    }
    await this.delay(150);
    this.enemiesActing = false;
    this.sync();
  }

  /** Uppdaterar allt som syns utifrån speltillståndet. */
  private sync() {
    const { g } = this;
    this.drawFog();

    for (const a of g.state.actors) {
      let s = this.sprites.get(a.id);
      if (!a.alive) {
        if (s) {
          this.sprites.delete(a.id);
          this.tweens.add({ targets: s, alpha: 0, angle: 90, duration: 300, onComplete: () => s!.destroy() });
        }
        continue;
      }
      const tx = a.x * TILE + TILE / 2;
      const ty = a.y * TILE + TILE / 2;
      if (!s) {
        s = this.add.image(tx, ty, a.sprite).setDepth(actorDepth(a.y));
        this.sprites.set(a.id, s);
      }
      // På världskartan går gruppen som en figur: bara ledaren syns.
      const world = g.map.kind === 'värld';
      s.setVisible(world && a.kind === 'player' ? a.id === g.state.playerId : a.kind === 'player' || g.isVisible(a.x, a.y));
      // Medvetslösa ligger ner; utslagna sjunker ihop; den som smyger oupptäckt syns svagt.
      s.setAngle(a.unconscious ? 90 : 0);
      s.setAlpha(a.hidden ? 0.5 : a.unconscious || a.down ? 0.75 : 1);
      if (s.x !== tx || s.y !== ty) {
        if (tx !== s.x) s.setFlipX(tx < s.x);
        this.tweens.killTweensOf(s);
        // Under steget ligger figuren på den sydligaste av de två raderna, så att den inte skyms.
        const sprite = s;
        const step = (this.steps.get(a.id) ?? 0) + 1;
        this.steps.set(a.id, step);
        sprite.setDepth(actorDepth(Math.max(a.y, Math.round((sprite.y - TILE / 2) / TILE))));
        sprite.setTexture(`${a.sprite}_g${(step % 2) + 1}`);
        this.tweens.add({
          targets: sprite,
          x: tx,
          y: ty,
          duration: STEP_MS,
          onComplete: () => {
            sprite.setDepth(actorDepth(a.y));
            // Stå still igen om inget nytt steg hunnit börja.
            this.time.delayedCall(40, () => {
              if (sprite.active && !this.tweens.isTweening(sprite)) sprite.setTexture(a.sprite);
            });
          },
        });
      }
    }

    this.syncBands();

    // Kameran följer den som har turen i strid, och ledaren annars.
    const who = g.state.mode === 'combat' ? g.player : g.leader;
    const target = this.sprites.get(who.id);
    if (target && this.followId !== who.id) {
      this.followId = who.id;
      this.cameras.main.startFollow(target, true, 0.12, 0.12);
    }
    this.reach = g.reachableTiles();
    if (!this.enemiesActing && g.state.mode === 'combat' && !g.isPlayerTurn()) void this.runEnemies();
  }

  /** Fiendegrupperna på världskartan: en ikon med antalet, röd när gruppen jagar. */
  private syncBands() {
    const { g } = this;
    const bands = g.map.kind === 'värld' ? (g.state.bands ?? []) : [];
    for (const [id, s] of this.bandSprites) {
      if (bands.some((b) => b.id === id)) continue;
      s.img.destroy();
      s.label.destroy();
      this.bandSprites.delete(id);
    }
    for (const b of bands) {
      const tx = b.x * TILE + TILE / 2;
      const ty = b.y * TILE + TILE / 2;
      let s = this.bandSprites.get(b.id);
      if (!s) {
        const img = this.add.image(tx, ty, b.sprite).setDepth(actorDepth(b.y));
        const label = this.add
          .text(tx + 9, ty + 6, '', { fontFamily: 'Georgia, serif', fontSize: '9px', fontStyle: 'bold', color: '#f0e6c8', stroke: '#141016', strokeThickness: 3, resolution: 4 })
          .setDepth(1000);
        s = { img, label };
        this.bandSprites.set(b.id, s);
      }
      const seen = g.isVisible(b.x, b.y);
      s.img.setVisible(seen).setDepth(actorDepth(b.y));
      s.label.setVisible(seen).setText(`${b.mode === 'jagar' ? '! ' : ''}${b.members.length}`).setColor(b.mode === 'jagar' ? '#ff6a50' : '#f0e6c8');
      if (s.img.x !== tx || s.img.y !== ty) {
        if (tx !== s.img.x) s.img.setFlipX(tx < s.img.x);
        this.tweens.add({ targets: s.img, x: tx, y: ty, duration: STEP_MS * 2 });
        this.tweens.add({ targets: s.label, x: tx + 9, y: ty + 6, duration: STEP_MS * 2 });
      }
    }
  }

  /** Mörker i grottor, med en fackla runt rollpersonen. Ritas om varje bildruta så att skenet följer med och fladdrar. */
  private createLight() {
    const { map } = this.g;
    const w = map.w * LIGHT_RES;
    const h = map.h * LIGHT_RES;
    const cave = caveMask(map);
    const raw = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) raw[y * w + x] = cave[Math.floor(y / LIGHT_RES) * map.w + Math.floor(x / LIGHT_RES)];
    // Lådoskärpa i två pass ger en mjuk kant mellan grotta och dagsljus.
    const R = LIGHT_RES;
    const tmp = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let n = 0;
        for (let k = -R; k <= R; k++) {
          const xx = x + k;
          if (xx < 0 || xx >= w) continue;
          sum += raw[y * w + xx];
          n++;
        }
        tmp[y * w + x] = sum / n;
      }
    this.ambient = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let n = 0;
        for (let k = -R; k <= R; k++) {
          const yy = y + k;
          if (yy < 0 || yy >= h) continue;
          sum += tmp[yy * w + x];
          n++;
        }
        this.ambient[y * w + x] = (sum / n) * CAVE_DARK;
      }

    this.light = this.textures.createCanvas(`light-${map.id}`, w, h)!;
    this.lightImg = this.light.getContext().createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      this.lightImg.data[i * 4] = 10;
      this.lightImg.data[i * 4 + 1] = 8;
      this.lightImg.data[i * 4 + 2] = 22;
    }
    this.add.image(0, 0, this.light).setOrigin(0).setScale(TILE / LIGHT_RES).setDepth(940);

    // Varmt sken från facklan, adderat ovanpå.
    if (!this.textures.exists('glow')) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,170,80,1)');
      grad.addColorStop(0.5, 'rgba(255,140,60,0.35)');
      grad.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      this.textures.addCanvas('glow', c);
    }
  }

  /** Ljuskällorna: tända facklor i gruppen och luminaler (fem rutor per grad). */
  private lightSources(): { x: number; y: number; r: number }[] {
    const out: { x: number; y: number; r: number }[] = [];
    for (const a of this.g.state.actors) {
      if (!a.alive || a.kind !== 'player') continue;
      const s = this.sprites.get(a.id);
      if (!s) continue;
      if (a.elemental?.kind === 'ljus') out.push({ x: s.x, y: s.y, r: 5 * a.elemental.grade });
      else if (!a.elemental && torchBurns(this.g, a)) out.push({ x: s.x, y: s.y, r: TORCH_RADIUS });
    }
    return out;
  }

  private drawLight(time: number) {
    const { map } = this.g;
    const w = map.w * LIGHT_RES;
    const h = map.h * LIGHT_RES;
    const flicker = Math.sin(time / 130) * 0.06 + Math.sin(time / 57 + 1.3) * 0.04;
    const lights = this.lightSources().map((l) => ({ cx: (l.x / TILE) * LIGHT_RES, cy: (l.y / TILE) * LIGHT_RES, radius: l.r * LIGHT_RES * (1 + flicker), r: l.r, x: l.x, y: l.y }));
    const data = this.lightImg.data;
    // Mörkersyn leder hela gruppen utanför strid (Vidar): grottan syns, bara lite skumt.
    const seesDark = this.g.state.mode !== 'combat' && partyDarkvision(this.g);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const amb = this.ambient[i] * (seesDark ? 0.35 : 1);
        let a = 0;
        if (amb > 0.001) {
          let lit = 0;
          for (const l of lights) {
            const d = Math.hypot(x + 0.5 - l.cx, y + 0.5 - l.cy) / l.radius;
            if (d < 1) lit = Math.max(lit, 1 - d * d);
          }
          a = amb * (1 - lit * 0.92);
        }
        data[i * 4 + 3] = a * 255;
      }
    }
    this.light.getContext().putImageData(this.lightImg, 0, 0);
    this.light.refresh();
    this.light.setFilter(Phaser.Textures.FilterMode.LINEAR);

    while (this.glows.length < lights.length) this.glows.push(this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(945));
    this.glows.forEach((glow, n) => {
      const l = lights[n];
      if (!l) {
        glow.setVisible(false);
        return;
      }
      const here = this.ambient[Math.min(h - 1, Math.max(0, Math.floor(l.cy))) * w + Math.min(w - 1, Math.max(0, Math.floor(l.cx)))];
      glow
        .setVisible(true)
        .setPosition(l.x, l.y)
        .setScale((l.r * TILE * 1.6) / 128)
        .setAlpha((here / CAVE_DARK) * (0.2 + flicker * 0.6));
    });
  }

  private drawFog() {
    const { g } = this;
    const ctx = this.fog.getContext();
    const img = ctx.createImageData(g.map.w, g.map.h);
    for (let i = 0; i < g.map.w * g.map.h; i++) {
      img.data[i * 4] = 8;
      img.data[i * 4 + 1] = 7;
      img.data[i * 4 + 2] = 10;
      img.data[i * 4 + 3] = g.visible.has(i) ? 0 : g.state.explored[i] ? 150 : 255;
    }
    ctx.putImageData(img, 0, 0);
    this.fog.refresh();
    // refresh() laddar upp en ny textur med spelets standardfilter (skarpa pixlar); mjuka upp igen.
    this.fog.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  private showFx(fx: Fx) {
    const s = this.sprites.get(fx.actorId);
    if (!s) return;
    const text = this.add
      .text(s.x, s.y - 18, fx.text, {
        fontFamily: 'Georgia, serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: FX_COLOR[fx.kind],
        stroke: '#141016',
        strokeThickness: 2,
        resolution: 4,
      })
      .setOrigin(0.5)
      .setDepth(1002);
    this.tweens.add({ targets: text, y: text.y - 22, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
    if (fx.kind === 'damage') {
      this.tweens.add({ targets: s, alpha: 0.3, duration: 70, yoyo: true, repeat: 1 });
    }
  }
}
