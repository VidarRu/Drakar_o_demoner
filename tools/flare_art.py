"""
Slängprov för grafikmotorn: plockar bildrutor och figurer ur Flare
(flare-game, CC-BY-SA 3.0) och lägger dem i public/art/flare/.

Kör:  python3 tools/flare_art.py <sökväg till flare-game/mods/fantasycore>

Rutorna skalas till hälften (96×48 per ruta) och figurerna till 60 %.
Varje figur sätts ihop lager för lager (fötter, ben, händer, bröst,
sköld, huvud, vapen) i Flares ordning för varje riktning.
"""
import json
import os
import re
import sys

from PIL import Image

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'art', 'flare')
os.makedirs(OUT, exist_ok=True)

TILE_SCALE = 0.5
CHAR_SCALE = 0.6


def read_tiles(defname, section=1):
    """tile=id,x,y,w,h,ox,oy ur en tilesetdef. section räknar [tileset]-blocken."""
    text = open(os.path.join(SRC, 'tilesetdefs', defname)).read()
    block = text.split('[tileset]')[section]
    img = re.search(r'img=(\S+)', block).group(1)
    tiles = {}
    for m in re.finditer(r'tile=(\d+),(\d+),(\d+),(\d+),(\d+),(-?\d+),(-?\d+)', block):
        tid, x, y, w, h, ox, oy = map(int, m.groups())
        tiles[tid] = (x, y, w, h, ox, oy)
    return os.path.join(SRC, img), tiles


# ----------------------------------------------------------------- rutor och föremål

PICK = {
    # (tilesetdef, block): {namn: id}
    ('tileset_grassland.txt', 1): {
        **{f'grass{i}': 16 + i for i in range(16)},
        **{f'cobble{i}': 32 + i for i in range(16)},
        **{f'pine{i}': 248 + i for i in range(4)},
        **{f'oak{i}': 252 + i for i in range(4)},
        **{f'birch{i}': 240 + i for i in range(4)},
        **{f'dead{i}': 244 + i for i in range(4)},
        'bush0': 112, 'bush1': 113, 'reed0': 114, 'reed1': 115, 'leaf0': 116, 'leaf1': 117,
        'flower0': 118, 'flower1': 119, 'shrub0': 120, 'shrub1': 121, 'shrub2': 122, 'shrub3': 123,
        'tuft0': 124, 'tuft1': 125, 'tuft2': 126, 'tuft3': 127,
        'rock0': 128, 'rock1': 129, 'rock2': 130, 'rock3': 131,
        'stump0': 136, 'stump1': 137, 'chest0': 76, 'chest1': 77, 'crate0': 96, 'crate1': 98,
        'logs0': 100, 'campfire': 102, 'anvil': 103, 'sign0': 138,
    },
    ('tileset_grassland.txt', 2): {
        **{f'water{i}': 176 + i for i in range(16)},
        'plank0': 200, 'plank1': 201, 'plank2': 202, 'plank3': 203,
    },
    ('tileset_cave.txt', 1): {
        **{f'cave{i}': 16 + i for i in range(16)},
        **{f'wood{i}': 232 + i for i in range(8)},
        'stalag0': 144, 'stalag1': 145, 'stalag2': 146, 'stalag3': 147,
        'boulder0': 150, 'boulder1': 151, 'boulder2': 152,
        'shroom0': 132, 'shroom1': 134, 'barrel0': 162, 'bones0': 52, 'bones1': 55,
    },
    ('tileset_dungeon.txt', 1): {
        **{f'stone{i}': 32 + i for i in range(4)},
        **{f'flag{i}': 16 + i for i in range(4)},
        'barrel1': 146, 'table0': 136, 'bed0': 202, 'bookstand': 164, 'brazier': 151,
    },
}

atlas = []
for (defname, block), names in PICK.items():
    path, tiles = read_tiles(defname, block)
    img = Image.open(path).convert('RGBA')
    for name, tid in names.items():
        x, y, w, h, ox, oy = tiles[tid]
        crop = img.crop((x, y, x + w, y + h))
        sw, sh = max(1, round(w * TILE_SCALE)), max(1, round(h * TILE_SCALE))
        atlas.append((name, crop.resize((sw, sh), Image.LANCZOS), ox * TILE_SCALE, oy * TILE_SCALE))

# Enkel hyllpackning.
atlas.sort(key=lambda t: -t[1].size[1])
WIDTH = 2048
x = y = row_h = 0
placed = {}
for name, im, ox, oy in atlas:
    w, h = im.size
    if x + w > WIDTH:
        x, y, row_h = 0, y + row_h + 1, 0
    placed[name] = (x, y, w, h, ox, oy, im)
    x += w + 1
    row_h = max(row_h, h)
