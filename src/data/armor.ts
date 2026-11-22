import type { HitLocation } from '../engine/rules/tables';
import type { ArmorDef, ShieldDef } from './types';

/**
 * Rustningar per kroppsdel och sköldar (Bok III s. 36–38). Tabellen för hela rustningar
 * används inte (se regelbeslut). Vikter gäller en normalbyggd person och justeras med
 * armorWeightPercent. Arm- och benskydd gäller per par.
 */

const HEAD: HitLocation[] = ['huvud'];
const ARMS: HitLocation[] = ['vänster arm', 'höger arm'];
const LEGS: HitLocation[] = ['vänster ben', 'höger ben'];
const TORSO: HitLocation[] = ['bröstkorg', 'mage'];

type Material = 'tyg' | 'läder' | 'nitläder' | 'härdat läder' | 'ringbrynja' | 'förstärkt ringbrynja' | 'fjällpansar' | 'lamellerad' | 'metall' | 'laminerad';
const METAL: Material[] = ['ringbrynja', 'förstärkt ringbrynja', 'fjällpansar', 'lamellerad', 'metall', 'laminerad'];
/** Fjällpansar och metallrustningar klirrar; ringbrynja räknas inte dit. */
const NOISY: Material[] = ['fjällpansar', 'lamellerad', 'metall', 'laminerad'];

function piece(
  id: string,
  name: string,
  slot: ArmorDef['slot'],
  covers: HitLocation[],
  material: Material,
  abs: number,
  weight: number,
  price: number,
  extra: Partial<ArmorDef> = {},
): ArmorDef {
  return {
    id,
    name,
    slot,
    covers,
    abs,
    weight,
    price,
    metal: METAL.includes(material),
    noisy: NOISY.includes(material),
    light: material === 'tyg' || material === 'läder',
    ...(material === 'ringbrynja' || material === 'förstärkt ringbrynja' ? { noInfection: true } : {}),
    ...extra,
  };
}

export const ARMOR_LIST: ArmorDef[] = [
  piece('tyghuva', 'Tyghuva', 'hjälm', HEAD, 'tyg', 1, 0.5, 25),
  piece('laderhuva', 'Läderhuva', 'hjälm', HEAD, 'läder', 2, 0.5, 80),
  piece('nitladerhuva', 'Nitläderhuva', 'hjälm', HEAD, 'nitläder', 3, 1, 180),
  piece('ringbrynjehuva', 'Ringbrynjehuva', 'hjälm', HEAD, 'ringbrynja', 4, 4, 300),
  piece('oppen_metallhjalm', 'Öppen metallhjälm', 'hjälm', HEAD, 'metall', 6, 4, 500),
  piece('metallhjalm_visir', 'Öppen metallhjälm med visir', 'hjälm', HEAD, 'metall', 6, 6, 1500),
  piece('tunnhjalm', 'Tunnhjälm', 'hjälm', HEAD, 'metall', 8, 6, 1000, { perceptionPenalty: -5 }),

  piece('armskydd_tyg', 'Armskydd av tjockt tyg', 'armskydd', ARMS, 'tyg', 1, 2, 50),
  piece('armskydd_lader', 'Armskydd av läder', 'armskydd', ARMS, 'läder', 2, 3, 250),
  piece('armskydd_nitlader', 'Armskydd av nitläder', 'armskydd', ARMS, 'nitläder', 3, 5, 500),
  piece('armskydd_hardat', 'Armskydd av härdat läder', 'armskydd', ARMS, 'härdat läder', 4, 3, 750),
  piece('armskydd_lamellerad', 'Lamellerade armskydd', 'armskydd', ARMS, 'lamellerad', 6, 5.5, 950),
  piece('armskydd_metall', 'Armskydd av metall', 'armskydd', ARMS, 'metall', 7, 6, 1350),
  piece('armskydd_laminerad', 'Laminerade armskydd', 'armskydd', ARMS, 'laminerad', 8, 8, 1200),

  piece('benskydd_tyg', 'Benskydd av tjockt tyg', 'benskydd', LEGS, 'tyg', 1, 3, 80),
  piece('benskydd_lader', 'Benskydd av läder', 'benskydd', LEGS, 'läder', 2, 4, 400),
  piece('benskydd_nitlader', 'Benskydd av nitläder', 'benskydd', LEGS, 'nitläder', 3, 6, 750),
  piece('benskydd_hardat', 'Benskydd av härdat läder', 'benskydd', LEGS, 'härdat läder', 4, 5, 1150),
  piece('benskydd_lamellerad', 'Lamellerade benskydd', 'benskydd', LEGS, 'lamellerad', 6, 6, 1550),
  piece('benskydd_metall', 'Benskydd av metall', 'benskydd', LEGS, 'metall', 7, 7, 1850),
  piece('benskydd_laminerad', 'Laminerade benskydd', 'benskydd', LEGS, 'laminerad', 8, 9, 1600),

  piece('harnesk_tyg', 'Harnesk av tjockt tyg', 'harnesk', TORSO, 'tyg', 1, 2, 130),
  piece('harnesk_lader', 'Läderharnesk', 'harnesk', TORSO, 'läder', 2, 3, 600),
  piece('harnesk_nitlader', 'Harnesk av nitläder', 'harnesk', TORSO, 'nitläder', 3, 4, 1150),
  piece('harnesk_hardat', 'Harnesk av härdat läder', 'harnesk', TORSO, 'härdat läder', 4, 4, 1500),
  piece('ringbrynjeskjorta', 'Ringbrynjeskjorta', 'harnesk', TORSO, 'ringbrynja', 5, 10, 1500),
  // Priset är tryckt lägre än ringbrynjeskjortans; tabellen gäller ändå (se regelbeslut).
  piece('harnesk_forstarkt', 'Harnesk av förstärkt ringbrynja', 'harnesk', TORSO, 'förstärkt ringbrynja', 6, 15, 1150),
  piece('fjallpansar', 'Fjällpansar', 'harnesk', TORSO, 'fjällpansar', 6, 14, 1500),
  piece('harnesk_lamellerad', 'Lamellerat harnesk', 'harnesk', TORSO, 'lamellerad', 6, 10, 1550),
  piece('harnesk_metall', 'Harnesk av metall', 'harnesk', TORSO, 'metall', 7, 12, 1900),
  piece('harnesk_laminerad', 'Laminerat harnesk', 'harnesk', TORSO, 'laminerad', 8, 15, 1800),

  piece('brynja', 'Ringbrynja', 'brynja', [...TORSO, ...ARMS], 'ringbrynja', 5, 16, 2000),
  piece('brynja_forstarkt', 'Förstärkt ringbrynja', 'brynja', [...TORSO, ...ARMS], 'förstärkt ringbrynja', 6, 24, 2500),
  piece('brynjehosor', 'Brynjehosor', 'brynjehosor', LEGS, 'ringbrynja', 5, 15, 2500),
  piece('brynjehosor_forstarkta', 'Förstärkta brynjehosor', 'brynjehosor', LEGS, 'förstärkt ringbrynja', 6, 22.5, 3250),
  piece('hauberk', 'Hauberk', 'hauberk', [...TORSO, ...ARMS, ...LEGS], 'ringbrynja', 5, 32, 3500),
  piece('hauberk_forstarkt', 'Förstärkt hauberk', 'hauberk', [...TORSO, ...ARMS, ...LEGS], 'förstärkt ringbrynja', 6, 48, 4500),
  piece('helrustning', 'Helrustning av metall', 'helrustning', [...TORSO, ...ARMS, ...LEGS], 'metall', 8, 25, 5100),
];

