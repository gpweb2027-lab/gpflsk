"""Génère un fichier SQL d'import depuis les images du projet (sans toucher à la base).
Usage : python import_catalogue.py /chemin/vers/static --output import_shop.sql
Exécuter ensuite le SQL dans PostgreSQL LOCAL. Prix par défaut: 3 coins, modifiables en SQL.
"""
import argparse
from pathlib import Path

def q(v):
    return "'" + str(v).replace("'", "''") + "'"

parser=argparse.ArgumentParser()
parser.add_argument('static', type=Path)
parser.add_argument('--output',type=Path,default=Path('import_shop.sql'))
parser.add_argument('--price',type=int,default=3)
a=parser.parse_args()
if not 0 <= a.price <= 10: parser.error('Prix entre 0 et 10')
if not a.static.is_dir(): parser.error('Dossier static introuvable')
allowed={'.png','.webp','.jpg','.jpeg','.gif'}
lines=['BEGIN;']
for kind,base in [('avatar',a.static/'media'/'avatars'),('banner',a.static/'media'/'banners')]:
    if not base.is_dir():continue
    for order,folder in enumerate(sorted(p for p in base.iterdir() if p.is_dir())):
        code=folder.name
        title={'collection_a':'Gaming' if kind=='avatar' else 'Bannières A','collection_b':'Rétro' if kind=='avatar' else 'Bannières B','collection_bollywood':'Bollywood'}.get(code,code.replace('_',' ').title())
        collection_code=f'{kind}_{code}'
        lines.append(f"INSERT INTO shop_collections(code,name,kind,sort_order) VALUES ({q(collection_code)},{q(title)},{q(kind)},{order}) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name;")
        for i,file in enumerate(sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in allowed)):
            item_code=f'{kind}_{code}_{file.stem}'
            image_url=f'/static/media/{"avatars" if kind=="avatar" else "banners"}/{code}/{file.name}'
            label=file.stem.replace('_',' ').replace('-',' ')
            lines.append(f"INSERT INTO shop_items(collection_id,code,name,kind,image_url,price_coins,sort_order) VALUES ((SELECT id FROM shop_collections WHERE code={q(collection_code)}),{q(item_code)},{q(label)},{q(kind)},{q(image_url)},{a.price},{i}) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,image_url=EXCLUDED.image_url;")
lines.append('COMMIT;')
a.output.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('SQL créé :',a.output,'(',len(lines)-2,'instructions )')
