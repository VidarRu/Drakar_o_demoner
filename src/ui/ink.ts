/**
 * Handskrivna värden på rollformuläret bär `data-ink`, en nyckel som är stabil mellan ritningar.
 * Med nycklarna går det att se vad som skrivits eller ändrats mellan två ritningar.
 */

/** Nycklarna där texten är ny eller ändrad. Tomma värden i `next` räknas inte. */
export function changedInk(prev: Map<string, string>, next: Map<string, string>): string[] {
  const out: string[] = [];
  for (const [key, text] of next) if (text !== '' && prev.get(key) !== text) out.push(key);
  return out;
}

/** Läser alla handskrivna värden under `root`. */
export function readInk(root: HTMLElement): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of root.querySelectorAll<HTMLElement>('[data-ink]')) out.set(e.dataset.ink!, e.textContent ?? '');
  return out;
}
