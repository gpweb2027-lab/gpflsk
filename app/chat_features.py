"""Actions partagées entre messages privés, groupes et salles."""
from flask import request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import and_, or_
from .extensions import db, socketio
from .models import (ChatExtra, ChatReaction, PrivateMessage, FriendGroupMessage, ChatMessage,
                     FriendRequest, FriendGroupMember, GameRoomMember)

MODELS = {"private": PrivateMessage, "group": FriendGroupMessage, "room": ChatMessage}

def allowed(kind, msg, uid):
    if kind == "private":
        if uid not in (msg.sender_id, msg.receiver_id): return False
        return FriendRequest.query.filter(FriendRequest.status == "ACCEPTED", or_(
            and_(FriendRequest.sender_id == msg.sender_id, FriendRequest.receiver_id == msg.receiver_id),
            and_(FriendRequest.sender_id == msg.receiver_id, FriendRequest.receiver_id == msg.sender_id))).first() is not None
    if kind == "group":
        return FriendGroupMember.query.filter_by(group_id=msg.group_id, user_id=uid).first() is not None
    return GameRoomMember.query.filter_by(room_id=msg.room_id, user_id=uid).first() is not None

def same_thread(kind, a, b):
    if kind == "private": return {a.sender_id,a.receiver_id} == {b.sender_id,b.receiver_id}
    if kind == "group": return a.group_id == b.group_id
    return a.room_id == b.room_id

def extra_for(kind, mid):
    return ChatExtra.query.filter_by(kind=kind, message_id=mid).first()

def enrich(kind, message, payload=None):
    result = dict(payload if payload is not None else message.to_dict())
    extra = extra_for(kind, message.id)
    result["deleted"] = bool(extra and extra.deleted)
    result["reply_to_id"] = extra.reply_to_id if extra else None
    result["reply_to"] = None
    if extra and extra.reply_to_id:
        original = db.session.get(MODELS[kind], extra.reply_to_id)
        if original and same_thread(kind, message, original):
            original_extra = extra_for(kind, original.id)
            author = original.user if kind == "room" else original.sender
            result["reply_to"] = {
                "id": original.id,
                "username": getattr(author, "username", "Joueur") if author else "Joueur",
                "pseudo": ((author.pseudo or author.username)if author else "Joueur"),
                "content": "Message supprimé" if original_extra and original_extra.deleted else (original.message if kind == "room" else original.content)
            }
    if result["deleted"]:
        if "content" in result: result["content"] = "Message supprimé"
        if "message" in result: result["message"] = "Message supprimé"
    reactions = ChatReaction.query.filter_by(kind=kind, message_id=message.id).all()
    result["reactions"] = [{"emoji": r.emoji, "user_id": r.user_id} for r in reactions]
    return result

def set_reply(kind, message, reply_to_id, uid):
    if reply_to_id is None: return None
    try: rid = int(reply_to_id)
    except (ValueError, TypeError): raise ValueError("Réponse invalide")
    target = db.session.get(MODELS[kind], rid)
    if not target or not same_thread(kind, message, target) or not allowed(kind, target, uid):
        raise ValueError("Message de réponse introuvable dans cette conversation")
    ex = ChatExtra(kind=kind, message_id=message.id, reply_to_id=rid)
    db.session.add(ex)
    return ex

def register_chat_routes(users_bp):
    @users_bp.route("/chat/<string:kind>/<int:message_id>", methods=["GET", "DELETE"])
    @jwt_required()
    def chat_message_actions(kind, message_id):
        model = MODELS.get(kind)
        if model is None: return {"error": "Type inconnu"}, 404
        msg = db.session.get(model, message_id)
        uid = int(get_jwt_identity())
        if not msg: return {"error": "Message introuvable"}, 404
        if not allowed(kind, msg, uid): return {"error": "Accès interdit"}, 403
        if request.method == "GET": return {"message": enrich(kind, msg)}
        owner = msg.user_id if kind == "room" else msg.sender_id
        if owner != uid: return {"error": "Seul l'auteur peut supprimer son message"}, 403
        ex = extra_for(kind, message_id)
        if ex is None:
            ex = ChatExtra(kind=kind, message_id=message_id)
            db.session.add(ex)
        ex.deleted = True
        # Supprimer le contenu original en base, sans casser les réponses existantes.
        if kind == "room": msg.message = "Message supprimé"
        else: msg.content = "Message supprimé"
        ChatReaction.query.filter_by(kind=kind, message_id=message_id).delete()
        db.session.commit()
        _notify(kind, msg)
        return {"message": enrich(kind, msg)}

    @users_bp.post("/chat/<string:kind>/<int:message_id>/react")
    @jwt_required()
    def chat_react(kind, message_id):
        model = MODELS.get(kind)
        if model is None: return {"error": "Type inconnu"}, 404
        msg = db.session.get(model, message_id)
        uid = int(get_jwt_identity())
        if not msg: return {"error": "Message introuvable"}, 404
        if not allowed(kind, msg, uid): return {"error": "Accès interdit"}, 403
        if extra_for(kind, message_id) and extra_for(kind, message_id).deleted:
            return {"error": "Message supprimé"}, 409
        emoji = (request.get_json(silent=True) or {}).get("emoji")
        if emoji not in ("❤️", "👍", "😂", "😮", "😢", "🎉"):
            return {"error": "Réaction invalide"}, 400
        old = ChatReaction.query.filter_by(kind=kind, message_id=message_id, user_id=uid, emoji=emoji).first()
        if old: db.session.delete(old)
        else: db.session.add(ChatReaction(kind=kind, message_id=message_id, user_id=uid, emoji=emoji))
        db.session.commit()
        _notify(kind, msg)
        return {"message": enrich(kind, msg)}

def _notify(kind, msg):
    if kind == "group": socketio.emit("friend_group_updated", {"group_id": msg.group_id})
    elif kind == "room": socketio.emit("chat:changed", {"message_id": msg.id}, room=msg.room.code)
    else:
        for uid in (msg.sender_id, msg.receiver_id):
            socketio.emit("private_chat_updated", {"friend_id": msg.receiver_id if uid == msg.sender_id else msg.sender_id}, room=f"user:{uid}")
