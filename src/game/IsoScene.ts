/**
 * Slängprov: världen sedd snett ovanifrån, med Flares grafik (CC-BY-SA 3.0, se
 * public/art/CREDITS.md) och kodritade murar, berg, vägar och vatten.
 * Spelmotorn är densamma som för WorldScene; bara ritningen och inmatningen skiljer sig.
 */
import Phaser from 'phaser';
import type { Fx, Game } from '../engine/game';
import { distance, idx, inBounds, type Point } from '../engine/map';
import type { Actor, BandState } from '../engine/types';
import { partyDarkvision, stepMinutes, terrainAt } from '../engine/worldmap';
import { activeZones } from '../engine/spelleffects';
import { torchBurns } from '../engine/weather';
import { PLACE_ICONS, SPRITES } from './art';
import { blockImage, WALL_H, type Box } from './iso/blocks';
import { facing, hash, HH, HW, isoDepth, toScreen, toTile, worldSize } from './iso/geom';
import { bakeIsoGround, canvas, diamond, isoCave, MASK_SCALE, type Atlas } from './iso/ground';

const STEP_MS = 160;
const ENEMY_MS = 420;
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5];
const CAVE_DARK = 0.78;
const TORCH_RADIUS = 4.2;
/** Flares träd är ritade för större rutor än våra; de skalas ned så att en figur når till ungefär en tredjedel. */
const TREE_SCALE = 0.62;
const FX_COLOR: Record<Fx['kind'], string> = { damage: '#ff5a4a', miss: '#d8d4c8', heal: '#6fe08a', info: '#f0d070' };
const BASE = import.meta.env.BASE_URL + 'art/flare/';

/** Figurerna som finns som Flare-figurer (se tools/flare_art.py). */
const FLARE_CHARS = [
  'krigare', 'krigarinna', 'jagare', 'tjuv', 'magiker', 'alv', 'dvarg', 'vard', 'smed', 'gumma',
  'knekt', 'jagarinna', 'linnea', 'svartalf', 'hovding', 'haxkonstnar', 'skelett',
];
const COLS = 16;
const ANIM = { stance: [0, 4], run: [4, 8], swing: [12, 4] } as const;

/** Tangenterna för att gå: W/↑ uppåt på skärmen, och så vidare. Q, E, Z och C går längs rutnätet. */
const KEY_STEPS: Record<string, [number, number]> = {
  w: [-1, -1], arrowup: [-1, -1],
  s: [1, 1], arrowdown: [1, 1],
  a: [-1, 1], arrowleft: [-1, 1],
  d: [1, -1], arrowright: [1, -1],
  q: [-1, 0], e: [0, -1], z: [0, 1], c: [1, 0],
};

interface Tall {
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
  fade: number;
}

const ch = (g: Game, x: number, y: number) => (inBounds(g.map, x, y) ? g.map.tiles[idx(g.map, x, y)] : '');

export class IsoScene extends Phaser.Scene {
  private atlas!: Atlas;
  private charMeta!: Record<string, { cell: number; anchor: [number, number] }>;
  private sprites = new Map<string, Phaser.GameObjects.Sprite | Phaser.GameObjects.Image>();
  private lastDir = new Map<string, number>();
  /** Rutan där figuren stod vid förra uppdateringen. */
  private pos = new Map<string, Point>();
  private tall: Tall[] = [];
  private dark!: Phaser.Textures.CanvasTexture;
  private darkTmp!: HTMLCanvasElement;
  private cave!: Float32Array;
  private glows: Phaser.GameObjects.Image[] = [];
  private overlay!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private terrainLabel!: Phaser.GameObjects.Text;
  private bandSprites = new Map<string, { img: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }>();
  private reach: Point[] = [];
  private followId = '';
  private zoom = 1;
  private walking = false;
  private enemiesActing = false;
  private hooked = false;
  private lightKey = '';

  constructor(
    private g: Game,
    private onTalk: (npc: Actor) => void,
  ) {
    super('world');
    g.onMapChange(() => this.scene.restart());
  }

  get busy() {
    return this.walking || this.enemiesActing;
  }

  preload() {
    if (!this.textures.exists('flare-tiles')) {
      this.load.image('flare-tiles', BASE + 'tiles.png');
      this.load.json('flare-tiles-json', BASE + 'tiles.json');
      this.load.json('flare-chars', BASE + 'chars.json');
      for (const k of FLARE_CHARS) this.load.spritesheet(`fc-${k}`, `${BASE}char_${k}.png`, { frameWidth: 120, frameHeight: 120 });
    }
  }

