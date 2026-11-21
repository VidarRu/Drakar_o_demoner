import type { HitLocation } from '../engine/rules';
import type { Actor } from '../engine/types';

const NS = 'http://www.w3.org/2000/svg';

/**
 * En enkel människofigur sedd framifrån, som på rollformulärets baksida. Figurens högra sida
 * är till vänster i bilden. Varje kroppsdel är en egen form så att den kan färgas efter skadan.
 */
const SHAPES: Record<HitLocation, string> = {
  huvud: 'M50 4c8 0 13 6 13 15s-5 16-13 16-13-7-13-16 5-15 13-15z',
  bröstkorg: 'M31 40c6-3 12-4 19-4s13 1 19 4l2 34H29z',
  mage: 'M29 74h42l-2 32c-6 3-12 4-19 4s-13-1-19-4z',
  'höger arm': 'M28 40c-5 1-8 5-9 11l-6 47c-1 6 0 12 3 17l6-1-1-14 8-38 1-12z',
  'vänster arm': 'M72 40c5 1 8 5 9 11l6 47c1 6 0 12-3 17l-6-1 1-14-8-38-1-12z',
  'höger ben': 'M31 106c5 3 12 4 18 4l-2 50-1 46H36l-3-46z',
  'vänster ben': 'M69 106c-5 3-12 4-18 4l2 50 1 46h10l3-46z',
};

/** Färg efter hur mycket KP som är kvar i kroppsdelen. */
function healthColor(a: Actor, loc: HitLocation): string {
  if (a.critical.includes(loc)) return '#5a0d0d';
  if (a.disabled.includes(loc) || a.locKp[loc] <= 0) return '#7a1f1f';
  const f = a.locKp[loc] / a.locMax[loc];
  if (f >= 1) return '#5f9f5a';
  if (f > 0.5) return '#c9b24a';
  return '#cf6a2e';
}

/**
 * Ritar figuren. Med `actor` färgas kroppsdelarna efter skadorna (statuspanelen), annars ritas
 * den som en tom kontur (rollformuläret).
 */
export function bodyFigure(actor?: Actor, onPick?: (loc: HitLocation) => void): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 210');
  svg.classList.add('figure');
  for (const [loc, d] of Object.entries(SHAPES) as [HitLocation, string][]) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.dataset.loc = loc;
    if (actor) {
      path.setAttribute('fill', healthColor(actor, loc));
      const title = document.createElementNS(NS, 'title');
      title.textContent = `${loc}: ${actor.locKp[loc]} av ${actor.locMax[loc]} KP${actor.bleeding.includes(loc) ? ', blöder' : ''}`;
      path.append(title);
    }
    if (onPick) path.addEventListener('click', () => onPick(loc));
    svg.append(path);
  }
  return svg;
}
