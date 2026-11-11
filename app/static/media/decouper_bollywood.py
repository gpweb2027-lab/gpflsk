#!/usr/bin/env python3
"""Découpe une planche 10 colonnes x 5 lignes en 50 avatars WebP."""
from pathlib import Path
import argparse
from PIL import Image, ImageOps


def main():
    parser = argparse.ArgumentParser(description='Découpe 50 portraits Bollywood en WebP')
    parser.add_argument('--source', type=Path, default=Path(__file__).with_name('planche_bollywood.png'))
    parser.add_argument('--destination', type=Path, default=Path('static/media/avatars/collection_bollywood'))
    parser.add_argument('--taille', type=int, default=512)
    args = parser.parse_args()
    if args.taille < 64 or args.taille > 2048:
        parser.error('La taille doit être comprise entre 64 et 2048 pixels')
    args.destination.mkdir(parents=True, exist_ok=True)
    with Image.open(args.source) as original:
        im = ImageOps.exif_transpose(original).convert('RGB')
        width, height = im.size
        for row in range(5):
            for col in range(10):
                # Limites arrondies séparément pour éviter les erreurs cumulées.
                x0 = round(col * width / 10)
                x1 = round((col + 1) * width / 10)
                y0 = round(row * height / 5)
                y1 = round((row + 1) * height / 5)
                # Retire les traits de séparation de la planche.
                margin = max(2, round(min(x1-x0, y1-y0) * 0.018))
                tile = im.crop((x0 + margin, y0 + margin, x1 - margin, y1 - margin))
                tile = ImageOps.fit(tile, (args.taille, args.taille), method=Image.Resampling.LANCZOS)
                target = args.destination / f'avatar_{row * 10 + col + 1:02d}.webp'
                tile.save(target, 'WEBP', quality=82, method=6)
                print(target)
    print(f'50 avatars créés dans {args.destination}')


if __name__ == '__main__':
    main()
