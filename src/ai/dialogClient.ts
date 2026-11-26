import { NPCS } from '../content';
import { flagNotes } from '../engine/modules';
import { recognizes } from '../engine/hero';
import { enchanting } from '../engine/talents';
import { underSky, weatherOf, weatherText } from '../engine/weather';
import { PROFESSIONS } from '../data/professions';
import { RACES } from '../data/races';
import type { Game } from '../engine/game';
import type { Actor, NpcDef } from '../engine/types';

/**
 * Personen bakom samtalet. Ett djur som man talar med genom TALA MED VARELSE får en enkel persona:
 * det tänker som ett djur och kan bara det som ett djur vet.
 */
export function dialogDef(npc: Actor): NpcDef {
  if (npc.npc && NPCS[npc.npc]) return NPCS[npc.npc];
  return {
    id: npc.defId,
    persona: `Du är ett djur: ${npc.name.toLowerCase()}. Du tänker och talar enkelt, som ett djur, om mat, revir, faror och flocken. Du förstår inte människornas saker.`,
    knowledge: 'Du vet var du har din håla och ditt jaktområde, vilka andra djur och varelser som rör sig i trakten och var vattnet finns.',
    greeting: `${npc.name} betraktar dig vaksamt.`,
    topics: [{ text: 'Vad har du sett i trakten?', reply: 'Tvåbeningar. Lukt av rök. Fara i grottan.' }],
    intents: [],
  };
}

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
  const def = dialogDef(npc);
  const p = game.player;
  const notes = flagNotes(game);
  const leader = game.leader;
  // Vädret, om samtalet sker utomhus.
  if (underSky(game, leader)) notes.push(`Vädret just nu: ${weatherText(weatherOf(game))}.`);
  // TALA MED VARELSE: magikern talar djurens språk med FV lika med E.
  const animalTalk = leader.effects.find((e) => e.kind === 'talaMed');
  if (!npc.npc && animalTalk) notes.push(`${leader.name} talar med djuret genom magi (TALA MED VARELSE) och behärskar dess språk med FV ${animalTalk.mod ?? 1} av 20: ju lägre, desto enklare och mer bristfälligt förstår de varandra.`);
  // TANKELÄSNING: personen märker inget, men spelaren får veta vad hen tänker.
  if (npc.npc && leader.effects.some((e) => e.kind === 'tankeläsning' && e.by === npc.npc)) notes.push(`${leader.name} läser ${npc.name}s tankar med magi utan att ${npc.name} märker det. Avsluta varje replik med vad ${npc.name} egentligen tänker och döljer, inom hakparentes.`);
  // Igenkänd som hjälte (steg 8): personen vet vem rollpersonen är och har hört om hens dåd.
  if (recognizes(game, npc)) notes.push(`${npc.name} känner igen ${game.leader.name} som en ryktbar hjälte och har hört talas om hens bragder.`);
  // Bardens Förtrollande framträdande: åhörarna ser barden som mer karismatisk i en timme.
  if (enchanting(p)) notes.push(`${p.name} har nyss förtrollat sina åhörare med sång eller spel och verkar ovanligt karismatisk och övertygande.`);
  try {
    const res = await fetch('/api/dialog', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-access-code': getAccessCode() },
      body: JSON.stringify({
        npc: { name: npc.name, persona: def.persona, knowledge: def.knowledge },
        player: {
          name: p.name,
          profession: PROFESSIONS[p.profession!].name,
          race: RACES[game.char.race].name,
          appearance: game.char.appearance || undefined,
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
  const def = dialogDef(npc);
  const options = def.topics.map((t) => t.text);
  const last = history[history.length - 1];
  if (!last) return { line: def.greeting, options };
  if (last.role === 'event') return { line: 'Då säger vi så.', options };
  const topic = def.topics.find((t) => t.text === last.text);
  return { line: topic ? topic.reply : 'Det vet jag inget om, är jag rädd.', options };
}
