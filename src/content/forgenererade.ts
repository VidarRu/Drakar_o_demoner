import { newDraft, type Draft } from '../engine/creation';

/** En färdig rollperson som spelaren kan välja under "Nytt äventyr". */
export interface Pregen {
  id: string;
  title: string;
  blurb: string;
  /** Ger ett nytt utkast vid varje anrop, så att spelaren kan ändra utan att röra mallen. */
  draft: () => Draft;
}

/** Bygger ett utkast med medelvärden som slag (2T20 = 21, 1T20 = 11 och så vidare). */
function pregenDraft(fill: (d: Draft) => void): () => Draft {
  return () => {
    const d = newDraft();
    d.swordDice = 7;
    d.socialDice = 7;
    d.capitalDice = 7;
    fill(d);
    return d;
  };
}

export const PREGENS: Pregen[] = [
  {
    id: 'krigare',
    title: 'Krigaren Halvar',
    blurb: 'En tålig legoknekt som löser det mesta med yxa och sköld.',
    draft: pregenDraft((d) => {
      d.name = 'Halvar';
      d.race = 'manniska';
      d.profession = 'krigare';
      d.bought = { STY: 15, FYS: 14, SMI: 12, INT: 9, PSY: 11, KAR: 9 };
      d.profSkills = ['enhandsyxor', 'skoldar', 'bagar', 'dolkar', 'dra_vapen', 'avvapna', 'geografi', 'hasardspel', 'kulturkannedom:manniskor', 'simma', 'trastav', 'barsarkagang'];
      d.targets = { enhandsyxor: 13, skoldar: 12, dra_vapen: 10, avvapna: 8, upptacka_fara: 9, forsta_hjalpen: 7 };
      d.bought_items = { handyxa: 1, targ: 1, harnesk_tyg: 1, laderhuva: 1, fackla: 4 };
      d.equipped = { weapon: 'handyxa', shield: 'targ', armor: ['harnesk_tyg', 'laderhuva'] };
      d.appearance = 'Bredaxlad man med rödbrunt skägg och en hjälm full av bucklor.';
    }),
  },
  {
    id: 'tjuv',
    title: 'Tjuven Pippa',
    blurb: 'En liten och snabb halvlängdsman som hittar vägen in genom varje lås.',
    draft: pregenDraft((d) => {
      d.name = 'Pippa';
      d.gender = 'kvinna';
      d.race = 'halvlangdsman';
      d.profession = 'tjuv';
      d.bought = { STY: 10, FYS: 12, SMI: 13, INT: 12, PSY: 11, KAR: 10 };
      d.profSkills = ['dolkar', 'lasdyrkning', 'knopar', 'geografi', 'simma', 'undre_varlden:storstad', 'muta', 'drogkunskap', 'rakning', 'trastav', 'akrobatik', 'forfalskning'];
      d.targets = { dolkar: 10, smyga: 12, gomma_sig: 10, upptacka_fara: 9 };
      d.bought_items = { dolk: 1, fackla: 4 };
      d.equipped = { weapon: 'dolk', armor: [] };
      d.appearance = 'Liten och mörkhårig, med vaksamma ögon och fingrar som aldrig är stilla.';
    }),
  },
  {
    id: 'magiker',
    title: 'Magikern Ailin',
    blurb: 'En lärd alv som hämtar sin kraft ur eld, vind och vatten.',
    draft: pregenDraft((d) => {
      d.name = 'Ailin';
      d.gender = 'kvinna';
      d.race = 'alv';
      d.profession = 'magiker';
      d.bought = { STY: 8, FYS: 10, SMI: 10, INT: 10, PSY: 15, KAR: 8 };
      d.profSkills = ['magiskola:elementarmagi', 'kunskap_om_magi', 'alkemi', 'drogkunskap', 'geografi', 'giftkunskap', 'simma', 'zoologi', 'ortkunskap'];
      d.targets = { 'magiskola:elementarmagi': 6 };
      d.spells = ['eld', 'antimagi'];
      d.bought_items = { trastav: 1, fackla: 4 };
      d.equipped = { weapon: 'trastav', armor: [] };
      d.appearance = 'Slank alv med silvergrått hår och en stav som är täckt av små runor.';
    }),
  },
];
