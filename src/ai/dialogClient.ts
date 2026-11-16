import { FLAG_NOTES, NPCS, PROFESSIONS } from '../content';
import type { Game } from '../engine/game';
import type { Actor } from '../engine/types';

export interface DialogEntry {
  /** 'npc' = personens replik, 'player' = spelarens replik, 'event' = något spelmotorn avgjort. */
  role: 'npc' | 'player' | 'event';
  text: string;
}

export interface DialogTurn {
  line: string;
  options: string[];
}

const ACCESS_KEY = 'dod-access-code';
export const getAccessCode = () => {
  try {
    return localStorage.getItem(ACCESS_KEY) ?? '';
  } catch {
    return '';
  }
};
export const setAccessCode = (code: string) => {
  try {
    localStorage.setItem(ACCESS_KEY, code);
  } catch {
    // Lagring avstängd.
  }
};

/**
 * Ber språkmodellen om personens nästa replik. Returnerar null om AI-tjänsten
 * inte är tillgänglig – då används den förskrivna reservdialogen.
 */
export async function requestTurn(game: Game, npc: Actor, history: DialogEntry[]): Promise<DialogTurn | null> {
  const def = NPCS[npc.npc!];
  const p = game.player;
  const notes = Object.keys(game.state.flags)
    .filter((f) => game.state.flags[f] && FLAG_NOTES[f])
    .map((f) => FLAG_NOTES[f]);
  try {
    const res = await fetch('/api/dialog', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-access-code': getAccessCode() },
      body: JSON.stringify({
        npc: { name: npc.name, persona: def.persona, knowledge: def.knowledge },
        player: {
          name: p.name,
          profession: PROFESSIONS[p.profession!].name,
          condition: p.kp >= p.maxKp ? 'oskadd' : p.kp <= p.maxKp / 2 ? 'svårt sårad' : 'lätt sårad',
          silver: p.silver,
        },
        notes,
        history: history.slice(-24),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<DialogTurn>;
    if (typeof data.line !== 'string' || !data.line.trim()) return null;
    const options = Array.isArray(data.options)
      ? data.options.filter((o): o is string => typeof o === 'string' && !!o.trim()).slice(0, 4)
      : [];
    return { line: data.line.trim(), options };
  } catch {
    return null;
  }
}

/** Förskriven reservdialog utan språkmodell. */
export function scriptedTurn(npc: Actor, history: DialogEntry[]): DialogTurn {
  const def = NPCS[npc.npc!];
  const options = def.topics.map((t) => t.text);
  const last = history[history.length - 1];
  if (!last) return { line: def.greeting, options };
  if (last.role === 'event') return { line: 'Då säger vi så.', options };
  const topic = def.topics.find((t) => t.text === last.text);
  return { line: topic ? topic.reply : 'Det vet jag inget om, är jag rädd.', options };
}
