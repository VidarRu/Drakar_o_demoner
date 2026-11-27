# Steg efter underlag och vapenskrammel: design och plan

Två av luckorna efter ljud och musik (`2026-11-27-ljud-och-musik-design.md`). Godkänd av Vidar.

## Vad och varför

- Stegen ska låta efter marken och inte efter rustningen. Flares steg låter som utrustning, och
  Vidar vill inte att de ska påminna om ljuden när man tar på eller av en rustning.
- När striden börjar ska man höra vapenskrammel: ett svärd som dras och ringbrynja som skramlar.

## Ljuden

Från OpenGameArt, nedladdade och omkodade av `tools/oga_audio.py` till `public/audio/oga/`:

| Paket | Upphovsperson | Licens | Används till |
| --- | --- | --- | --- |
| Footsteps on different surfaces (congusbongus) | swuing, EminYILDIRIM, Ali_6868 | CC BY 3.0 (grus CC0) | gräs, grus, trä, sten, vatten |
| Different steps on wood, stone, leaves, gravel and mud | TinyWorlds | CC0 | löv |
| RPG Sound Pack | artisticdude | CC0 | svärd som dras, ringbrynja |

## Underlaget

| Ruta | Ljud |
| --- | --- |
| gräs, öppen skog, kullar | gräs |
| tät skog | löv |
| stig (väg) | grus |
| trägolv, bro, dörr | trä (dörren lägger till dörrljudet) |
| berg | sten |
| grottgolv | sten med eko (lagt på vid omkodningen) |
| vadställe | vatten |
| allt annat | gräs |

Rustningen påverkar inte längre stegen.

## Striden börjar

Ett av fem svärdsljud, och ringbrynja 120 ms senare (det andra ljudet i en signal kommer redan
efter `LAYER_MS`). Stridsropet ligger kvar för förmågorna.

## Plan

1. **Verktyget** `tools/oga_audio.py <katalog med de uppackade paketen>`: plockar filerna, gör dem
   mono med 64 kbit/s, jämnar ut toppvolymen till −3 dB och lägger eko på grottstegen. Skriver
   `public/audio/oga/steg/{gras,lov,grus,tra,sten,grotta,vatten}N.mp3` och
   `public/audio/oga/strid/{svard1-5,ringbrynja1-2}.mp3`. Upphovspersonerna förs in i
   `public/audio/CREDITS.md`.
2. **Sökvägarna:** `SoundPick.file` blir en sökväg under `/audio/` (`flare/sfx/...` eller
   `oga/...`), och `AudioEngine` har basen `/audio/`. Testet "varje ljudfil finns" kontrollerar
   `public/audio/<file>.mp3`.
3. **Stegen** i `sounds.ts` väljs efter rutans namn enligt tabellen. Testet: gräs, löv, grus, trä,
   grotta och vatten ger var sin grupp, och rustningen ändrar inget.
4. **Striden börjar** ger `svard` och `ringbrynja`. Testet uppdateras.
5. **Briefen:** luckorna stryks, och de nya källorna nämns.
