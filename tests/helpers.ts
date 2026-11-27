import { finalize, newDraft } from '../src/engine/creation';
import type { Actor, Character } from '../src/engine/types';

/** En färdig mänsklig krigare med bredsvärd, sköld och läderharnesk, skapad enligt reglerna. */
export function testCharacter(): Character {
  const d = newDraft();
  d.name = 'Test';
  d.profession = 'krigare';
  d.bought = { STY: 14, FYS: 13, SMI: 12, INT: 10, PSY: 10, KAR: 10 };
  d.swordDice = 7;
  d.socialDice = 8;
  d.capitalDice = 12; // 2 000 sm × 1,5 för mogen ålder
  d.profSkills = [
    'enhandssvard',
    'skoldar',
    'dolkar',
    'stickvapen',
    'avvapna',
    'dra_vapen',
    'geografi',
    'hasardspel',
    'kulturkannedom:människor',
    'simma',
    'trastav',
    'barsarkagang',
  ];
  d.targets = { enhandssvard: 13, skoldar: 11, upptacka_fara: 8, overtala: 6 };
  d.bought_items = { bredsvard: 1, vanlig_skold: 1, harnesk_lader: 1 };
  d.equipped = { weapon: 'bredsvard', shield: 'vanlig_skold', armor: ['harnesk_lader'] };
  return finalize(d);
}

/** Tänder en fackla åt figuren utan att ta den ur packningen (för tester som behöver ljus). */
export function lit(a: Actor): Actor {
  a.light = { kind: 'fackla', left: 3600 };
  a.torchOut = false;
  return a;
}
