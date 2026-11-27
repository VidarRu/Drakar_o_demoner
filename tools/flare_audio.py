"""
Kodar om ljud och musik ur Flare (flare-game, CC-BY-SA 3.0) till MP3 och lägger dem i
public/audio/flare/.

Kör:  python3 tools/flare_audio.py <sökväg till flare-game/mods/fantasycore>

Ljudeffekterna (soundfx/ utom npcs/) blir mono med 64 kbit/s, och tystnaden i början och
slutet klipps bort. Musiken (music/ utom wind_ambient) blir stereo med 96 kbit/s.
Katalogerna behålls: soundfx/steps/step_cloth1.ogg blir sfx/steps/step_cloth1.mp3.
Korta utdrag ur miljöslingorna (uggla, fågelkvitter, lägereld) läggs i sfx/utdrag/, med
in- och uttoning och toppvolymen −6 dB. Miljöslingorna (fåglar, uggla, flod, vind, grotta, härd)
läggs hela i sfx/slinga/: utan bortklippt tystnad, med samma medelnivå och upprepade till minst
20 sekunder, så att skarven hörs sällan. Kräver ffmpeg.
"""
import os
import re
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

# Utdrag ur miljöslingorna: (mål, källa, början i s, längd i s, intoning, uttoning).
EXCERPTS = [
    ('uggla', 'environment/forest_owl_loop.ogg', 3.3, 2.0, 0.1, 0.4),
    ('kvitter', 'environment/bird_twitter_loop.ogg', 0.0, 3.0, 0.3, 0.8),
    ('lagereld', 'environment/open_fire_loop.ogg', 0.0, 2.8, 0.3, 0.8),
]
EXCERPT_PEAK_DB = -6.0


def peak(path: str) -> float:
    r = subprocess.run(['ffmpeg', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
    return float(re.search(r'max_volume: (-?[\d.]+) dB', r.stderr).group(1))


for name, rel, start, length, fade_in, fade_out in EXCERPTS:
    dst = os.path.join(OUT, 'sfx', 'utdrag', name + '.mp3')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    cut = dst[:-4] + '.tmp.wav'
    fades = f'atrim={start}:{start + length},asetpts=PTS-STARTPTS,afade=t=in:d={fade_in},afade=t=out:st={length - fade_out}:d={fade_out}'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(sfx_root, rel), '-ac', '1', '-af', fades, cut], check=True)
    gain = EXCERPT_PEAK_DB - peak(cut)
    encode(cut, dst, ['-ac', '1', '-b:a', '64k', '-af', f'volume={gain:.1f}dB'])
    os.remove(cut)
    count += 1

# Miljöslingorna: medelnivån −30 dB (toppen högst −1 dB) och minst 20 sekunder långa.
LOOPS = ['bird_twitter_loop', 'forest_owl_loop', 'river_loop', 'wind_loop', 'cave_droplets_loop', 'open_fire_loop']
LOOP_MEAN_DB = -30.0
LOOP_MIN_S = 20.0


def levels(path: str) -> tuple[float, float]:
    r = subprocess.run(['ffmpeg', '-i', path, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
    mean = float(re.search(r'mean_volume: (-?[\d.]+) dB', r.stderr).group(1))
    top = float(re.search(r'max_volume: (-?[\d.]+) dB', r.stderr).group(1))
    return mean, top


for name in LOOPS:
    src = os.path.join(sfx_root, 'environment', name + '.ogg')
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout)
    repeats = max(0, int(LOOP_MIN_S // dur))
    mean, top = levels(src)
    gain = min(LOOP_MEAN_DB - mean, -1.0 - top)
    dst = os.path.join(OUT, 'sfx', 'slinga', name + '.mp3')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-stream_loop', str(repeats), '-i', src, '-ac', '1', '-b:a', '64k', '-af', f'volume={gain:.1f}dB', dst], check=True)
    count += 1

total = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(OUT) for f in fs)
print(f'{count} filer, {total / 1e6:.1f} MB i {os.path.normpath(OUT)}')
