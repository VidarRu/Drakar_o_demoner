"""
Kodar om ljud från OpenGameArt till MP3 och lägger dem i public/audio/oga/.

Kör:  python3 tools/oga_audio.py <katalog där paketen är uppackade>

Paketen (se public/audio/CREDITS.md), uppackade var och en i sin katalog:
  steps/  https://opengameart.org/content/footsteps-on-different-surfaces (footsteps_0.zip)
  kdd/    https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud
  rpg/    https://opengameart.org/content/rpg-sound-pack (rpg_sound_pack.zip)
  duck/   https://opengameart.org/content/80-cc0-rpg-sfx (80-CC0-RPG-SFX_0.zip)
  bartk/  https://opengameart.org/content/spell-4-fire (foom_0.wav)

Alla blir mono med 64 kbit/s och toppvolymen −3 dB, så att underlagen låter lika starka.
Grottstegen får ett eko, och facklans låga tonas ut efter en sekund. Kräver ffmpeg.
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
    ('strid/ringbrynja', [f'rpg/RPG Sound Pack/inventory/chainmail{i}.wav' for i in (1, 2)], ''),
]


def peak(path: str) -> float:
    r = subprocess.run(['ffmpeg', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
    return float(re.search(r'max_volume: (-?[\d.]+) dB', r.stderr).group(1))


count = 0
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
