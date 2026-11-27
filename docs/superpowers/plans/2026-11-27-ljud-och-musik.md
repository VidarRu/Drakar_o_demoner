# Ljud och musik: plan för bygget

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mål:** Spelet får ljudeffekter och bakgrundsmusik från Flare genom en egen ljudmodul som lyssnar på motorns händelser.

**Arkitektur:** Motorn skickar ljudsignaler (`Cue`) med `Game.cue`, på samma sätt som `emit` skickar `Fx`. Signalen säger vad som hände, inte vilket ljud som ska spelas. `src/audio/` väljer ljud och musik med rena funktioner som går att testa (`sounds.ts`, `music.ts`) och spelar upp dem med Web Audio och `<audio>` (`player.ts`). `index.ts` kopplar ihop allt med spelet och startskärmen.

**Teknik:** TypeScript, Vite, Vitest, Web Audio API, `HTMLAudioElement`, ffmpeg (bara i verktyget).

**Spec:** `docs/superpowers/specs/2026-11-27-ljud-och-musik-design.md`

## Globala krav

- All text i spelet, koden, kommentarerna och commit-meddelandena är på svenska.
- Ingen text ur regelböckerna.
- `src/engine/` importerar ingenting från `src/audio/` och känner inte till ljud.
- Format: MP3. Ljudeffekter i mono med 64 kbit/s, musik i stereo med 96 kbit/s.
- Förval: ljudet 0,7, musiken 0,5, inte tyst. Inställningarna sparas under nyckeln `dod-ljud`.
- Musiken tonar över på 2000 ms och byter först när valet har varit detsamma i 1000 ms.
- Upphovspersoner och licens (CC BY-SA 3.0) står i `public/audio/CREDITS.md`.
- Kör `npm test` och `npx tsc --noEmit` före varje commit. Commit-meddelandena slutar med raderna:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` och
  `Claude-Session: https://claude.ai/code/session_01UYAnmwDYewuoZQLUYstZbk`.

## Vad som måste hålla

1. **Webbläsaren tillåter inte ljud förrän man har klickat.** Ingenting får kasta, och musiken börjar vid första klicket eller tangenttrycket. Test: `AudioEngine` utan `AudioContext` (Node) kastar inte på `play` och `playMusic` (uppgift 5).
2. **En fil går inte att ladda** (404, avkodningsfel). Det ska vara tyst, utan ohanterade avvisade löften. Test: `play` med en `fetch` som avvisar ger ingen ohanterad avvisning (uppgift 5).
3. **Många signaler på en gång**, till exempel en besvärjelse som skadar flera eller många fiendeturer i rad. Högst 8 ljud samtidigt, och samma fil spelas inte två gånger inom 50 ms. Test: `VoiceLimit` (uppgift 5).
4. **Lagringen är avstängd eller innehåller skräp.** Då gäller förvalen. Test: `loadSettings` med en lagring som kastar och en med trasig JSON (uppgift 5).
5. **Musiken fladdrar** vid grottmynningen eller vid snabba byten mellan lägen. Test: `Settle` byter först efter 1000 ms med samma val (uppgift 5).

---

### Task 1: Omkodningen och upphovspersonerna

**Filer:**
- Skapa: `tools/flare_audio.py`
- Skapa: `public/audio/flare/sfx/**.mp3` och `public/audio/flare/music/*.mp3` (verktygets utdata)
- Skapa: `public/audio/CREDITS.md`

**Gränssnitt:**
- Ger: ljudeffekterna på `public/audio/flare/sfx/<sökväg i soundfx utan .ogg>.mp3`, till exempel `sfx/steps/step_cloth1.mp3` och `sfx/melee_attack.mp3`. Musiken på `public/audio/flare/music/<namn>.mp3`, till exempel `music/battle_theme.mp3`.

