import type { Game } from '../engine/game';
import { $ } from './hud';

/** Färg per kartruta på minikartan. */
const COLORS: Record<string, string> = {
  '.': '#4c6b37',
  ',': '#8a6e46',
  _: '#6e4a2a',
  ':': '#5a4c40',
  '+': '#a0743a',
  '#': '#8a8590',
  '%': '#2c282e',
  T: '#22402a',
  '~': '#2f5b82',
};

/** Liten översiktskarta i hörnet: utforskade rutor, synliga figurer och rollpersonen. */
export class Minimap {
  private readonly scale: number;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private g: Game) {
    const { map } = g;
    this.scale = map.w > 60 ? 3 : 4;
    const canvas = $<HTMLCanvasElement>('minimap-canvas');
    canvas.width = map.w * this.scale;
    canvas.height = map.h * this.scale;
    this.ctx = canvas.getContext('2d')!;
    $('minimap-name').textContent = map.name;
    g.onChange(() => this.render());
    this.render();
  }

  render() {
    const { g, ctx, scale: s } = this;
    const { map } = g;
    ctx.fillStyle = '#0b090c';
    ctx.fillRect(0, 0, map.w * s, map.h * s);
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const i = y * map.w + x;
        if (!g.state.explored[i]) continue;
        ctx.fillStyle = COLORS[map.tiles[i]] ?? '#444';
        ctx.globalAlpha = g.visible.has(i) ? 1 : 0.5;
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
    ctx.globalAlpha = 1;
    for (const a of g.state.actors) {
      if (!a.alive || a.id === g.player.id || !g.isVisible(a.x, a.y)) continue;
      ctx.fillStyle = a.hostile ? '#e0503c' : '#f0d070';
      ctx.fillRect(a.x * s, a.y * s, s, s);
    }
    const p = g.player;
    ctx.fillStyle = '#100c10';
    ctx.fillRect(p.x * s - 2, p.y * s - 2, s + 4, s + 4);
    ctx.fillStyle = '#fff4d0';
    ctx.fillRect(p.x * s - 1, p.y * s - 1, s + 2, s + 2);
  }
}
