"""
Kodar om ljud och musik ur Flare (flare-game, CC-BY-SA 3.0) till MP3 och lägger dem i
public/audio/flare/.

Kör:  python3 tools/flare_audio.py <sökväg till flare-game/mods/fantasycore>

Ljudeffekterna (soundfx/ utom npcs/) blir mono med 64 kbit/s, och tystnaden i början och
slutet klipps bort. Musiken (music/ utom wind_ambient) blir stereo med 96 kbit/s.
Katalogerna behålls: soundfx/steps/step_cloth1.ogg blir sfx/steps/step_cloth1.mp3.
Kräver ffmpeg.
"""
import os
import subprocess
import sys

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'flare')

SKIP_DIRS = {'npcs'}
SKIP_MUSIC = {'wind_ambient.ogg'}
TRIM = (
    'silenceremove=start_periods=1:start_threshold=-50dB,areverse,'
    'silenceremove=start_periods=1:start_threshold=-50dB,areverse'
)


def encode(src: str, dst: str, args: list[str]):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, *args, dst], check=True)


count = 0
sfx_root = os.path.join(SRC, 'soundfx')
for root, dirs, files in os.walk(sfx_root):
    dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
    for f in sorted(files):
        if not f.endswith('.ogg'):
            continue
        rel = os.path.relpath(os.path.join(root, f), sfx_root)
        encode(os.path.join(root, f), os.path.join(OUT, 'sfx', rel[:-4] + '.mp3'), ['-ac', '1', '-b:a', '64k', '-af', TRIM])
        count += 1

music_root = os.path.join(SRC, 'music')
for f in sorted(os.listdir(music_root)):
    if not f.endswith('.ogg') or f in SKIP_MUSIC:
        continue
    encode(os.path.join(music_root, f), os.path.join(OUT, 'music', f[:-4] + '.mp3'), ['-ac', '2', '-b:a', '96k'])
    count += 1

total = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(OUT) for f in fs)
print(f'{count} filer, {total / 1e6:.1f} MB i {os.path.normpath(OUT)}')
