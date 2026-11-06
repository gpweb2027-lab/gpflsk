from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_, and_
from ..extensions import db, socketio
from ..models import User, FriendRequest, FriendGroup, FriendGroupMember, FriendGroupMessage
from ..chat_features import enrich, set_reply

groups_bp = Blueprint("groups", __name__, url_prefix="/api/groups")

def uid():
    return int(get_jwt_identity())

def member(group_id, user_id):
    return FriendGroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()

def is_friend(a, b):
    return FriendRequest.query.filter(FriendRequest.status == "ACCEPTED", or_(
        and_(FriendRequest.sender_id == a, FriendRequest.receiver_id == b),
        and_(FriendRequest.sender_id == b, FriendRequest.receiver_id == a))).first() is not None

def serialize(group, user_id):
    members = FriendGroupMember.query.filter_by(group_id=group.id).all()
    last = FriendGroupMessage.query.filter_by(group_id=group.id).order_by(FriendGroupMessage.id.desc()).first()
    return {"id": group.id, "name": group.name, "owner_id": group.owner_id,
            "members": [{"id": m.user_id, "username": m.user.username,"pseudo": m.user.pseudo or m.user.username, "avatar_url": m.user.avatar_url} for m in members],
            "last_message": last.to_dict() if last else None}

@groups_bp.get("")
@jwt_required()
def list_groups():
    user_id = uid()
    groups = FriendGroup.query.join(FriendGroupMember).filter(FriendGroupMember.user_id == user_id).order_by(FriendGroup.id.desc()).all()
    return {"groups": [serialize(g, user_id) for g in groups]}

@groups_bp.post("")
@jwt_required()
def create_group():
    user_id = uid()
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    ids = data.get("friend_ids", [])
    if not isinstance(name, str) or not (2 <= len(name.strip()) <= 80):
        return {"error": "Nom du groupe : 2 à 80 caractères."}, 400
    if not isinstance(ids, list) or len(ids) > 49:
        return {"error": "Maximum 49 amis par groupe."}, 400
    try:
        ids = list(dict.fromkeys(int(x) for x in ids))
    except (ValueError, TypeError):
        return {"error": "Liste d'amis invalide."}, 400
    if user_id in ids or any(not is_friend(user_id, x) for x in ids):
        return {"error": "Tu peux ajouter uniquement tes amis."}, 403
    group = FriendGroup(name=name.strip(), owner_id=user_id)
    db.session.add(group)
    db.session.flush()
    for x in [user_id] + ids:
        db.session.add(FriendGroupMember(group_id=group.id, user_id=x))
    db.session.commit()
    return {"group": serialize(group, user_id)}, 201

@groups_bp.get("/<int:group_id>/messages")
@jwt_required()
def messages(group_id):
    if not member(group_id, uid()):
        return {"error": "Accès interdit."}, 403
    try:
        after = max(0, int(request.args.get("after", "0")))
    except ValueError:
        return {"error": "Paramètre after invalide."}, 400
    q = FriendGroupMessage.query.filter_by(group_id=group_id)
    if after:
        q = q.filter(FriendGroupMessage.id > after).order_by(FriendGroupMessage.id.asc()).limit(100)
        items = q.all()
    else:
        items = list(reversed(q.order_by(FriendGroupMessage.id.desc()).limit(100).all()))
    return {"messages": [enrich("group", m) for m in items]}

@groups_bp.post("/<int:group_id>/messages")
@jwt_required()
def send_message(group_id):
    user_id = uid()
    if not member(group_id, user_id):
        return {"error": "Accès interdit."}, 403
    data = request.get_json(silent=True) or {}
    content = data.get("content")
    if not isinstance(content, str) or not (1 <= len(content.strip()) <= 2000):
        return {"error": "Message : 1 à 2000 caractères."}, 400
    msg = FriendGroupMessage(group_id=group_id, sender_id=user_id, content=content.strip())
    db.session.add(msg)
    db.session.flush()
    try:
        set_reply("group", msg, data.get("reply_to_id"), user_id)
    except ValueError as exc:
        db.session.rollback()
        return {"error": str(exc)}, 400
    db.session.commit()
    # Signal sans contenu privé ; les clients autorisés relisent via API JWT.
    socketio.emit("friend_group_updated", {"group_id": group_id})
    return {"message": enrich("group", msg)}, 201

@groups_bp.post("/<int:group_id>/members")
@jwt_required()
def add_member(group_id):
    user_id = uid()
    group = db.session.get(FriendGroup, group_id)
    if not group:
        return {"error": "Groupe introuvable."}, 404
    if group.owner_id != user_id:
        return {"error": "Seul le créateur peut inviter."}, 403
    try:
        friend_id = int((request.get_json(silent=True) or {}).get("friend_id"))
    except (ValueError, TypeError):
        return {"error": "Ami invalide."}, 400
    if not is_friend(user_id, friend_id):
        return {"error": "Ce joueur n'est pas ton ami."}, 403
    if member(group_id, friend_id):
        return {"error": "Déjà membre."}, 409
    if FriendGroupMember.query.filter_by(group_id=group_id).count() >= 50:
        return {"error": "Groupe complet."}, 409
    db.session.add(FriendGroupMember(group_id=group_id, user_id=friend_id))
    db.session.commit()
    socketio.emit("friend_group_updated", {"group_id": group_id})
    return {"group": serialize(group, user_id)}, 201

@groups_bp.post("/<int:group_id>/leave")
@jwt_required()
def leave_group(group_id):
    user_id = uid()
    group = db.session.get(FriendGroup, group_id)
    if not group or not member(group_id, user_id):
        return {"error": "Groupe introuvable."}, 404
    if group.owner_id == user_id:
        return {"error": "Le créateur ne peut pas quitter son groupe. Il doit d'abord le supprimer."}, 409
    db.session.delete(member(group_id, user_id))
    db.session.commit()
    return {"message": "Groupe quitté."}

@groups_bp.delete("/<int:group_id>")
@jwt_required()
def delete_group(group_id):
    group = db.session.get(FriendGroup, group_id)
    if not group:
        return {"error": "Groupe introuvable."}, 404
    if group.owner_id != uid():
        return {"error": "Seul le créateur peut supprimer le groupe."}, 403
    FriendGroupMessage.query.filter_by(group_id=group_id).delete()
    FriendGroupMember.query.filter_by(group_id=group_id).delete()
    db.session.delete(group)
    db.session.commit()
    socketio.emit("friend_group_updated", {"group_id": group_id})
    return {"message": "Groupe supprimé."}