/** Ringbrynjehuva kan ingå i brynja och hauberk för detta tillägg. */
export const MAIL_HOOD_ADDON = { weight: 3, price: 200, abs: 4 };

/** Påklädning: minuter per rustningsdel (med hjälp, utan hjälp). Helrustningen är tio delar. */
export const DONNING_MINUTES = { alone: 3, helped: 2, fullPlateParts: 10 };

export const ARMOR: Record<string, ArmorDef> = Object.fromEntries(ARMOR_LIST.map((a) => [a.id, a]));

/** Husregel: rustningens brytvärde är dubbla absorberingen. */
export const armorBv = (a: Pick<ArmorDef, 'abs'>) => a.abs * 2;

export const SHIELD_LIST: ShieldDef[] = [
  { id: 'targ', name: 'Targ (bucklare)', covers: ['sköldarm'], styReq: 1, bv: 9, weight: 1, price: 500 },
  { id: 'rundskold_liten', name: 'Liten rundsköld', covers: ['sköldarm'], styReq: 3, bv: 9, weight: 2, price: 650 },
  { id: 'rundskold_stor', name: 'Stor rundsköld', covers: ['sköldarm', 'mage', 'bröstkorg'], styReq: 11, bv: 11, weight: 7, price: 1000 },
  { id: 'langskold', name: 'Långsköld (normandisk)', covers: ['sköldarm', 'bröstkorg', 'sköldben'], styReq: 7, bv: 11, weight: 6, price: 900 },
  { id: 'vanlig_skold', name: 'Vanlig sköld (trekantig)', covers: ['sköldarm', 'bröstkorg'], styReq: 7, bv: 11, weight: 6, price: 850 },
  { id: 'scutata', name: 'Scutata (romersk sköld)', covers: ['sköldarm', 'mage', 'bröstkorg'], styReq: 7, bv: 13, weight: 8, price: 1100 },
  { id: 'pavise', name: 'Pavise (bågskyttesköld)', covers: ['sköldarm', 'mage', 'bröstkorg', 'sköldben'], styReq: 18, bv: 11, weight: 16, price: 900 },
];

/** Förstärkningar av sköldar: läggs till STY-krav, BV, vikt och pris. */
export const SHIELD_UPGRADES = {
  laderoverdrag: { name: 'Läderöverdrag', styReq: 2, bv: 2, weight: 2, price: 250 },
  metallskoning: { name: 'Metallskoning', styReq: 3, bv: 3, weight: 3, price: 500 },
};

export const SHIELDS: Record<string, ShieldDef> = Object.fromEntries(SHIELD_LIST.map((s) => [s.id, s]));