  create() {
    const { g } = this;
    this.sprites = new Map();
    this.lastDir = new Map();
    this.pos = new Map();
    this.tall = [];
    this.glows = [];
    this.bandSprites = new Map();
    this.followId = '';
    this.reach = [];
    this.walking = false;
    this.enemiesActing = false;
    this.lightKey = '';
    this.atlas = this.cache.json.get('flare-tiles-json').frames;
    this.charMeta = this.cache.json.get('flare-chars');
    const tex = this.textures.get('flare-tiles');
    for (const [name, f] of Object.entries(this.atlas)) if (!tex.has(name)) tex.add(name, 0, f.frame.x, f.frame.y, f.frame.w, f.frame.h);
    for (const [key, el] of Object.entries({ ...SPRITES, ...PLACE_ICONS })) if (!this.textures.exists(key)) this.textures.addCanvas(key, el);
    this.makeAnims();

    // Marken.
    const groundKey = `iso-ground-${g.map.id}`;
    if (!this.textures.exists(groundKey)) this.textures.addCanvas(groundKey, bakeIsoGround(g.map, tex.getSourceImage() as HTMLImageElement, this.atlas));
    this.add.image(0, 0, groundKey).setOrigin(0).setDepth(0);

    this.overlay = this.add.graphics().setDepth(50);
    this.cursor = this.add.graphics().setDepth(51);
    this.buildObjects();

    // Mörker och dimma, i en fjärdedels upplösning och mjukt förstorat.
    const { w, h } = worldSize(g.map);
    const darkKey = `iso-dark-${g.map.id}`;
    if (this.textures.exists(darkKey)) this.textures.remove(darkKey);
    this.dark = this.textures.createCanvas(darkKey, Math.ceil(w / MASK_SCALE), Math.ceil(h / MASK_SCALE))!;
    this.darkTmp = canvas(this.dark.width, this.dark.height);
    this.add.image(0, 0, this.dark).setOrigin(0).setScale(MASK_SCALE).setDepth(5000);
    this.cave = isoCave(g.map);
    this.makeGlowTexture();

    this.bars = this.add.graphics().setDepth(6000);
    this.terrainLabel = this.add
      .text(0, 0, '', { fontFamily: 'Georgia, serif', fontSize: '14px', color: '#f0e6c8', stroke: '#141016', strokeThickness: 4, resolution: 2 })
      .setDepth(6003)
      .setVisible(false);

    const cam = this.cameras.main;
    cam.setBounds(-200, -200, w + 400, h + 400);
    this.zoom = this.scale.width < 720 ? 0.75 : 1;
    cam.setZoom(this.zoom);
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const i = ZOOMS.indexOf(this.zoom) + (dy > 0 ? -1 : 1);
      this.zoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i))];
      cam.setZoom(this.zoom);
    });

    for (const p of g.map.places) {
      const s = toScreen(g.map, p.x, p.y);
      this.add.image(s.x, s.y - 8, p.icon).setScale(2).setDepth(isoDepth(p.x, p.y, 4));
    }

    this.sync();

    if (!this.hooked) {
      this.hooked = true;
      g.onChange(() => {
        if (this.sys.isActive()) this.sync();
      });
      g.onFx((fx) => {
        if (this.sys.isActive()) this.showFx(fx);
      });
      document.addEventListener('keydown', (e) => {
        if (this.sys.isActive()) this.key(e);
      });
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => void this.click(this.tileOf(p)));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.hover(this.tileOf(p)));
  }

  // ------------------------------------------------------------------ figurer

  private makeAnims() {
    for (const k of FLARE_CHARS) {
      if (this.anims.exists(`${k}-stance-0`)) continue;
      for (let d = 0; d < 8; d++) {
        for (const [name, [start, n]] of Object.entries(ANIM)) {
          const frames = Array.from({ length: n }, (_, i) => ({ key: `fc-${k}`, frame: d * COLS + start + i }));
          this.anims.create({
            key: `${k}-${name}-${d}`,
            frames,
            frameRate: name === 'stance' ? 4 : name === 'run' ? 13 : 12,
            repeat: name === 'swing' ? 0 : -1,
            yoyo: name === 'stance',
          });
        }
      }
    }
  }

  private makeSprite(key: string, x: number, y: number) {
    if (FLARE_CHARS.includes(key)) {
      const m = this.charMeta[key];
      return this.add.sprite(x, y, `fc-${key}`, 7 * COLS).setOrigin(m.anchor[0] / m.cell, m.anchor[1] / m.cell);
    }
    // Figurer som saknar Flare-motsvarighet: den gamla kodritade figuren, förstorad.
    return this.add.image(x, y, key).setScale(2).setOrigin(0.5, 0.92);
  }

  private play(s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, key: string, anim: keyof typeof ANIM, dir: number) {
    if (!(s instanceof Phaser.GameObjects.Sprite) || !FLARE_CHARS.includes(key)) return;
    const name = `${key}-${anim}-${dir}`;
    if (s.anims.currentAnim?.key !== name) s.play({ key: name, startFrame: anim === 'stance' ? Math.floor(Math.random() * 3) : 0 });
  }

  /** Höjden som en figur står på (kullar). */
  private lift(_x: number, _y: number) {
    return 0;
  }

  // ------------------------------------------------------------------ föremål på kartan

  private addTall(x: number, y: number, img: Phaser.GameObjects.Image, fade: number) {
    this.tall.push({ x, y, img, fade });
  }

  private frameImage(x: number, y: number, name: string, ox = 0, oy = 0, scale = 1, layer = 0) {
    const f = this.atlas[name];
    const p = toScreen(this.g.map, x, y);
    return this.add
      .image(p.x + ox, p.y + oy, 'flare-tiles', name)
      .setOrigin(f.pivotPx.x / f.frame.w, f.pivotPx.y / f.frame.h)
      .setScale(scale)
      .setDepth(isoDepth(x, y, layer));
  }

  private blockAt(x: number, y: number, key: string, boxes: Box[], maxZ: number) {
    const texKey = `blk-${key}`;
    let origin: { originX: number; originY: number };
    if (!this.textures.exists(texKey)) {
      const b = blockImage(boxes, maxZ);
      this.textures.addCanvas(texKey, b.canvas);
      origin = b;
      this.registry.set(texKey, { originX: b.originX, originY: b.originY });
    } else origin = this.registry.get(texKey);
    const p = toScreen(this.g.map, x, y);
    return this.add.image(p.x, p.y, texKey).setOrigin(origin.originX, origin.originY).setDepth(isoDepth(x, y, 0));
  }

  private buildObjects() {
    const { g } = this;
    const TREES = ['pine0', 'pine1', 'pine2', 'pine3', 'oak0', 'oak1', 'oak2', 'oak3', 'pine1', 'pine2'];
    for (let y = 0; y < g.map.h; y++)
      for (let x = 0; x < g.map.w; x++) {
        const c = ch(g, x, y);
        const r = hash(x, y, 31);
        const jx = (hash(x, y, 32) - 0.5) * HW * 0.5;
        const jy = (hash(x, y, 33) - 0.5) * HH * 0.5;
        if (c === 'T' || c === 'F') {
          this.addTall(x, y, this.frameImage(x, y, TREES[Math.floor(r * TREES.length)], jx, jy, TREE_SCALE * (0.9 + r * 0.25)), 0.35);
          if (c === 'F' && r > 0.3) this.addTall(x, y, this.frameImage(x, y, TREES[Math.floor(r * 77) % TREES.length], -jx * 1.5, -jy - 6, TREE_SCALE * 0.85, 1), 0.35);
        } else if (c === 'f') {
          if (r < 0.6) this.addTall(x, y, this.frameImage(x, y, r < 0.3 ? `birch${Math.floor(r * 13) % 4}` : TREES[Math.floor(r * 31) % TREES.length], jx, jy, TREE_SCALE * 0.9), 0.4);
          else this.frameImage(x, y, `bush${Math.floor(r * 10) % 2}`, jx, jy, 0.7);
        } else if (c === 'h') {
          // Kullar: stenar och tuvor; skuggningen ligger i marken.
          if (r < 0.2) this.frameImage(x, y, `rock${Math.floor(r * 23) % 4}`, jx, jy, 0.45 + r, 1);
          else if (r < 0.6) this.frameImage(x, y, `tuft${Math.floor(r * 17) % 4}`, jx, jy, 0.7, 1);
        } else if (c === 'M' || c === '%') {
          const solid = (cc: string) => cc === 'M' || cc === '%' || cc === '';
          const hgt = c === 'M' ? 70 + Math.floor(r * 4) * 10 : 62 + Math.floor(r * 3) * 8;
          const left = !solid(ch(g, x, y + 1)) || ch(g, x, y + 1) === '';
          const right = !solid(ch(g, x + 1, y));
          const img = this.blockAt(x, y, `rock-${hgt}-${left}-${right}`, [
            { x0: -0.5, y0: -0.5, x1: 0.5, y1: 0.5, z0: 0, z1: hgt, side: 'rock', top: 'rock', left, right, topShade: 0.55 },
          ], hgt);
          this.addTall(x, y, img, 0.4);
        } else if (c === '#') {
          const wall = (cc: string) => cc === '#';
          const left = !wall(ch(g, x, y + 1));
          const right = !wall(ch(g, x + 1, y));
          const img = this.blockAt(x, y, `wall-${left}-${right}`, [
            { x0: -0.5, y0: -0.5, x1: 0.5, y1: 0.5, z0: 0, z1: WALL_H, side: 'stone', top: 'stone', left, right, topShade: 0.25 },
          ], WALL_H);
          this.addTall(x, y, img, 0.35);
        } else if (c === '+') {
          const alongX = ch(g, x - 1, y) === '#' || ch(g, x + 1, y) === '#';
          const post = 0.18;
          const boxes: Box[] = alongX
            ? [
                { x0: -0.5, y0: -0.5, x1: -0.5 + post, y1: 0.5, z0: 0, z1: WALL_H, side: 'stone', top: 'stone', topShade: 0.25 },
                { x0: 0.5 - post, y0: -0.5, x1: 0.5, y1: 0.5, z0: 0, z1: WALL_H, side: 'stone', top: 'stone', topShade: 0.25 },
                { x0: -0.5, y0: -0.5, x1: 0.5, y1: 0.5, z0: WALL_H - 12, z1: WALL_H, side: 'wood', top: 'stone', topShade: 0.25 },
              ]
            : [
                { x0: -0.5, y0: -0.5, x1: 0.5, y1: -0.5 + post, z0: 0, z1: WALL_H, side: 'stone', top: 'stone', topShade: 0.25 },
                { x0: -0.5, y0: 0.5 - post, x1: 0.5, y1: 0.5, z0: 0, z1: WALL_H, side: 'stone', top: 'stone', topShade: 0.25 },
                { x0: -0.5, y0: -0.5, x1: 0.5, y1: 0.5, z0: WALL_H - 12, z1: WALL_H, side: 'wood', top: 'stone', topShade: 0.25 },
              ];
          this.addTall(x, y, this.blockAt(x, y, `door-${alongX}`, boxes, WALL_H), 0.35);
        } else if (c === ':' && r < 0.05) {
          this.frameImage(x, y, `stalag${Math.floor(r * 80) % 4}`, jx, jy, 0.7);
        }
      }
    for (const l of g.map.locks) if (l.kind === 'kista') this.frameImage(l.x, l.y, 'chest0', 0, 0, 0.7, 2);
  }

  // ------------------------------------------------------------------ inmatning

  private tileOf(p: Phaser.Input.Pointer): Point {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return toTile(this.g.map, w.x, w.y);
  }

  private targetAt(t: Point): Actor | undefined {
    const a = this.g.actorAt(t.x, t.y);
    return a && a.id !== this.g.player.id && (this.g.isVisible(t.x, t.y) || a.kind === 'player') ? a : undefined;
  }

  private bandAt(t: Point): BandState | undefined {
    const b = this.g.bandAt(t.x, t.y);
    return b && this.g.isVisible(t.x, t.y) ? b : undefined;
  }

  private key(e: KeyboardEvent) {
    const el = document.activeElement;
    if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
    // Inga steg medan ett fönster är öppet.
    for (const id of ['panel', 'dialog', 'modal', 'rollformular', 'training', 'between']) if (document.getElementById(id)?.hidden === false) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const step = KEY_STEPS[e.key.toLowerCase()];
    if (!step) return;
    e.preventDefault();
    if (this.busy) return;
    const { g } = this;
    const who = g.state.mode === 'combat' ? g.player : g.leader;
    const t = { x: who.x + step[0], y: who.y + step[1] };
    void this.click(t, true);
  }

  private hover(t: Point) {
    const { g } = this;
    const known = inBounds(g.map, t.x, t.y) && !!g.state.explored[idx(g.map, t.x, t.y)];
    this.cursor.clear();
    if (!known) {
      this.terrainLabel.setVisible(false);
      return;
    }
    const a = this.targetAt(t);
    const band = this.bandAt(t);
    const p = toScreen(g.map, t.x, t.y);
    const color = band || a?.hostile ? 0xff5a4a : a ? 0xf0d070 : 0xf4ecd8;
    this.cursor.lineStyle(2, color, 0.85);
    this.cursor.strokePoints(
      [
        { x: p.x, y: p.y - HH },
        { x: p.x + HW, y: p.y },
        { x: p.x, y: p.y + HH },
        { x: p.x - HW, y: p.y },
      ],
      true,
    );
    this.input.setDefaultCursor(a || band ? 'pointer' : 'default');
    if (g.map.kind === 'värld') {
      const place = g.map.places.find((pl) => pl.x === t.x && pl.y === t.y);
      const min = stepMinutes(g, t.x, t.y);
      const text = band
        ? `${band.name} (${band.members.length})`
        : place
          ? place.name
          : ch(g, t.x, t.y) === '~'
            ? 'flod'
            : `${terrainAt(g, t.x, t.y)}, ${min < 60 ? `${min} minuter` : `${min / 60} timme`}`;
      this.terrainLabel.setText(text).setPosition(p.x + HW * 0.6, p.y - HH * 2).setVisible(true);
    } else this.terrainLabel.setVisible(false);
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => this.time.delayedCall(ms, () => resolve()));
  }

  private async click(t: Point, fromKey = false) {
    const { g } = this;
    if (this.busy || !inBounds(g.map, t.x, t.y) || (!fromKey && !g.state.explored[idx(g.map, t.x, t.y)])) return;
    const target = this.targetAt(t);
    const band = this.bandAt(t);
    if (g.state.mode === 'explore' && band) {
      const path = g.pathTo(t.x, t.y, true);
      if (!path) return;
      await this.walk(path, (step) => g.stepPlayer(step));
      if (g.state.mode === 'explore' && g.state.bands?.includes(band)) g.attackBand(band.id);
      return;
    }
    if (g.state.mode === 'explore') {
      if (target?.kind === 'player' && !fromKey) {
        g.setFocus(target.id);
        return;
      }
      if (fromKey && !target) {
        await this.walk([t], (step) => g.stepPlayer(step));
        return;
      }
      const path = g.pathTo(t.x, t.y, !!target);
      if (!path) return;
      await this.walk(path, (step) => g.stepPlayer(step));
      const p = g.leader;
      if (target && g.canTalk(target) && g.state.mode === 'explore' && distance(p.x, p.y, target.x, target.y) <= 1) this.onTalk(target);
    } else if (g.isPlayerTurn()) {
      if (target?.hostile && g.holdsRanged()) {
        const problem = g.attackProblem(target.id);
        if (problem) {
          g.log(problem);
          g.changed();
        } else this.attack(target);
      } else if (target?.hostile) {
        if (!g.canAttack(target.id)) {
          const path = g.pathTo(t.x, t.y, true);
          if (path) await this.walk(path, (step) => g.combatStep(step));
        }
        if (g.canAttack(target.id)) this.attack(target);
      } else if (!target) {
        const path = fromKey ? [t] : g.pathTo(t.x, t.y);
        if (path) await this.walk(path, (step) => g.combatStep(step));
      }
    }
  }

  /** Anfallet: figuren hugger mot målet innan motorn slår. */
  private attack(target: Actor) {
    const { g } = this;
    const me = g.player;
    const s = this.sprites.get(me.id);
    if (s) {
      const dir = facing(target.x - me.x, target.y - me.y);
      this.lastDir.set(me.id, dir);
      this.play(s, me.sprite, 'swing', dir);
    }
    g.playerAttack(target.id);
  }

  private async walk(path: Point[], step: (p: Point) => boolean) {
    this.walking = true;
    const mapId = this.g.state.mapId;
    for (const p of path) {
      if (this.g.state.mapId !== mapId || !step(p)) break;
      if (this.g.state.mapId !== mapId) return;
      await this.delay(this.g.map.kind === 'värld' ? STEP_MS * 1.5 : STEP_MS);
    }
    this.walking = false;
    this.sync();
  }

  private async runEnemies() {
    const { g } = this;
    this.enemiesActing = true;
    while (g.state.mode === 'combat' && !g.isPlayerTurn()) {
      await this.delay(ENEMY_MS);
      const before = new Map(g.state.actors.map((a) => [a.id, a.kp]));
      const actorId = g.state.combat?.order[g.state.combat.turn];
      if (!g.enemyTurn()) break;
      // Den som anföll någon hugger.
      const hurt = g.state.actors.find((a) => before.get(a.id) !== a.kp);
      const att = actorId ? g.actor(actorId) : undefined;
      const s = att && this.sprites.get(att.id);
      if (att && hurt && s && distance(att.x, att.y, hurt.x, hurt.y) <= 2) {
        const dir = facing(hurt.x - att.x, hurt.y - att.y);
        this.lastDir.set(att.id, dir);
        this.play(s, att.sprite, 'swing', dir);
      }
    }
    await this.delay(150);
    this.enemiesActing = false;
    this.sync();
  }

  // ------------------------------------------------------------------ uppdatering

  private sync() {
    const { g } = this;
    for (const a of g.state.actors) {
      let s = this.sprites.get(a.id);
      if (!a.alive) {
        if (s) {
          this.sprites.delete(a.id);
          this.tweens.add({ targets: s, alpha: 0, duration: 500, onComplete: () => s!.destroy() });
        }
        continue;
      }
      const p = toScreen(g.map, a.x, a.y);
      const tx = p.x;
      const ty = p.y - this.lift(a.x, a.y);
      if (!s) {
        s = this.makeSprite(a.sprite, tx, ty).setDepth(isoDepth(a.x, a.y, 5));
        this.sprites.set(a.id, s);
        const dir = facing(a.facing?.dx ?? 0, a.facing?.dy ?? 1);
        this.lastDir.set(a.id, dir);
        this.play(s, a.sprite, 'stance', dir);
      }
      const world = g.map.kind === 'värld';
      s.setVisible(world && a.kind === 'player' ? a.id === g.state.playerId : a.kind === 'player' || g.isVisible(a.x, a.y));
      s.setAngle(a.unconscious ? 80 : 0);
      s.setAlpha(a.hidden ? 0.5 : a.unconscious || a.down ? 0.75 : 1);
      if (s.x !== tx || s.y !== ty) {
        const dist = Math.hypot(tx - s.x, ty - s.y);
        const prev = this.pos.get(a.id) ?? a;
        const dir = facing(Math.sign(a.x - prev.x), Math.sign(a.y - prev.y));
        this.lastDir.set(a.id, dir);
        this.tweens.killTweensOf(s);
        const sprite = s;
        sprite.setDepth(Math.max(sprite.depth, isoDepth(a.x, a.y, 5)));
        if (dist > HW * 4) {
          // Långt hopp (ny karta, teleport): flytta direkt.
          sprite.setPosition(tx, ty);
        } else {
          this.play(sprite, a.sprite, 'run', dir);
          this.tweens.add({
            targets: sprite,
            x: tx,
            y: ty,
            duration: STEP_MS,
            onComplete: () => {
              sprite.setDepth(isoDepth(a.x, a.y, 5));
              this.time.delayedCall(60, () => {
                if (sprite.active && !this.tweens.isTweening(sprite)) this.play(sprite, a.sprite, 'stance', this.lastDir.get(a.id) ?? 7);
              });
            },
          });
        }
      } else if (s instanceof Phaser.GameObjects.Sprite && !s.anims.isPlaying) {
        this.play(s, a.sprite, 'stance', this.lastDir.get(a.id) ?? 7);
      }
      this.pos.set(a.id, { x: a.x, y: a.y });
    }
    this.syncBands();
    this.fadeTall();
    this.drawDark();

    const who = g.state.mode === 'combat' ? g.player : g.leader;
    const target = this.sprites.get(who.id);
    if (target && this.followId !== who.id) {
      this.followId = who.id;
      this.cameras.main.startFollow(target, true, 0.1, 0.1, 0, 20);
    }
    this.reach = g.reachableTiles();
    if (!this.enemiesActing && g.state.mode === 'combat' && !g.isPlayerTurn()) void this.runEnemies();
  }

  /** Träd och murar framför gruppen blir genomskinliga, och det som inte är utforskat syns inte. */
  private fadeTall() {
    const { g } = this;
    const near = new Set<string>();
    for (const a of g.state.actors) {
      if (!a.alive || a.kind !== 'player') continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2]]) near.add(`${a.x + dx},${a.y + dy}`);
    }
    for (const t of this.tall) {
      t.img.setVisible(!!g.state.explored[idx(g.map, t.x, t.y)]);
      t.img.setAlpha(near.has(`${t.x},${t.y}`) ? t.fade : 1);
    }
  }

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
      const p = toScreen(g.map, b.x, b.y);
      let s = this.bandSprites.get(b.id);
      if (!s) {
        const img = this.makeSprite(b.sprite, p.x, p.y);
        this.play(img, b.sprite, 'stance', 7);
        const label = this.add
          .text(p.x + 14, p.y - 6, '', { fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold', color: '#f0e6c8', stroke: '#141016', strokeThickness: 4, resolution: 2 })
          .setDepth(6002);
        s = { img, label };
        this.bandSprites.set(b.id, s);
      }
      const seen = g.isVisible(b.x, b.y);
      s.img.setVisible(seen).setDepth(isoDepth(b.x, b.y, 5));
      s.label.setVisible(seen).setText(`${b.mode === 'jagar' ? '! ' : ''}${b.members.length}`).setColor(b.mode === 'jagar' ? '#ff6a50' : '#f0e6c8');
      if (s.img.x !== p.x || s.img.y !== p.y) {
        this.tweens.add({ targets: s.img, x: p.x, y: p.y, duration: STEP_MS * 1.5 });
        this.tweens.add({ targets: s.label, x: p.x + 14, y: p.y - 6, duration: STEP_MS * 1.5 });
      }
    }
  }

  // ------------------------------------------------------------------ ljus och dimma

  private makeGlowTexture() {
    if (this.textures.exists('glow')) return;
    const c = canvas(128, 128);
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,170,80,1)');
    grad.addColorStop(0.5, 'rgba(255,140,60,0.35)');
    grad.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    this.textures.addCanvas('glow', c);
  }

  private lightSources() {
    const out: { x: number; y: number; r: number }[] = [];
    for (const a of this.g.state.actors) {
      if (!a.alive || a.kind !== 'player') continue;
      if (a.elemental?.kind === 'ljus') out.push({ x: a.x, y: a.y, r: 5 * a.elemental.grade });
      else if (!a.elemental && torchBurns(this.g, a)) out.push({ x: a.x, y: a.y, r: TORCH_RADIUS });
    }
    return out;
  }

  /** Dimman över det outforskade och mörkret i grottan, en romb per ruta, mjukat med oskärpa. */
  private drawDark() {
    const { g } = this;
    const lights = this.lightSources();
    const seesDark = g.state.mode !== 'combat' && partyDarkvision(g);
    const key = `${[...g.visible].join(',')}|${lights.map((l) => `${l.x},${l.y},${l.r}`).join(';')}|${seesDark}`;
    if (key === this.lightKey) return;
    this.lightKey = key;
    const tmp = this.darkTmp.getContext('2d')!;
    tmp.clearRect(0, 0, this.darkTmp.width, this.darkTmp.height);
    for (let y = 0; y < g.map.h; y++)
      for (let x = 0; x < g.map.w; x++) {
        const i = idx(g.map, x, y);
        const fog = g.visible.has(i) ? 0 : g.state.explored[i] ? 0.55 : 1;
        let dark = 0;
        const amb = this.cave[i] * CAVE_DARK * (seesDark ? 0.35 : 1);
        if (amb > 0) {
          let lit = 0;
          for (const l of lights) {
            const d = Math.hypot(x - l.x, y - l.y) / l.r;
            if (d < 1) lit = Math.max(lit, 1 - d * d);
          }
          dark = amb * (1 - lit * 0.92);
        }
        const a = Math.max(fog, dark);
        if (a <= 0.01) continue;
        tmp.fillStyle = `rgba(8,7,12,${a})`;
        const p = toScreen(g.map, x, y);
        diamond(tmp, p.x / MASK_SCALE, (p.y - 10) / MASK_SCALE, (HW / MASK_SCALE) * 1.08, (HH / MASK_SCALE) * 1.08);
      }
    const ctx = this.dark.getContext();
    ctx.clearRect(0, 0, this.dark.width, this.dark.height);
    ctx.filter = 'blur(2.5px)';
    ctx.drawImage(this.darkTmp, 0, 0);
    ctx.filter = 'none';
    this.dark.refresh();
    this.dark.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  update(time: number) {
    const { g } = this;
    const o = this.overlay;
    o.clear();
    const b = this.bars;
    b.clear();
    const dia = (x: number, y: number, shrink = 0.9) => {
      const p = toScreen(g.map, x, y);
      return [
        { x: p.x, y: p.y - HH * shrink },
        { x: p.x + HW * shrink, y: p.y },
        { x: p.x, y: p.y + HH * shrink },
        { x: p.x - HW * shrink, y: p.y },
      ];
    };
    if (g.isPlayerTurn() && !this.busy) {
      o.fillStyle(0x7fc8ff, 0.2);
      for (const t of this.reach) o.fillPoints(dia(t.x, t.y), true);
    }
    for (const d of g.state.dropped) {
      if (!g.isVisible(d.x, d.y)) continue;
      const p = toScreen(g.map, d.x, d.y);
      o.lineStyle(3, 0x2a2024, 1);
      o.lineBetween(p.x - 10, p.y + 4, p.x + 10, p.y - 4);
      o.lineStyle(2, 0xd8d4c8, 1);
      o.lineBetween(p.x - 10, p.y + 4, p.x + 10, p.y - 4);
    }
    for (const z of activeZones(g)) {
      const color = z.kind === 'mörker' ? 0x000000 : z.kind === 'dimma' ? 0xd8dde4 : 0x7fb8ff;
      o.fillStyle(color, z.kind === 'mörker' ? 0.5 : 0.18);
      for (let y = z.y - z.r; y <= z.y + z.r; y++) for (let x = z.x - z.r; x <= z.x + z.r; x++) o.fillPoints(dia(x, y, 1), true);
    }
    // Ringen vid fötterna på den som styrs.
    const me = this.sprites.get(g.player.id);
    if (me && g.state.party.length > 1) {
      o.lineStyle(2, 0xf0d070, 0.9);
      o.strokeEllipse(me.x, me.y, HW * 0.9, HH * 0.9);
    }
    for (const a of g.state.actors) {
      const s = this.sprites.get(a.id);
      if (!s || !s.visible || a.kp >= a.maxKp) continue;
      b.fillStyle(0x1a1418, 0.9);
      b.fillRect(s.x - 18, s.y - 74, 36, 6);
      b.fillStyle(a.kind === 'player' ? 0x5fd070 : 0xd04a3a, 1);
      b.fillRect(s.x - 17, s.y - 73, Math.max(1, Math.round((34 * a.kp) / a.maxKp)), 4);
    }
    // Facklornas sken fladdrar.
    const flicker = Math.sin(time / 130) * 0.06 + Math.sin(time / 57 + 1.3) * 0.04;
    const lights = this.lightSources();
    while (this.glows.length < lights.length) this.glows.push(this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(5001));
    this.glows.forEach((glow, n) => {
      const l = lights[n];
      const s = l && this.sprites.get(g.state.actors.find((a) => a.x === l.x && a.y === l.y && a.kind === 'player')?.id ?? '');
      if (!l || !s) {
        glow.setVisible(false);
        return;
      }
      const here = this.cave[idx(g.map, l.x, l.y)];
      glow
        .setVisible(here > 0)
        .setPosition(s.x, s.y - 30)
        .setScale((l.r * HW * 2.2) / 128, (l.r * HH * 2.2) / 128)
        .setAlpha(0.22 + flicker * 0.8);
    });
  }

  private showFx(fx: Fx) {
    const s = this.sprites.get(fx.actorId);
    if (!s) return;
    const text = this.add
      .text(s.x, s.y - 80, fx.text, { fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: FX_COLOR[fx.kind], stroke: '#141016', strokeThickness: 4, resolution: 2 })
      .setOrigin(0.5)
      .setDepth(6004);
    this.tweens.add({ targets: text, y: text.y - 30, alpha: 0, duration: 1200, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
    if (fx.kind === 'damage') this.tweens.add({ targets: s, alpha: 0.3, duration: 70, yoyo: true, repeat: 1 });
  }
}
