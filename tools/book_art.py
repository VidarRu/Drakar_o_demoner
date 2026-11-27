"""
Bokens bilder: skalar PNG-bilderna i public/art/bok/raser och
public/art/bok/yrken till högst 700 punkters höjd, sparar dem som WebP
(kvalitet 82, alfakanalen kvar) och tar bort PNG-filerna.

Kör:  python3 -I tools/book_art.py
"""
import glob
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'art', 'bok')
MAX_HEIGHT = 700
QUALITY = 82


def convert(path):
    img = Image.open(path)
    img.load()
    if img.mode not in ('RGBA', 'RGB'):
        img = img.convert('RGBA')
    if img.height > MAX_HEIGHT:
        width = round(img.width * MAX_HEIGHT / img.height)
        img = img.resize((width, MAX_HEIGHT), Image.LANCZOS)
    out = os.path.splitext(path)[0] + '.webp'
    img.save(out, 'WEBP', quality=QUALITY)
    os.remove(path)
    return out, img.size


for folder in ('raser', 'yrken'):
    for png in sorted(glob.glob(os.path.join(ROOT, folder, '*.png'))):
        out, size = convert(png)
        print(f'{os.path.relpath(out, ROOT)}  {size[0]}×{size[1]}  {os.path.getsize(out) // 1024} kB')