sheet = Image.new('RGBA', (WIDTH, y + row_h))
frames = {}
for name, (x, y, w, h, ox, oy, im) in placed.items():
    sheet.alpha_composite(im, (x, y))
    frames[name] = {'frame': {'x': x, 'y': y, 'w': w, 'h': h}, 'pivotPx': {'x': ox, 'y': oy}}
sheet.save(os.path.join(OUT, 'tiles.png'), optimize=True)
json.dump({'frames': frames, 'meta': {'image': 'tiles.png', 'size': {'w': sheet.size[0], 'h': sheet.size[1]}}},
          open(os.path.join(OUT, 'tiles.json'), 'w'))
print('tiles', sheet.size, len(frames))

# ----------------------------------------------------------------- figurer

LAYERS = {
    0: 'main,feet,legs,hands,chest,off,head', 1: 'main,feet,legs,hands,chest,off,head',
    2: 'main,feet,legs,hands,chest,off,head', 3: 'feet,legs,hands,chest,off,head,main',
    4: 'feet,legs,hands,chest,off,head,main', 5: 'feet,legs,hands,chest,off,head,main',
    6: 'feet,legs,hands,main,chest,head,off', 7: 'main,feet,legs,hands,chest,head,off',
}
ANIMS = [('stance', 4), ('run', 8), ('swing', 4)]
CELL = 200
ANCHOR = (100, 170)


def read_anim(path):
    text = open(path).read()
    img = re.search(r'image=(\S+)', text)
    out = {}
    for sec in re.split(r'\n\[', text)[1:]:
        name = sec.split(']')[0]
        fr = {}
        for m in re.finditer(r'frame=(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(-?\d+),(-?\d+)', sec):
            i, d, x, y, w, h, ox, oy = map(int, m.groups())
            fr[(i, d)] = (x, y, w, h, ox, oy)
        out[name] = fr
    return (img.group(1) if img else None), out


def frame_from(img, anim, name, i, d):
    fr = anim.get(name, {})
    if (i, d) not in fr:
        # Färre bildrutor än vi vill ha: ta den sista som finns.
        n = max([k[0] for k in fr if k[1] == d] or [0])
        i = min(i, n)
    if (i, d) not in fr:
        return None
    x, y, w, h, ox, oy = fr[(i, d)]
    return img.crop((x, y, x + w, y + h)), ox, oy


def build_sheet(layers_for_dir, out_name, tint=None, scale=CHAR_SCALE):
    cols = sum(n for _, n in ANIMS)
    big = Image.new('RGBA', (CELL * cols, CELL * 8))
    for d in range(8):
        col = 0
        for anim_name, n in ANIMS:
            for i in range(n):
                cell = Image.new('RGBA', (CELL, CELL))
                for img, anim in layers_for_dir(d):
                    f = frame_from(img, anim, anim_name, i, d)
                    if f:
                        im, ox, oy = f
                        cell.alpha_composite(im, (ANCHOR[0] - ox, ANCHOR[1] - oy))
                big.alpha_composite(cell, (col * CELL, d * CELL))
                col += 1
    if tint:
        r, g, b = tint
        px = big.load()
        for yy in range(big.size[1]):
            for xx in range(big.size[0]):
                pr, pg, pb, pa = px[xx, yy]
                if pa:
                    px[xx, yy] = (min(255, int(pr * r)), min(255, int(pg * g)), min(255, int(pb * b)), pa)
    small = big.resize((round(big.size[0] * scale), round(big.size[1] * scale)), Image.LANCZOS)
    # 256 färger med genomskinlighet räcker för figurerna och gör filerna en tredjedel så stora.
    small = small.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
    small.save(os.path.join(OUT, out_name + '.png'), optimize=True)
    return {'cell': round(CELL * scale), 'anchor': [ANCHOR[0] * scale, ANCHOR[1] * scale],
            'anims': {a: [sum(n for _, n in ANIMS[:k]), n] for k, (a, n) in enumerate(ANIMS)}}


cache = {}


def avatar_layer(sex, item):
    key = (sex, item)
    if key not in cache:
        img = Image.open(os.path.join(SRC, 'images', 'avatar', sex, item + '.png')).convert('RGBA')
        _, anim = read_anim(os.path.join(SRC, 'animations', 'avatar', sex, item + '.txt'))
        cache[key] = (img, anim)
    return cache[key]


def avatar(sex, **slots):
    full = {'feet': 'default_feet', 'legs': 'default_legs', 'hands': 'default_hands', 'chest': 'default_chest',
            'head': 'head_short' if sex == 'male' else 'head_long', **slots}

    def layers(d):
        out = []
        for slot in LAYERS[d].split(','):
            if full.get(slot):
                out.append(avatar_layer(sex, full[slot]))
        return out
    return layers


