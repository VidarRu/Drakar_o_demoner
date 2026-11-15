import Phaser from 'phaser';
import type { Fx, Game } from '../engine/game';
import { distance, idx, inBounds, type Point } from '../engine/map';
import type { Actor } from '../engine/types';
import { TEXTURES, TILE, tileTexture } from './art';

const STEP_MS = 95;
const ENEMY_MS = 420;
const FX_COLOR: Record<Fx['kind'], string> = { damage: '#ff5a4a', miss: '#d8d4c8', heal: '#6fe08a', info: '#f0d070' };

/** Ritar världen och översätter klick till handlingar i spelmotorn. */
export class WorldScene extends Phaser.Scene {
  private fog: Phaser.GameObjects.Rectangle[] = [];
  private sprites = new Map<string, Phaser.GameObjects.Image>();
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
    for (const [key, el] of Object.entries(TEXTURES)) this.textures.addCanvas(key, el);

    for (let y = 0; y < g.map.h; y++) {
      for (let x = 0; x < g.map.w; x++) {
        this.add.image(x * TILE, y * TILE, tileTexture(g.map.tiles[idx(g.map, x, y)], x, y)).setOrigin(0);
        this.fog.push(this.add.rectangle(x * TILE, y * TILE, TILE, TILE, 0x08070a).setOrigin(0).setDepth(10));
      }
    }
    this.overlay = this.add.graphics().setDepth(4);
    this.cursor = this.add
      .rectangle(0, 0, TILE, TILE)
      .setOrigin(0)
      .setStrokeStyle(1, 0xffffff, 0.8)
      .setDepth(11)
      .setVisible(false);

    const cam = this.cameras.main;
    cam.setBounds(-TILE * 4, -TILE * 4, (g.map.w + 8) * TILE, (g.map.h + 8) * TILE);
    const fitZoom = () => cam.setZoom(this.scale.width < 720 ? 2 : 3);
    fitZoom();
    this.scale.on('resize', fitZoom);

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
    if (g.isPlayerTurn() && !this.busy) {
      o.fillStyle(0x7fc8ff, 0.22);
      for (const t of this.reach) o.fillRect(t.x * TILE + 1, t.y * TILE + 1, TILE - 2, TILE - 2);
    }
    for (const a of g.state.actors) {
      const s = this.sprites.get(a.id);
      if (!s || !s.visible || a.kp >= a.maxKp) continue;
      o.fillStyle(0x1a1418, 0.9);
      o.fillRect(s.x - 6, s.y - 11, 12, 2);
      o.fillStyle(a.kind === 'player' ? 0x5fd070 : 0xd04a3a, 1);
      o.fillRect(s.x - 6, s.y - 11, Math.max(1, Math.round((12 * a.kp) / a.maxKp)), 2);
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
    this.fog.forEach((rect, i) => rect.setAlpha(g.visible.has(i) ? 0 : g.state.explored[i] ? 0.55 : 1));

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
        s = this.add.image(tx, ty, a.sprite).setDepth(5);
        this.sprites.set(a.id, s);
      }
      s.setVisible(a.id === g.player.id || g.isVisible(a.x, a.y));
      if (s.x !== tx || s.y !== ty) {
        if (tx !== s.x) s.setFlipX(tx < s.x);
        this.tweens.killTweensOf(s);
        this.tweens.add({ targets: s, x: tx, y: ty, duration: STEP_MS });
      }
    }

    this.reach = g.reachableTiles();
    if (!this.enemiesActing && g.state.mode === 'combat' && !g.isPlayerTurn()) void this.runEnemies();
  }

  private showFx(fx: Fx) {
    const s = this.sprites.get(fx.actorId);
    if (!s) return;
    const text = this.add
      .text(s.x, s.y - 10, fx.text, {
        fontFamily: 'Georgia, serif',
        fontSize: '7px',
        fontStyle: 'bold',
        color: FX_COLOR[fx.kind],
        stroke: '#141016',
        strokeThickness: 2,
        resolution: 4,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: text, y: text.y - 14, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
    if (fx.kind === 'damage') {
      this.tweens.add({ targets: s, alpha: 0.3, duration: 70, yoyo: true, repeat: 1 });
    }
  }
}
