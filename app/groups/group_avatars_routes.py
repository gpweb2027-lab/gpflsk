"""Boutique des avatars de groupes. Blueprint indépendant : /api/group-avatars.
À enregistrer dans create_app() : app.register_blueprint(group_avatars_bp)
"""
from pathlib import Path
from flask import Blueprint, current_app, request, url_for
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text
from ..extensions import db, socketio
from ..models import User, FriendGroup

group_avatars_bp = Blueprint('group_avatars', __name__, url_prefix='/api/group-avatars')
PRICE = 100

def catalogue():
    folder = Path(current_app.static_folder) / 'media' / 'groupes' / 'collection_a'
    return [(index, file.stem.replace('_', ' ').title(),url_for('static', filename='media/groupes/collection_a/' + file.name))
            for index, file in enumerate(sorted(folder.glob('*.png')), start=1) if index <= 50]

def group_owner(group_id, uid):
    group = db.session.get(FriendGroup, group_id)
    return group if group and group.owner_id == uid else None

@group_avatars_bp.get('/catalog')
@jwt_required()
def group_avatar_catalog():
    uid = int(get_jwt_identity())
    group_id = request.args.get('group_id', type=int)
    if not group_id or not group_owner(group_id, uid):
        return {'error': 'Groupe introuvable ou accès interdit'}, 403
    user = db.session.get(User, uid)
    owned = {row[0] for row in db.session.execute(text(
        'SELECT item_id FROM friend_group_avatar_purchases WHERE group_id=:gid'), {'gid': group_id})}
    return {'coins': user.coins or 0,
            'items': [{'id': i, 'name': name, 'image_url': url, 'price': PRICE, 'owned': i in owned}
                      for i, name, url in catalogue()]}

@group_avatars_bp.post('/buy')
@jwt_required()
def buy_group_avatar():
    uid = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    try:
        group_id, item_id = int(data.get('group_id')), int(data.get('item_id'))
    except (TypeError, ValueError):
        return {'error': 'Paramètres invalides'}, 400
    if item_id not in {i for i, _, _ in catalogue()}:
        return {'error': 'Avatar introuvable'}, 404
    try:
        group = db.session.execute(db.select(FriendGroup).where(FriendGroup.id == group_id).with_for_update()).scalar_one_or_none()
        if not group or group.owner_id != uid:
            db.session.rollback()
            return {'error': 'Accès interdit'}, 403
        already = db.session.execute(text('SELECT id FROM friend_group_avatar_purchases WHERE group_id=:g AND item_id=:i'), {'g':group_id,'i':item_id}).first()
        if already:
            db.session.rollback()
            return {'owned': True, 'message': 'Déjà acheté'}, 200
        user = db.session.execute(db.select(User).where(User.id == uid).with_for_update()).scalar_one()
        if (user.coins or 0) < PRICE:
            db.session.rollback()
            return {'error': 'Coins insuffisants'}, 409
        user.coins -= PRICE
        db.session.execute(text('INSERT INTO friend_group_avatar_purchases (group_id,item_id,buyer_id,price_coins) VALUES (:g,:i,:u,:p)'), {'g':group_id,'i':item_id,'u':uid,'p':PRICE})
        db.session.commit()
        return {'owned': True, 'coins': user.coins}, 200
    except Exception:
        db.session.rollback()
        current_app.logger.exception('Achat avatar de groupe')
        return {'error': 'Achat impossible'}, 500

@group_avatars_bp.post('/equip')
@jwt_required()
def equip_group_avatar():
    uid = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    try:
        group_id, item_id = int(data.get('group_id')), int(data.get('item_id'))
    except (TypeError, ValueError):
        return {'error': 'Paramètres invalides'}, 400
    group = group_owner(group_id, uid)
    if not group:
        return {'error': 'Accès interdit'}, 403
    owned = db.session.execute(text('SELECT id FROM friend_group_avatar_purchases WHERE group_id=:g AND item_id=:i'), {'g':group_id,'i':item_id}).first()
    item = next(((i,name,url) for i,name,url in catalogue() if i == item_id), None)
    if not owned or not item:
        return {'error': 'Avatar non acheté'}, 403
    # L'avatar_item_id représente ici l'index du catalogue local (1..50).
    # Pas de FK shop_items : les avatars de groupe ont leur catalogue indépendant.
    group.avatar_item_id = item_id
    db.session.commit()
    socketio.emit('friend_group_updated', {'group_id': group_id})
    return {'avatar_url': item[2], 'item_id': item_id}