"""
Kodar om ljud från OpenGameArt till MP3 och lägger dem i public/audio/oga/.

Kör:  python3 tools/oga_audio.py <katalog där paketen är uppackade>

Paketen (se public/audio/CREDITS.md), uppackade var och en i sin katalog:
  steps/  https://opengameart.org/content/footsteps-on-different-surfaces (footsteps_0.zip)
  kdd/    https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud
  rpg/    https://opengameart.org/content/rpg-sound-pack (rpg_sound_pack.zip)
  duck/   https://opengameart.org/content/80-cc0-rpg-sfx (80-CC0-RPG-SFX_0.zip)
  bartk/  https://opengameart.org/content/spell-4-fire (foom_0.wav)
  medieval/  https://opengameart.org/content/medieval-sound-effects-weapon-textures (de wav-filer
             som TAKES nämner, ur medieval_sfx_textures_1_of_2.7z och 2_of_2.7z)
  fleshy/ https://opengameart.org/content/fleshy-fight-sounds (fleshy_fight_sounds.zip)
  clash/  https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes (sword_clash_-_starninjas_0.zip)
  dog/    https://opengameart.org/content/dog-snarl-grunt-grumble (dog_0.7z, flac-filerna)
  bear/   https://opengameart.org/content/bear-growls (bear.zip, flac-filerna)
  creature/  https://opengameart.org/content/80-cc0-creature-sfx (howl.ogg)
  water/  https://opengameart.org/content/40-cc0-water-splash-slime-sfx (splash_*.ogg)
  (duck/ får också stones_01–04.ogg ur 80 CC0 RPG SFX)

Alla blir mono med 64 kbit/s och toppvolymen −3 dB, så att underlagen låter lika starka.
Grottstegen får ett eko, och facklans låga tonas ut efter en sekund. Vapenhuggen och skotten
ligger som många tagningar i en lång fil (TAKES); de högsta tagningarna klipps ut var för sig.
Kräver ffmpeg.
"""
import os
import re
import subprocess
import sys

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'oga')
PEAK_DB = -3.0
CAVE_ECHO = 'apad=pad_dur=0.35,aecho=0.8:0.6:70|140:0.35|0.18'
FLAME = 'atrim=0:1.1,afade=t=out:st=0.7:d=0.4'
CLANG = 'atrim=0:0.8,afade=t=out:st=0.5:d=0.3'
GROWL = 'atrim=0:0.7,afade=t=out:st=0.45:d=0.25'
TRIM_END = 'areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse'


def steps(folder: str, count: int) -> list[str]:
    return [f'steps/footsteps/{folder}/{i}.ogg' for i in range(count)]


# (mål utan .mp3, källor i ordning, extra filter)
PICK = [
    ('steg/gras', steps('grass', 9), ''),
    ('steg/grus', steps('gravel', 10), ''),
    ('steg/tra', steps('wood', 9), ''),
    ('steg/sten', steps('boots', 9), ''),
    ('steg/grotta', steps('boots', 9), CAVE_ECHO),
    ('steg/vatten', steps('water', 5), ''),
    ('steg/lov', ['kdd/leaves01.ogg', 'kdd/leaves02.ogg'], ''),
    ('strid/svard', ['rpg/RPG Sound Pack/battle/sword-unsheathe.wav'] + [f'rpg/RPG Sound Pack/battle/sword-unsheathe{i}.wav' for i in range(2, 6)], ''),
    ('ljus/tanda', ['bartk/foom_0.wav', 'duck/spell_fire_06.ogg', 'duck/spell_fire_07.ogg'], FLAME),
    ('vila/lagga', ['rpg/RPG Sound Pack/inventory/cloth-heavy.wav'], ''),
    ('strid/ringbrynja', [f'rpg/RPG Sound Pack/inventory/chainmail{i}.wav' for i in (1, 2)], ''),
    ('traff/svard', ['fleshy/sword-1a.wav', 'fleshy/sword-1b.wav'], ''),
    ('traff/svard_rustning', ['fleshy/sword-arm-2a.wav', 'fleshy/sword-arm-2b.wav'], ''),
    ('traff/kross', ['fleshy/hammer-1a.wav', 'fleshy/hammer-1b.wav'], ''),
    ('traff/kross_rustning', ['fleshy/hammer-arm-2a.wav', 'fleshy/hammer-arm-2b.wav'], ''),
    ('traff/stick', ['fleshy/piercing-1a.wav', 'fleshy/piercing-1b.wav'], ''),
    ('traff/stick_rustning', ['fleshy/piercing-arm-2a.wav', 'fleshy/piercing-arm-2b.wav'], ''),
    ('traff/slag', ['fleshy/punch_1a.wav', 'fleshy/punch_1b.wav'], ''),
    ('parera/klang', [f'clash/sword_clash.{i}.ogg' for i in range(1, 11)], CLANG),
    ('djur/varg_traff', ['dog/dog-growl.flac', 'dog/dog-grumble.flac', 'dog/dog-snarl.flac'], ''),
    ('djur/varg_dor', ['creature/howl.ogg'], ''),
    ('djur/bjorn_traff', ['bear/bear_01.flac', 'bear/bear_02.flac'], GROWL),
    ('djur/bjorn_dor', ['bear/bear_01.flac', 'bear/bear_02.flac'], ''),
    ('element/sten', ['duck/stones_01.ogg', 'duck/stones_02.ogg', 'duck/stones_04.ogg'], ''),
    ('element/sten_dor', ['duck/stones_03.ogg'], ''),
    ('element/plask', [f'water/splash_{i:02d}.ogg' for i in (6, 10, 14, 15)], ''),
    ('element/plask_dor', ['water/splash_01.ogg'], ''),
    ('element/skugga', [f'rpg/RPG Sound Pack/NPC/shade/shade{i}.wav' for i in (1, 2, 3, 14)], ''),
    ('element/skugga_dor', ['rpg/RPG Sound Pack/NPC/shade/shade8.wav'], ''),
]