def enemy(name):
    path = os.path.join(SRC, 'animations', 'enemies', name + '.txt')
    img_path, anim = read_anim(path)
    img = Image.open(os.path.join(SRC, img_path)).convert('RGBA')
    return lambda d: [(img, anim)]


CHARS = {
    'krigare': (avatar('male', chest='chain_cuirass', legs='chain_greaves', feet='chain_boots', hands='chain_gloves', main='longsword', off='kite_shield'), None),
    'krigarinna': (avatar('female', chest='chain_cuirass', legs='chain_greaves', feet='chain_boots', main='longsword', off='shield'), None),
    'jagare': (avatar('male', chest='leather_chest', legs='leather_pants', feet='leather_boots', hands='leather_gloves', main='shortbow'), None),
    'tjuv': (avatar('male', head='leather_hood', chest='leather_chest', legs='leather_pants', feet='leather_boots', main='dagger'), None),
    'magiker': (avatar('male', head='mage_hood', chest='mage_vest', hands='mage_sleeves', legs='mage_skirt', feet='mage_boots', main='staff'), None),
    'alv': (avatar('female', chest='leather_chest', legs='leather_pants', feet='leather_boots', main='longbow'), None),
    'dvarg': (avatar('male', head='plate_helm', chest='plate_cuirass', legs='chain_greaves', feet='plate_boots', main='battle_axe'), None),
    'vard': (avatar('male', head='head_bald', chest='cloth_shirt', legs='cloth_pants', feet='cloth_sandals'), None),
    'smed': (avatar('male', head='head_bald', legs='leather_pants', feet='leather_boots', hands='leather_gloves', main='smith_hammer'), None),
    'gumma': (avatar('female', head='mage_hood_alt1', chest='mage_vest_alt1', legs='mage_skirt_alt1', feet='cloth_sandals', main='staff'), None),
    'knekt': (avatar('male', head='chain_coif', chest='chain_cuirass', legs='leather_pants', feet='leather_boots', main='infantry_axe', off='buckler'), None),
    'jagarinna': (avatar('female', head='leather_hood', chest='leather_chest', legs='leather_pants', feet='leather_boots', main='longbow'), None),
    'linnea': (avatar('female', chest='cloth_shirt', legs='cloth_pants', feet='cloth_sandals', main='dagger'), None),
    'svartalf': (enemy('goblin'), (0.75, 0.7, 0.95)),
    'hovding': (enemy('goblin_elite'), (0.8, 0.7, 0.9)),
    'haxkonstnar': (enemy('goblin'), (0.85, 0.6, 1.1)),
    'skelett': (enemy('skeleton'), None),
}

meta = {}
for key, (layers, tint) in CHARS.items():
    meta[key] = build_sheet(layers, 'char_' + key, tint)
    print('char', key)
json.dump(meta, open(os.path.join(OUT, 'chars.json'), 'w'), indent=1)

# Porträtt: figurens id -> Flares porträtt.
PORTRAITS = {
    'krigare': 'male01', 'krigarinna': 'female14', 'jagare': 'male05', 'tjuv': 'male03', 'magiker': 'male20',
    'alv': 'female04', 'dvarg': 'male18', 'vard': 'male12', 'smed': 'male14', 'gumma': 'female05',
    'knekt': 'male17', 'jagarinna': 'female02', 'linnea': 'female09',
}
for f in os.listdir(OUT):
    if f.startswith('portrait_'):
        os.remove(os.path.join(OUT, f))
for key, p in PORTRAITS.items():
    im = Image.open(os.path.join(SRC, 'images', 'portraits', p + '.png')).convert('RGBA')
    im.thumbnail((128, 128), Image.LANCZOS)
    im.save(os.path.join(OUT, 'portrait_' + key + '.png'), optimize=True)
print('klart')

# Utrustningsdockan: varje del framifrån (riktning 7, första stå-bilden), i full upplösning.
DOLL = os.path.join(OUT, 'doll')
os.makedirs(DOLL, exist_ok=True)
doll_meta = {}
for sex in ['male', 'female']:
    for f in sorted(os.listdir(os.path.join(SRC, 'images', 'avatar', sex))):
        item = f[:-4]
        img, anim = avatar_layer(sex, item)
        got = frame_from(img, anim, 'stance', 0, 7)
        if not got:
            continue
        im, ox, oy = got
        im.save(os.path.join(DOLL, f'{sex}_{item}.png'), optimize=True)
        doll_meta[f'{sex}_{item}'] = [ox, oy]
json.dump(doll_meta, open(os.path.join(OUT, 'doll.json'), 'w'))
print('docka', len(doll_meta))
