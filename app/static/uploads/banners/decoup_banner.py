#!/usr/bin/env python3
"""Découpe précisément les deux planches 50 images créées pour gpflsk.

Mettre ce fichier à côté de a.png et b.png, puis :
    python decoup_banner_precis.py

Les coordonnées suivent les séparateurs réels (colonnes de largeur irrégulière).
"""
from pathlib import Path
from PIL import Image, ImageOps

BASE = Path(__file__).resolve().parent
SORTIE = BASE.parents[1] / 'media' / 'banners' if BASE.parent.name == 'uploads' else BASE / 'bannieres_decoupees'
# Si script placé dans static/uploads/banners, BASE.parents[1] == static.
GRILLES = {
    'a': {
        'x': [0, 225, 440, 656, 878, 1099, 1316, 1528, 1743, 1959, 2172],
        'y': [0, 140, 284, 430, 573, 724],
    },
    'b': {
        'x': [0, 245, 486, 650, 867, 1087, 1300, 1508, 1722, 1945, 2172],
        'y': [0, 145, 285, 424, 571, 724],
    },
}


def decouper(nom: str, marge: int = 3):
    chemin = BASE / f'{nom}.png'
    if not chemin.exists():
        print(f'ATTENTION : {chemin} absent, planche ignorée.')
        return
    dossier = SORTIE / f'collection_{nom}'
    dossier.mkdir(parents=True, exist_ok=True)
    with Image.open(chemin) as src:
        img = ImageOps.exif_transpose(src).convert('RGB')
        if img.size != (2172, 724):
            raise ValueError(f'{chemin.name} : taille {img.size}, attendu (2172, 724).')
        x, y = GRILLES[nom]['x'], GRILLES[nom]['y']
        for ligne in range(5):
            for col in range(10):
                n = ligne * 10 + col + 1
                gauche = x[col] + (marge if col else 0)
                droite = x[col + 1] - (marge if col < 9 else 0)
                haut = y[ligne] + (marge if ligne else 0)
                bas = y[ligne + 1] - (marge if ligne < 4 else 0)
                cible = dossier / f'banniere_{n:02d}.webp'
                img.crop((gauche, haut, droite, bas)).save(cible, 'WEBP', quality=90, method=6)
        print(f'{nom}.png : 50 bannières enregistrées dans {dossier}')

if __name__ == '__main__':
    decouper('a')
    decouper('b')
