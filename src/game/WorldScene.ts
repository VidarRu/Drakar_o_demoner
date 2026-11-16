import Phaser from 'phaser';
import type { Fx, Game } from '../engine/game';
import { distance, idx, inBounds, type Point } from '../engine/map';
import type { Actor } from '../engine/types';
import { bakeGround, bakeRows, OVER, PADX, SPRITES, TILE } from './art';

const STEP_MS = 95;
const ENEMY_MS = 420;
const ZOOMS = [1, 2, 3];
/** Djup: marken 0, markeringar 5, sedan kartrader och figurer omväxlande, överst dimma och text. */
const rowDepth = (y: number) => 10 + y * 2;
const actorDepth = (y: number) => rowDepth(y) + 1;
const FX_COLOR: Record<Fx['kind'], string> = { damage: '#ff5a4a', miss: '#d8d4c8', heal: '#6fe08a', info: '#f0d070' };

/** Ritar världen och översätter klick till handlingar i spelmotorn. */
export class WorldScene extends Phaser.Scene {
  private fog!: Phaser.Textures.CanvasTexture;
  private bars!: Phaser.GameObjects.Graphics;
  private zoom = 2;
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  /** Antal steg varje figur tagit, för att växla fot i gå-animationen. */
  private steps = new Map<string, number>();
  private overlay!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Rectangle;
  private reach: Point[] = [];
  private walking = false;
  private enemiesActing = false;

  constructor(
    private g: Game,
    private onTalk: (npc: Actor) => void,
  ) {
    super('world');
  }

  get busy() {
    return this.walking || this.enemiesActing;
  }

  create() {
    const { g } = this;
    for (const [key, el] of Object.entries(SPRITES)) if (!this.textures.exists(key)) this.textures.addCanvas(key, el);

    // Marken som en enda bild, och en bild per kartrad för det som har höjd.
    const groundKey = `ground-${g.map.id}`;
    if (!this.textures.exists(groundKey)) this.textures.addCanvas(groundKey, bakeGround(g.map));
    this.add.image(0, 0, groundKey).setOrigin(0).setDepth(0);
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

    this.sync();
    cam.startFollow(this.sprites.get(g.player.id)!, true, 0.12, 0.12);

    g.onChange(() => this.sync());
    g.onFx((fx) => this.showFx(fx));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => void this.click(this.tileOf(p)));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.hover(this.tileOf(p)));
  }

  update() {
    const { g } = this;
    const o = this.overlay;
    o.clear();
    const b = this.bars;
    b.clear();
    if (g.isPlayerTurn() && !this.busy) {
      o.fillStyle(0x7fc8ff, 0.22);
      for (const t of this.reach) o.fillRect(t.x * TILE + 1, t.y * TILE + 1, TILE - 2, TILE - 2);
    }
    for (const a of g.state.actors) {
      const s = this.sprites.get(a.id);
      if (!s || !s.visible || a.kp >= a.maxKp) continue;
      b.fillStyle(0x1a1418, 0.9);
      b.fillRect(s.x - 11, s.y - 20, 22, 4);
      b.fillStyle(a.kind === 'player' ? 0x5fd070 : 0xd04a3a, 1);
      b.fillRect(s.x - 10, s.y - 19, Math.max(1, Math.round((20 * a.kp) / a.maxKp)), 2);
    }
  }

  private tileOf(p: Phaser.Input.Pointer): Point {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
  }

  private targetAt(t: Point): Actor | undefined {
    const a = this.g.actorAt(t.x, t.y);
    return a && a.id !== this.g.player.id && this.g.isVisible(t.x, t.y) ? a : undefined;
  }

  private hover(t: Point) {
    const { g } = this;
    const known = inBounds(g.map, t.x, t.y) && !!g.state.explored[idx(g.map, t.x, t.y)];
    this.cursor.setVisible(known);
    if (!known) return;
    const a = this.targetAt(t);
    this.cursor.setPosition(t.x * TILE, t.y * TILE);
    this.cursor.setStrokeStyle(1, a ? (a.hostile ? 0xff5a4a : 0xf0d070) : 0xffffff, 0.9);
    this.input.setDefaultCursor(a ? 'pointer' : 'default');
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => this.time.delayedCall(ms, () => resolve()));
  }

  private async click(t: Point) {
    const { g } = this;
    if (this.busy || !inBounds(g.map, t.x, t.y) || !g.state.explored[idx(g.map, t.x, t.y)]) return;
    const target = this.targetAt(t);

    if (g.state.mode === 'explore') {
      const path = g.pathTo(t.x, t.y, !!target);
      if (!path) return;
      await this.walk(path, (step) => g.stepPlayer(step));
      const p = g.player;
      if (target?.kind === 'npc' && g.state.mode === 'explore' && distance(p.x, p.y, target.x, target.y) <= 1) {
        this.onTalk(target);
      }
    } else if (g.isPlayerTurn()) {
      if (target?.hostile) {
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
    for (const p of path) {
      if (!step(p)) break;
      await this.delay(STEP_MS);
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
      s.setVisible(a.id === g.player.id || g.isVisible(a.x, a.y));
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

    this.reach = g.reachableTiles();
    if (!this.enemiesActing && g.state.mode === 'combat' && !g.isPlayerTurn()) void this.runEnemies();
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