- [ ] **Steg 1: Hämta Flare**

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/flareteam/flare-game.git <scratchpad>/flare-game
cd <scratchpad>/flare-game && git sparse-checkout set mods/fantasycore/soundfx mods/fantasycore/music
```

- [ ] **Steg 2: Skriv `tools/flare_audio.py <sökväg till flare-game/mods/fantasycore>`**

Skriptet ska ha en docstring i samma stil som `tools/flare_art.py`. Det kodar om alla `.ogg` under `soundfx/` utom katalogen `npcs/`, och alla stycken i `music/` utom `wind_ambient.ogg`. Det anropar ffmpeg med `subprocess.run(check=True)`.
- Ljudeffekter: `-ac 1 -b:a 64k -af silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse`.
- Musik: `-ac 2 -b:a 96k`.
- Alla anrop har `-y -loglevel error`.
- Till sist skrivs antalet filer och den totala storleken ut.

- [ ] **Steg 3: Kör skriptet och kontrollera resultatet**

Kör: `python3 tools/flare_audio.py <scratchpad>/flare-game/mods/fantasycore && find public/audio/flare -name '*.mp3' | wc -l && du -sh public/audio/flare/*`

Väntat: drygt 100 ljudeffekter, 11 musikstycken, ljudeffekterna under 2 MB och musiken runt 25–30 MB.

- [ ] **Steg 4: Skriv `public/audio/CREDITS.md`**

Samma uppställning som `public/art/CREDITS.md`, med:
- rubriken "Ljud och musik från andra: upphovspersoner och licenser",
- att ljud och musik kommer från Flare (flare-game, modulen `fantasycore`) och är omkodade till MP3 av `tools/flare_audio.py`,
- licensen CC BY-SA 3.0 med länk, och att bearbetningarna delas under samma licens,
- musiken av Brandon Morris "Augmentality",
- att ljuden enligt Flares `CREDITS.txt` bygger på fritt licensierat material av bland andra Ljudbank och Mike Koenig, och att Flares egna upphovspersoner står i `public/art/CREDITS.md`.

- [ ] **Steg 5: Commit**

```bash
git add tools/flare_audio.py public/audio
git commit -m "Ljud och musik ur Flare, omkodade till MP3"
```

---

### Task 2: Motorns ljudsignaler

**Filer:**
- Ändra: `src/engine/game.ts` (typen `Cue`, `onCue`, `cue`; `sleep`, `stepPlayer`, `combatStep`)
- Ändra: `src/engine/combat.ts` (`attackOnce`, `shoot`, `wound`, `kill`, `startCombat`, `endCombat`)
- Ändra: `src/engine/magic.ts` (`resolve`)
- Ändra: `src/engine/light.ts` (`toggleLight`)
- Ändra: `src/engine/worldmap.ts` (`travelStep`, `makeCamp`)
- Ändra: `src/engine/locks.ts` (`pickLock`, `forceLock`, `lootChest`, `magicOpen`)
- Ändra: `src/engine/inventory.ts` (`equip`, `stow`, `wearArmor`, `removeArmor`)
- Ändra: `src/engine/trade.ts` (`buy`, `sell`)
- Ändra: `src/engine/talents.ts` (`bodyControl`, `layOnHands`, `perform`; `perform` gäller både barden och munkens Meditera)
- Ändra: `src/engine/time.ts` (`raiseSkill`, `selfTrain`), `src/engine/hero.ts` (`raiseAttribute`), `src/engine/progress.ts` (`runWeek`)
- Test: `tests/cues.test.ts`

**Gränssnitt:**
- Ger (i `src/engine/game.ts`):

```ts
export type Cue =
  | { type: 'anfall'; actorId: string; targetId: string; weapon: string; natural: boolean; result: 'träff' | 'parerat' | 'miss' | 'fummel' }
  | { type: 'skott'; actorId: string; targetId: string; weapon: string; result: 'träff' | 'miss' | 'fummel' }
  | { type: 'skada'; actorId: string }
  | { type: 'död'; actorId: string }
  | { type: 'besvärjelse'; actorId: string; spell: string; result: 'lyckas' | 'misslyckas' | 'snedtändning' }
  | { type: 'förmåga'; actorId: string; ability: 'kroppskontroll' | 'handpåläggning' | 'framträdande' }
  | { type: 'steg'; actorId: string }
  | { type: 'ljus'; actorId: string; lit: boolean }
  | { type: 'vila'; how: 'sömn' | 'läger' }
  | { type: 'strid'; phase: 'börjar' | 'slutar' }
  | { type: 'lås'; kind: 'dörr' | 'kista'; how: 'dyrkat' | 'brutet' | 'öppnat' | 'misslyckat' }
  | { type: 'packning'; item: string; how: 'utrustat' | 'undanlagt' | 'köpt' | 'sålt' }
  | { type: 'träning'; actorId: string };
// i klassen Game:
onCue(fn: (c: Cue) => void): void
cue(c: Cue): void
sleep(hours = 8, how: 'sömn' | 'läger' = 'sömn'): void
```

Var signalerna skickas:
- `attackOnce`: det exporterade `attackOnce` anropar den nuvarande kroppen (döpt om till `attackInner`) och skickar `anfall` med resultatet, utom när det är `'ingen'`. `weapon` är `WeaponInfo.id` och `natural` är `WeaponInfo.natural`.
- `shoot`: `skott` vid fummel, miss (även virvelskölden) och träff.
- `wound`: `skada` när `dmg > 0`, efter att KP har dragits.
- `kill`: `död` först, innan något annat händer (också för rollpersonen).
- `resolve` i `magic.ts`: `besvärjelse` i var och en av de tre grenarna.
- `toggleLight`: `ljus` med `lit: false` när ljuset släcks och `lit: true` när det tänds.
- `Game.sleep`: `vila` med `how`. `makeCamp` anropar `g.sleep(TRAVEL.camp.hours, 'läger')`.
- `startCombat`: `strid` med `phase: 'börjar'`, sist i funktionen. `endCombat`: `phase: 'slutar'`.
- `stepPlayer`, `combatStep` och `travelStep`: `steg` för den som flyttades (ledaren respektive `g.player`), när steget blev av.
- `pickLock` och `forceLock`: `lås` med `dyrkat`, `brutet` eller `misslyckat`. `lootChest` och `magicOpen`: `öppnat`.
- `equip` och `wearArmor`: `utrustat`. `stow` och `removeArmor`: `undanlagt`. `buy`: `köpt`. `sell`: `sålt`. Signalerna skickas bara när det lyckas. `item` är föremålets id.
- `bodyControl`, `layOnHands` och `perform`: `förmåga`, bara när det lyckas.
- `raiseSkill`, `selfTrain` och `raiseAttribute`: `träning`, bara när det lyckas. `runWeek`: en `träning` per gruppmedlem som höjde något.

- [ ] **Steg 1: Skriv de misslyckade testerna i `tests/cues.test.ts`**

Varje test skapar `Game.create(testCharacter(), seededRng(n))`, samlar signalerna med `g.onCue((c) => cues.push(c))` och styr tärningarna med `queue` och `face` som i `tests/talents.test.ts`.

```ts
it('anfall som träffar ger anfall och skada', () => {
  // foeNextTo + turnOf som i talents.test.ts, tärningar så att anfallet lyckas och pareringen misslyckas
  combat.playerAttack(g, foe);
  expect(cues).toContainEqual(expect.objectContaining({ type: 'anfall', actorId: g.player.id, targetId: foe.id, result: 'träff' }));
  expect(cues).toContainEqual({ type: 'skada', actorId: foe.id });
});
it('anfall som missar ger miss och ingen skada', () => { /* result: 'miss', ingen 'skada' */ });
it('parerat anfall ger parerat', () => { /* result: 'parerat' */ });
it('striden börjar och slutar', () => {
  combat.startCombat(g, [foe]);
  expect(cues.at(-1)).toEqual({ type: 'strid', phase: 'börjar' });
  combat.endCombat(g, 'Slut.');
  expect(cues).toContainEqual({ type: 'strid', phase: 'slutar' });
});
it('död skickas när en varelse dör', () => { combat.kill(g, foe); expect(cues).toContainEqual({ type: 'död', actorId: foe.id }); });
it('besvärjelse som lyckas', () => { /* castSpell med en minnesbesvärjelse utanför strid, result: 'lyckas', spell: id */ });
it('facklan tänds och släcks', () => {
  toggleLight(g, g.player); // tänd från början: släcks
  expect(cues.at(-1)).toEqual({ type: 'ljus', actorId: g.player.id, lit: false });
  toggleLight(g, g.player);
  expect(cues.at(-1)).toEqual({ type: 'ljus', actorId: g.player.id, lit: true });
});
it('sömn och läger', () => { g.sleep(); expect(cues).toContainEqual({ type: 'vila', how: 'sömn' }); });
it('ett steg ger en signal, ett stopp ingen', () => {
  // stepPlayer till en ledig grannruta: { type: 'steg', actorId: g.leader.id }; till en vägg: inga nya signaler
});
it('utrusta och lägga undan', () => { /* stow('weapon') ger undanlagt, equip(id, 'weapon') ger utrustat med item */ });
```

- [ ] **Steg 2: Kör testerna och se dem misslyckas**

Kör: `npx vitest run tests/cues.test.ts`
Väntat: FAIL. `onCue` finns inte.

- [ ] **Steg 3: Lägg till `Cue`, `onCue` och `cue` i `Game` och skicka signalerna på platserna ovan**

`cue` anropar lyssnarna i en `try`, så att ett fel i ljudet aldrig stoppar motorn.

- [ ] **Steg 4: Kör testerna och se dem gå igenom**

Kör: `npm test && npx tsc --noEmit`
Väntat: alla tester går igenom, och inga typfel.

- [ ] **Steg 5: Commit**

```bash
git add src/engine tests/cues.test.ts
git commit -m "Ljudsignaler från motorn"
```

---

### Task 3: Musikvalet

**Filer:**
- Ändra: `src/engine/map.ts` (`MusicTheme`, `MapDef.music`, `GameMap.music`, `parseMap`)
- Ändra: `src/engine/types.ts` (`CreatureDef.boss`)
- Ändra: `src/content/speltest/index.ts` (Gråvad `music: 'by'`, Grukk `boss: true`), `src/content/provfard/index.ts` (Hagby `music: 'by'`)
- Skapa: `src/audio/music.ts`
- Test: `tests/audio.test.ts`

**Gränssnitt:**
- Ger:

```ts
// src/engine/map.ts
export type MusicTheme = 'värld' | 'by' | 'skog' | 'grotta' | 'fängelsehåla' | 'trygg' | 'magisk';
// MapDef.music?: MusicTheme; GameMap.music: MusicTheme | null
// src/engine/types.ts: CreatureDef.boss?: boolean
// src/audio/music.ts
export type MusicId = MusicTheme | 'titel' | 'strid' | 'boss' | 'oro';
export const MUSIC: Record<MusicId, string>; // MusicId -> fil under music/, utan .mp3
export function musicFor(g: Game | null): MusicId;
```

`MUSIC`: `titel: 'title_theme'`, `värld: 'overworld_theme'`, `by: 'town_theme'`, `skog: 'forest_theme'`, `grotta: 'cave_theme'`, `fängelsehåla: 'dungeon_theme'`, `trygg: 'safe_room_theme'`, `magisk: 'magical_theme'`, `strid: 'battle_theme'`, `boss: 'boss_theme'`, `oro: 'unrest_theme'`.

`musicFor` väljer i den här ordningen:
1. `null` ger `'titel'`.
2. Läget `'dead'` ger `'oro'`, och `'ended'` ger `'trygg'`.
3. Läget `'combat'` ger `'boss'` om någon levande fiende i `participants(g)` har `CREATURES[a.defId]?.boss`, annars `'strid'`.
4. Rutan under `g.leader`: `':'` (grottgolv) ger `'grotta'`, och `'_'` (trägolv) ger `'trygg'`.
5. Annars `g.map.music`, och utan den `'värld'` för en världskarta och `'magisk'` för en mötesplats.

- [ ] **Steg 1: Skriv de misslyckade testerna i `tests/audio.test.ts`**

```ts
it('titelmusik utan spel', () => expect(musicFor(null)).toBe('titel'));
it('Gråvad är by, grottgolvet grotta, värdshuset tryggt', () => {
  const g = Game.create(testCharacter(), seededRng(1));
  expect(musicFor(g)).toBe('by');
  // flytta g.leader till en ':'-ruta och sedan en '_'-ruta: 'grotta', 'trygg'
});
it('strid och boss', () => { /* startCombat mot en svartalf ger 'strid'; mot svartalfshovding ger 'boss' */ });
it('världskartan i Provfärden', () => { /* Game.create(..., 'provfard') ger 'värld' */ });
it('död och mellan äventyren', () => { /* state.mode = 'dead' ger 'oro'; 'ended' ger 'trygg' */ });
it('varje musikfil finns', () => {
  for (const f of Object.values(MUSIC)) expect(existsSync(`public/audio/flare/music/${f}.mp3`)).toBe(true);
});
```

- [ ] **Steg 2: Kör testerna och se dem misslyckas**

Kör: `npx vitest run tests/audio.test.ts`
Väntat: FAIL. Modulen `src/audio/music` finns inte.

- [ ] **Steg 3: Lägg till fälten, innehållet och `musicFor`**

- [ ] **Steg 4: Kör testerna och se dem gå igenom**

Kör: `npm test && npx tsc --noEmit`
Väntat: alla tester går igenom.

- [ ] **Steg 5: Commit**

```bash
git add src/engine/map.ts src/engine/types.ts src/content src/audio/music.ts tests/audio.test.ts
git commit -m "Musiken väljs efter läge, ruta och karta"
```

---

### Task 4: Ljudtabellen

**Filer:**
- Skapa: `src/audio/sounds.ts`
- Test: `tests/audio.test.ts` (fler tester)

**Gränssnitt:**
- Använder: `Cue` och `Game` (uppgift 2), `MELEE_WEAPONS` (`src/data/weapons.ts`), `ARMOR` (`src/data/armor.ts`), `SPELLS` (`src/data/spells.ts`), `itemInfo` (`src/engine/inventory.ts`), `g.charOf`, `g.actor`, `g.map.tiles`.
- Ger:

```ts
export interface SoundPick { file: string; volume: number; rate: number } // file: sökväg under sfx/, utan .mp3
export const SFX: Record<string, string[]>;   // namngivna grupper, se tabellen
export const SFX_FILES: string[];             // Object.values(SFX).flat() utan dubletter
export function soundFor(g: Game, cue: Cue, rng?: () => number): SoundPick[];
```

Grupperna i `SFX` och vilka signaler som använder dem (filnamnen enligt designens tabell):

| Grupp | Filer | Används för |
| --- | --- | --- |
| `hugg` | `melee_attack`, `melee_attack_2`, `melee_attack_3` | `anfall` (alla utfall utom fummel) |
| `parera` | `powers/block` | `anfall` med `parerat`, efter hugget |
| `skott` | `powers/shoot` | `skott` |
| `fummel` | `no_mana` | `anfall` och `skott` med `fummel` |
| `manTraff`, `kvinnaTraff`, `manDor`, `kvinnaDor` | `male_hit` … | `skada` och `död` för personer |
| `svartalf`, `skelett`, `zombie`, `stor` (träff och död) | `enemies/goblin_hit`, `goblin_die` … `minotaur_` | `skada` och `död` för varelser |
| `eld`, `blixt`, `kold`, `lak`, `skydd`, `flytt`, `jord`, `sinne` | `powers/fireball`+`burn`, `shock`+`thunder`, `freeze`, `heal`, `shield`, `teleport`, `spikes`+`quake`, `timestop` | `besvärjelse` med `lyckas` |
| `misslyckad` | `no_mana` | `besvärjelse` med `misslyckas` eller `snedtändning` |
| `stridsrop` | `powers/warcry` | `förmåga` (utom handpåläggning, som använder `lak`), `strid` med `börjar` |
| `steg_tyg`, `steg_lader`, `steg_metall`, `steg_eko` | `steps/step_cloth1`–`4` … | `steg` |
| `dorr`, `kista` | `door_open`, `wood_open` | `lås` och steg in på en dörr (`'+'`) |
| `eld_tand` | `environment/open_fire` | `ljus` med `lit: true` och `vila` |
| `metall`, `lader`, `tyg`, `dryck`, `bok`, `mynt`, `foremal` | `inventory/inventory_metal` … `inventory_coins`, `inventory_object` | `packning` (`köpt` och `sålt` lägger till `mynt`), `strid` med `börjar` (`metall`) |
| `niva` | `level_up` | `träning` |
| `knapp` | `widget_activate` | knappar (uppgift 5) |

Regler i `soundFor`:
- En fil väljs slumpmässigt ur gruppen med `rng`. `rate` är gruppens grundton × (0,95 + 0,1 × `rng()`).
- **Grundton för hugg:** vapengruppen `kross` och `yxa` ger 0,85, `dolkar` 1,15 och allt annat 1. `natural` ger 0,9.
- **Vilken besvärjelse:** först en tabell per besvärjelse-id i `sounds.ts`. Den har `eld`, `explosion`, `flammande_hand` och `traeld` (eld), `blixt` och `nedkalla_askvigg` (blixt), `frost` (köld) och `ortrankor` (jord). Id:na bildas av namnen i `spell()` i `src/data/spells.ts`. Sedan `effect.kind`:
  - `läka` och `motgift` ger `lak`,
  - `skydd`, `antimagi`, `beskyddare`, `virvelsköld` och `luftsköld` ger `skydd`,
  - `teleportera`, `språng`, `levitation`, `flyga` och `lyft` ger `flytt`,
  - `köld` ger `kold`.
  - Sist skolan: `elementarmagi` ger `eld`, `animism` ger `jord`, och `mentalism` och `allmän` ger `sinne`.
- **Person eller varelse:** `g.charOf(a)` ger könet. Annars väljs efter `a.sprite`: `svartalf`, `hovding` och `haxkonstnar` ger `svartalf`, `bjorn` ger `stor` med grundton 0,8, `varg` ger `svartalf` med grundton 0,8, och `knekt`, `vard`, `smed` och `gumma` ger `manTraff` (`gumma` ger `kvinnaTraff`). Allt annat ger `svartalf` med grundton 0,8.
- **Steg:** grottgolv (`':'`) ger `steg_eko`. Annars ger en rustningsdel med `metal` `steg_metall`, en utan `light` `steg_lader`, och annars `steg_tyg`. Volymen är 0,35. Står figuren på `'+'` läggs `dorr` till.
- **Volym:** `steg` 0,35, `knapp` 0,3, allt annat 1.

- [ ] **Steg 1: Skriv de misslyckade testerna**

```ts
it('varje ljudfil finns', () => {
  for (const f of SFX_FILES) expect(existsSync(`public/audio/flare/sfx/${f}.mp3`), f).toBe(true);
});
it('anfall med stridshammare har lägre ton än med dolk', () => { /* rng = () => 0.5; jämför rate */ });
it('parerat anfall ger hugg och block', () => { /* filerna: en ur hugg, sedan powers/block */ });
it('ELD ger eld, FROST köld, HELA läkning och en mentalistisk besvärjelse sinne', () => { /* besvärjelse-signaler */ });
it('stegen följer rustningen och grottan', () => {
  // testCharacter utan rustning: steg_tyg; med en metallrustning i a.armor: steg_metall; på ':' : steg_eko
});
it('kvinnlig rollperson låter som kvinna', () => { /* ch.gender = 'kvinna'; skada ger female_hit */ });
it('striden börjar ger stridsrop och metall', () => { /* två SoundPick */ });
it('alla signaler ger minst ett ljud', () => { /* en signal av varje typ; soundFor(...).length > 0 */ });
```

- [ ] **Steg 2: Kör testerna och se dem misslyckas**

Kör: `npx vitest run tests/audio.test.ts`
Väntat: FAIL. Modulen `src/audio/sounds` finns inte.

- [ ] **Steg 3: Skriv `src/audio/sounds.ts`**

- [ ] **Steg 4: Kör testerna och se dem gå igenom**

Kör: `npm test && npx tsc --noEmit`
Väntat: alla tester går igenom.

- [ ] **Steg 5: Commit**

```bash
git add src/audio/sounds.ts tests/audio.test.ts
git commit -m "Ljudtabellen: signal till Flare-ljud"
```

---

### Task 5: Uppspelningen, inställningarna och ljudknappen

**Filer:**
- Skapa: `src/audio/settings.ts`, `src/audio/player.ts`, `src/audio/index.ts`
- Ändra: `src/main.ts`, `index.html`, `src/ui/style.css`
- Test: `tests/audioplayer.test.ts`

**Gränssnitt:**
- Använder: `soundFor`, `SoundPick` (uppgift 4), `musicFor`, `MUSIC`, `MusicId` (uppgift 3), `Game.onCue`, `onChange`, `onMapChange` (uppgift 2).
- Ger:

```ts
// settings.ts
export interface AudioSettings { sfx: number; music: number; muted: boolean }
export const DEFAULT_SETTINGS: AudioSettings; // { sfx: 0.7, music: 0.5, muted: false }
export function loadSettings(storage?: Pick<Storage, 'getItem'>): AudioSettings;      // nyckeln 'dod-ljud'
export function saveSettings(s: AudioSettings, storage?: Pick<Storage, 'setItem'>): void;
// player.ts
export class VoiceLimit { constructor(max = 8, gapMs = 50); admit(file: string, now: number): boolean; release(): void }
export class Settle<T> { constructor(holdMs = 1000); push(value: T, now: number): T | null } // ger värdet när det har varit detsamma i holdMs, annars null
export class AudioEngine {
  constructor(base = '/audio/flare/');
  unlock(): void;                 // skapar och återupptar AudioContext; startar musiken som väntar
  play(p: SoundPick): void;       // sfx/<file>.mp3 via fetch + decodeAudioData, cache per fil
  playMusic(id: MusicId): void;   // music/<MUSIC[id]>.mp3 i ett <audio loop>, tonar över på 2000 ms
  apply(s: AudioSettings): void;
  readonly musicId: MusicId | null;
}
// index.ts
export const audio: AudioEngine;
export function mountAudio(): void;          // startskärmen: titelmusik, upplåsning, ljudknappen
export function attachAudio(game: Game): void;
```

Regler:
- `AudioEngine` rör inte `window`, `AudioContext` eller `Audio` förrän `unlock`, `play` eller `playMusic` anropas. Finns de inte gör metoderna ingenting.
- Varje `fetch` och `decodeAudioData` har `.catch(() => {})`. En fil som misslyckas markeras och försöks inte igen.
- `play` frågar `VoiceLimit.admit` och anropar `release` när ljudet tar slut (`onended`).
- `playMusic` före `unlock` sparar bara valet.
- `mountAudio` lyssnar på första `pointerdown` och `keydown` på `document` (med `{ once: true }`) och anropar `unlock`. Den spelar `'titel'`, lägger till ljudknappen och spelar `knapp` med volymen 0,3 vid klick på `button`-element.
- `attachAudio` kopplar `onCue` till `soundFor` och `play`. Den kopplar `onChange` och `onMapChange` till `Settle.push(musicFor(game), performance.now())` och kontrollerar igen med en `setTimeout` på 1000 ms, så att bytet blir av även utan fler händelser.
- **Ljudknappen:** `<button id="ljud">` med ♪ i ett hörn som inte täcker porträttkolumnen, minikartan eller loggen. Den öppnar en liten panel med reglagen "Ljud" och "Musik" (`input type=range`, 0–100) och kryssrutan "Tyst". Varje ändring anropar `apply` och `saveSettings`. Stilen följer `src/ui/style.css`.
- `main.ts`: `mountAudio()` direkt när sidan laddas, och `attachAudio(game)` i `launch`. `audio` läggs till i `Object.assign(window, …)`.

- [ ] **Steg 1: Skriv de misslyckade testerna i `tests/audioplayer.test.ts`**

```ts
it('förvalen när lagringen kastar eller har skräp', () => {
  expect(loadSettings({ getItem: () => { throw new Error('av'); } })).toEqual(DEFAULT_SETTINGS);
  expect(loadSettings({ getItem: () => '{trasig' })).toEqual(DEFAULT_SETTINGS);
  expect(loadSettings({ getItem: () => JSON.stringify({ sfx: 0.2 }) })).toEqual({ ...DEFAULT_SETTINGS, sfx: 0.2 });
});
it('VoiceLimit släpper inte in fler än 8 eller samma fil inom 50 ms', () => {
  const v = new VoiceLimit();
  expect(v.admit('a', 0)).toBe(true);
  expect(v.admit('a', 10)).toBe(false);
  expect(v.admit('a', 60)).toBe(true);
  // 8 olika filer släpps in, den nionde inte, och efter release släpps en till in
});
it('Settle byter först efter 1000 ms med samma val', () => {
  const s = new Settle<string>();
  expect(s.push('by', 0)).toBe(null);
  expect(s.push('grotta', 500)).toBe(null);
  expect(s.push('grotta', 1400)).toBe(null);
  expect(s.push('grotta', 1500)).toBe('grotta');
  expect(s.push('grotta', 1600)).toBe(null); // redan bytt
});
it('AudioEngine utan webbläsare kastar inte', () => {
  const e = new AudioEngine();
  expect(() => { e.unlock(); e.play({ file: 'melee_attack', volume: 1, rate: 1 }); e.playMusic('strid'); }).not.toThrow();
});
it('en fil som inte går att hämta ger ingen ohanterad avvisning', async () => {
  // stubba globalThis.fetch = () => Promise.reject(new Error('404')) och en minimal AudioContext; play; vänta en mikrotask; inget 'unhandledRejection'
});
```

- [ ] **Steg 2: Kör testerna och se dem misslyckas**

Kör: `npx vitest run tests/audioplayer.test.ts`
Väntat: FAIL. Modulerna finns inte.

- [ ] **Steg 3: Skriv `settings.ts`, `player.ts` och `index.ts`, och koppla in dem i `main.ts`, `index.html` och `style.css`**

- [ ] **Steg 4: Kör testerna och se dem gå igenom**

Kör: `npm test && npx tsc --noEmit`
Väntat: alla tester går igenom.

- [ ] **Steg 5: Provkör i webbläsaren**

Starta `npx vite` och styr sidan med Playwright, som `docs/brief.md` beskriver under Kontroll:
- Klicka på startskärmen: `audio.musicId === 'titel'` och inga fel i konsolen.
- Starta ett spel med `Game.create(testCharacter())`. Efter 1,5 s är `audio.musicId === 'by'`.
- Kör `combat.startCombat` mot en svartalf. Efter 1,5 s är `audio.musicId === 'strid'`.
- Ta en skärmdump där ljudpanelen är öppen och kontrollera att den inte täcker något.

Väntat: värdena ovan, och inga 404:or för ljudfiler i nätverksloggen.

- [ ] **Steg 6: Commit**

```bash
git add src/audio src/main.ts index.html src/ui/style.css tests/audioplayer.test.ts
git commit -m "Ljudmodulen: uppspelning, musikbyten och ljudknappen"
```

---

### Task 6: Briefen

**Filer:**
- Ändra: `docs/brief.md`

- [ ] **Steg 1: Uppdatera briefen**

- Punkt 1 under "Plan för grafik och ljud" är klar. Skriv kort vad som finns: `src/audio/`, signalerna i `Game.cue`, tabellerna i `sounds.ts` och `music.ts`, `tools/flare_audio.py` och `public/audio/CREDITS.md`.
- Luckorna ur designen ligger kvar som "Kvar". Det gäller vapenskrammel, att tända facklan, att sova, olika ljud för svärd, yxa och klubba, steg efter underlag, djurljud, båge och armborst var för sig, och miljöslingor.
- Lägg till en rad om ljudet under "Hur koden hänger ihop".
- Uppdatera antalet tester under Kontroll.
- Vidar behöver lyssna och säga vad som ska bytas i tabellerna.

- [ ] **Steg 2: Kör testerna**

Kör: `npm test && npx tsc --noEmit`
Väntat: alla tester går igenom.

- [ ] **Steg 3: Commit och push**

```bash
git add docs/brief.md
git commit -m "Briefen: ljud och musik"
git push -u origin claude/vigilant-archimedes-1sghng
```