# Tagningar i en lång fil: (mål, källa, brusgräns för tystnaden i dB, högst så många tagningar).
TAKES = [
    ('hugg/sabel', 'medieval/Sabre Swing.wav', -45, 8),
    ('hugg/yxa', 'medieval/Axe Swing.wav', -35, 6),
    ('hugg/dolk', 'medieval/Dagger Swing.wav', -35, 6),
    ('hugg/spjut', 'medieval/Spear Swing.wav', -35, 6),
    ('skott/bage', 'medieval/English Longbow Shoot.wav', -45, 4),
    ('skott/armborst', 'medieval/Crossbow Shoot.wav', -45, 6),
]
TAKE_MIN = 0.08
TAKE_PRE = 0.02
TAKE_POST = 0.15


def peak(path: str) -> float:
    r = subprocess.run(['ffmpeg', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
    return float(re.search(r'max_volume: (-?[\d.]+) dB', r.stderr).group(1))


def rate_args(path: str) -> list[str]:
    """MP3 klarar högst 48 kHz: inspelningar i 96 eller 192 kHz görs om till 44,1 kHz."""
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', path], capture_output=True, text=True)
    return ['-ar', '44100'] if int(r.stdout.split()[0]) > 48000 else []


def takes(path: str, noise_db: int) -> list[tuple[float, float]]:
    """Tagningarna i en fil: (början, slut) mellan tystnaderna."""
    r = subprocess.run(['ffmpeg', '-i', path, '-af', f'silencedetect=noise={noise_db}dB:d=0.08', '-f', 'null', '-'], capture_output=True, text=True)
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr).groups()
    dur = int(h) * 3600 + int(m) * 60 + float(s)
    starts = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', r.stderr)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
    out, t = [], 0.0
    for a, b in zip(starts, ends + [dur]):
        if a - t >= TAKE_MIN:
            out.append((t, a))
        t = b
    if len(ends) == len(starts) and dur - t >= TAKE_MIN:
        out.append((t, dur))
    return out


def encode_normalized(src: str, dst: str, pre_filter: str = ''):
    """Mono, 64 kbit/s och toppen −3 dB. Ett förfilter som ändrar nivån läggs på före mätningen."""
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    rate = rate_args(src)
    if pre_filter:
        wet = dst[:-4] + '.tmp.wav'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', *rate, '-af', pre_filter, wet], check=True)
        src, rate = wet, []
    gain = PEAK_DB - peak(src)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', *rate, '-b:a', '64k', '-af', f'volume={gain:.1f}dB', dst], check=True)
    if pre_filter:
        os.remove(src)


count = 0
for target, src_rel, noise_db, most in TAKES:
    src = os.path.join(SRC, src_rel)
    found = takes(src, noise_db)
    # De längsta tagningarna (hela hugg, inte klick), i den ordning de spelades in.
    chosen = sorted(sorted(found, key=lambda t: -(t[1] - t[0]))[:most])
    for n, (a, b) in enumerate(chosen, start=1):
        start = max(0.0, a - TAKE_PRE)
        length = b - start + TAKE_POST
        cut = f'atrim={start:.3f}:{start + length:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st={length - 0.08:.3f}:d=0.08'
        encode_normalized(src, os.path.join(OUT, f'{target}{n}.mp3'), cut)
        count += 1

for target, sources, extra in PICK:
    for n, rel in enumerate(sources, start=1):
        src = os.path.join(SRC, rel)
        dst = os.path.join(OUT, f'{target}{n}.mp3')
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if extra:
            # Ekot och uttoningen ändrar nivån: lägg på dem först och mät toppen efteråt.
            wet = dst[:-4] + '.tmp.wav'
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-af', f'{extra},{TRIM_END}', wet], check=True)
            src = wet
        gain = PEAK_DB - peak(src)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-b:a', '64k', '-af', f'volume={gain:.1f}dB', dst], check=True)
        if extra:
            os.remove(src)
        count += 1

total = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(OUT) for f in fs)
print(f'{count} filer, {total / 1e6:.2f} MB i {os.path.normpath(OUT)}')
