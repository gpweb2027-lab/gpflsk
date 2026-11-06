from flask import Blueprint, request

from datetime import datetime
from sqlalchemy.exc import IntegrityError
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity
)

from ..extensions import db
from ..models import User, FriendRequest, PrivateMessage, PresidentResult
from ..games.president.socket_events import is_user_online
users_bp = Blueprint(
    "users",
    __name__,
    url_prefix="/api/users"
)

@users_bp.get("/me")
@jwt_required()
def get_current_user():

    user_id = get_jwt_identity()

    user = User.query.get(int(user_id))

    if not user:

        return {
            "error": "User not found"
        }, 404

    return {
        "user": user.to_dict()
    }

@users_bp.post("/friends/request")
@jwt_required()
def send_friend_request():

    sender_id = int(get_jwt_identity())

    data = request.get_json(silent=True) or {}

    try:
        receiver_id = int(data.get("receiver_id"))
    except (TypeError, ValueError):
        return {"error": "Identifiant du joueur invalide"}, 400

    if sender_id == receiver_id:
        return {
            "error": "Tu ne peux pas t'ajouter toi-même en ami"
        }, 400

    receiver = db.session.get(User, receiver_id)

    if not receiver:
        return {"error": "Joueur introuvable"}, 404

    # Vérifier les demandes dans les deux sens.
    existing = FriendRequest.query.filter(
        db.or_(
            db.and_(
                FriendRequest.sender_id == sender_id,
                FriendRequest.receiver_id == receiver_id
            ),
            db.and_(
                FriendRequest.sender_id == receiver_id,
                FriendRequest.receiver_id == sender_id
            )
        )
    ).first()

    if existing:

        if existing.status == "ACCEPTED":
            return {"error": "Vous êtes déjà amis"}, 409

        if existing.status == "PENDING":
            if existing.sender_id == sender_id:
                return {"error": "Demande déjà envoyée"}, 409

            return {
                "error": "Ce joueur t'a déjà envoyé une demande d'ami"
            }, 409

        # Une ancienne demande refusée peut être renouvelée.
        existing.sender_id = sender_id
        existing.receiver_id = receiver_id
        existing.status = "PENDING"
        existing.created_at = datetime.utcnow()

        friend_request = existing

    else:
        friend_request = FriendRequest(
            sender_id=sender_id,
            receiver_id=receiver_id,
            status="PENDING"
        )

        db.session.add(friend_request)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {
            "error": "Une demande existe déjà entre ces joueurs"
        }, 409

    return {
        "message": "Demande d'ami envoyée",
        "friend_request": friend_request.to_dict()
    }, 201

@users_bp.get("/friends/requests")
@jwt_required()
def get_friend_requests():

    user_id = int(get_jwt_identity())

    requests = (
        FriendRequest.query
        .filter_by(
            receiver_id=user_id,
            status="PENDING"
        )
        .order_by(FriendRequest.created_at.desc())
        .all()
    )

    return {
        "requests": [
            {
                "id": friend_request.id,
                "sender_id": friend_request.sender_id,
                "pseudo": friend_request.sender.pseudo or friend_request.sender.username,
                "avatar_url": friend_request.sender.avatar_url,
                "created_at": (
                    friend_request.created_at.isoformat() + "Z"
                    if friend_request.created_at
                    else None
                )
            }
            for friend_request in requests
        ]
    }, 200

@users_bp.post("/friends/requests/<int:request_id>/respond")
@jwt_required()
def respond_friend_request(request_id):

    user_id = int(get_jwt_identity())

    friend_request = db.session.get(
        FriendRequest,
        request_id
    )

    if not friend_request:
        return {
            "error": "Demande d'ami introuvable"
        }, 404

    # Seul le destinataire peut répondre.
    if friend_request.receiver_id != user_id:
        return {
            "error": "Tu ne peux pas répondre à cette demande"
        }, 403

    if friend_request.status != "PENDING":
        return {
            "error": "Cette demande a déjà été traitée"
        }, 409

    data = request.get_json(silent=True) or {}

    action = data.get("action")

    if action == "accept":
        friend_request.status = "ACCEPTED"
        message = "Demande d'ami acceptée !"

    elif action == "reject":
        friend_request.status = "REJECTED"
        message = "Demande d'ami refusée."

    else:
        return {
            "error": "Action invalide : utilise accept ou reject"
        }, 400

    db.session.commit()

    return {
        "message": message,
        "friend_request": friend_request.to_dict()
    }, 200

@users_bp.get("/friends")
@jwt_required()
def get_friends():

    user_id = int(get_jwt_identity())

    friendships = FriendRequest.query.filter(
        FriendRequest.status == "ACCEPTED",
        db.or_(
            FriendRequest.sender_id == user_id,
            FriendRequest.receiver_id == user_id
        )
    ).all()

    friends = []

    for friendship in friendships:

        if friendship.sender_id == user_id:
            friend = friendship.receiver
        else:
            friend = friendship.sender

        friends.append({
            "id": friend.id,
            "username": friend.username,
            "pseudo": friend.pseudo or friend.username,
            "avatar_url": friend.avatar_url,
            "is_online": is_user_online(friend.id)
        })

    return {
        "friends": friends
    }, 200

@users_bp.post("/messages/<int:receiver_id>")
@jwt_required()
def send_private_message(receiver_id):

    sender_id = int(get_jwt_identity())

    if sender_id == receiver_id:
        return {"error": "Tu ne peux pas t'envoyer de message."}, 400

    receiver = db.session.get(User, receiver_id)

    if not receiver:
        return {"error": "Joueur introuvable."}, 404

    # Vérifier que les deux joueurs sont amis.
    friendship = FriendRequest.query.filter(
        FriendRequest.status == "ACCEPTED",
        db.or_(
            db.and_(
                FriendRequest.sender_id == sender_id,
                FriendRequest.receiver_id == receiver_id
            ),
            db.and_(
                FriendRequest.sender_id == receiver_id,
                FriendRequest.receiver_id == sender_id
            )
        )
    ).first()

    if not friendship:
        return {
            "error": "Tu dois être ami avec ce joueur pour lui écrire."
        }, 403

    data = request.get_json(silent=True) or {}
    content = data.get("content")

    if not isinstance(content, str):
        return {"error": "Message invalide."}, 400

    content = content.strip()

    if not content:
        return {"error": "Le message ne peut pas être vide."}, 400

    if len(content) > 2000:
        return {"error": "Message trop long (2000 caractères maximum)."}, 400

    message = PrivateMessage(
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content
    )

    db.session.add(message)
    db.session.flush()
    try:
        set_reply("private", message, data.get("reply_to_id"), sender_id)
    except ValueError as exc:
        db.session.rollback()
        return {"error": str(exc)}, 400
    db.session.commit()

    return {
        "message": "Message envoyé !",
        "private_message": enrich("private", message)
    }, 201

@users_bp.get("/messages/<int:friend_id>")
@jwt_required()
def get_private_messages(friend_id):

    user_id = int(get_jwt_identity())

    if user_id == friend_id:
        return {"error": "Conversation invalide."}, 400

    friend = db.session.get(User, friend_id)

    if not friend:
        return {"error": "Joueur introuvable."}, 404

    # Vérifier que les deux joueurs sont amis.
    friendship = FriendRequest.query.filter(
        FriendRequest.status == "ACCEPTED",
        db.or_(
            db.and_(
                FriendRequest.sender_id == user_id,
                FriendRequest.receiver_id == friend_id
            ),
            db.and_(
                FriendRequest.sender_id == friend_id,
                FriendRequest.receiver_id == user_id
            )
        )
    ).first()

    if not friendship:
        return {
            "error": "Tu dois être ami avec ce joueur pour lire cette conversation."
        }, 403

    # Récupérer les messages dans les deux sens.
    messages = PrivateMessage.query.filter(
        db.or_(
            db.and_(
                PrivateMessage.sender_id == user_id,
                PrivateMessage.receiver_id == friend_id
            ),
            db.and_(
                PrivateMessage.sender_id == friend_id,
                PrivateMessage.receiver_id == user_id
            )
        )
    ).order_by(
        PrivateMessage.created_at.asc(),
        PrivateMessage.id.asc()
    ).all()
    # Marquer comme lus les messages reçus de cet ami.
    unread_messages = PrivateMessage.query.filter_by(
        sender_id=friend_id,
        receiver_id=user_id,
        is_read=False
    ).all()

    for message in unread_messages:
        message.is_read = True

    if unread_messages:
        db.session.commit()
    return {
        "friend": {
            "id": friend.id,
            "username": friend.username,
            "pseudo": friend.pseudo or friend.username,
            "avatar_url": friend.avatar_url
        },
        "messages": [
            message.to_dict()
            for message in messages
        ]
    }, 200

# Conversations recentes : lecture seule, ne marque jamais les messages comme lus.
# Utilisable par le lobby web et les futurs clients mobiles.
@users_bp.get("/messages/recent")
@jwt_required()
def get_recent_private_conversations():
    from sqlalchemy import func, case

    user_id = int(get_jwt_identity())
    partner_id = case(
        (PrivateMessage.sender_id == user_id, PrivateMessage.receiver_id),
        else_=PrivateMessage.sender_id
    )
    ranked = (
        db.session.query(
            PrivateMessage.id.label("message_id"),
            partner_id.label("partner_id"),
            func.row_number().over(
                partition_by=partner_id,
                order_by=(PrivateMessage.created_at.desc(), PrivateMessage.id.desc())
            ).label("rank")
        )
        .filter(db.or_(PrivateMessage.sender_id == user_id,
                       PrivateMessage.receiver_id == user_id))
        .subquery()
    )
    latest = (
        db.session.query(PrivateMessage, ranked.c.partner_id)
        .join(ranked, PrivateMessage.id == ranked.c.message_id)
        .filter(ranked.c.rank == 1)
        .order_by(PrivateMessage.created_at.desc(), PrivateMessage.id.desc())
        .limit(30)
        .all()
    )
    if not latest:
        return {"conversations": []}, 200

    ids = [partner for _, partner in latest]
    users = {user.id: user for user in User.query.filter(User.id.in_(ids)).all()}
    unread = dict(
        db.session.query(PrivateMessage.sender_id, func.count(PrivateMessage.id))
        .filter(PrivateMessage.receiver_id == user_id,
                PrivateMessage.is_read.is_(False),
                PrivateMessage.sender_id.in_(ids))
        .group_by(PrivateMessage.sender_id).all()
    )
    conversations = []
    for message, partner in latest:
        friend = users.get(partner)
        if friend is None:
            continue
        conversations.append({
            "friend": {"id": friend.id,
                       "username": friend.username,
                       "pseudo": friend.pseudo or friend.username,
                       "avatar_url": friend.avatar_url},
            "last_message": {"id": message.id, "content": message.content,
                             "sender_id": message.sender_id,
                             "created_at": message.created_at.isoformat() + "Z"
                             if message.created_at else None},
            "unread_count": unread.get(partner, 0)
        })
    return {"conversations": conversations}, 200


@users_bp.get("/messages/unread")
@jwt_required()
def get_unread_private_messages():

    user_id = int(get_jwt_identity())

    unread_messages = (
        PrivateMessage.query
        .filter_by(
            receiver_id=user_id,
            is_read=False
        )
        .all()
    )

    unread_by_sender = {}

    for message in unread_messages:
        sender_id = message.sender_id

        unread_by_sender[sender_id] = (
            unread_by_sender.get(sender_id, 0) + 1
        )

    return {
        "unread_count": len(unread_messages),
        "unread_by_sender": unread_by_sender
    }, 200


# Profile fields are filtered on the server; never expose User.to_dict() publicly.
def _profile_payload(user, owner=False):
    from datetime import datetime, timezone
    from sqlalchemy import func
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    data = {
        "id": user.id,
        "username": user.username,
        "pseudo": user.pseudo or user.username,
        "avatar_url": user.avatar_url,
        "banner_url": user.banner_url, "bio": user.bio,
        "account_days": max(0, (datetime.now(timezone.utc).date() - user.created_at.date()).days) if user.created_at else None,
        "is_online": is_user_online(user.id), "is_owner": owner,
    }
    if owner:
        data["privacy"] = {"show_location": user.show_location, "show_stats": user.show_stats, "show_coins": user.show_coins}
        data["country_code"] = user.country_code
        data["timezone"] = user.timezone
        data["coins"] = user.coins
    else:
        if user.show_coins:
            data["coins"] = user.coins
        if user.show_location:
            if user.country_code:
                data["country_code"] = user.country_code
            if user.timezone:
                data["timezone"] = user.timezone
    if owner or user.show_stats:
        results = db.session.query(PresidentResult.position, func.count(PresidentResult.id)).filter_by(user_id=user.id).group_by(PresidentResult.position).all()
        played = sum(count for _, count in results)
        wins = sum(count for position, count in results if position == 1)
        data["stats"] = {"played": played, "wins": wins, "losses": played - wins,
                         "win_rate": round(100 * wins / played, 1) if played else 0,
                         "placements": {str(pos): count for pos, count in results}}
    return data

@users_bp.get("/profile/<int:player_id>")
@jwt_required()
def public_profile(player_id):
    user = db.session.get(User, player_id)
    if not user:
        return {"error": "Joueur introuvable"}, 404
    return {"profile": _profile_payload(user, int(get_jwt_identity()) == player_id)}

@users_bp.patch("/profile/me")
@jwt_required()
def update_profile():
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    from sqlalchemy.exc import IntegrityError
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        return {"error": "Utilisateur introuvable"}, 404
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return {"error": "JSON invalide"}, 400
    if "pseudo" in data:
        pseudo = data["pseudo"]

        if not isinstance(pseudo, str) or not 3 <= len(pseudo.strip()) <= 50:
            return {"error": "Pseudo : 3 à 50 caractères"}, 400

        user.pseudo = pseudo.strip()
    if "bio" in data:
        bio = data["bio"]
        if not isinstance(bio, str) or len(bio) > 300:
            return {"error": "Message personnel trop long (300 caractères)"}, 400
        user.bio = bio.strip()
    for field in ("show_location", "show_stats", "show_coins"):
        if field in data:
            if not isinstance(data[field], bool):
                return {"error": f"{field} doit être un booléen"}, 400
            setattr(user, field, data[field])
    if "timezone" in data:
        tz = data["timezone"]
        if tz is not None:
            if not isinstance(tz, str) or len(tz) > 64:
                return {"error": "Fuseau horaire invalide"}, 400
            try:
                ZoneInfo(tz)
            except (ZoneInfoNotFoundError, ValueError):
                return {"error": "Fuseau horaire inconnu"}, 400
        user.timezone = tz
    if "country_code" in data:
        code = data["country_code"]
        if code is not None and (not isinstance(code, str) or len(code) != 2 or not code.isascii() or not code.isalpha()):
            return {"error": "Code pays invalide"}, 400
        user.country_code = code.upper() if code else None
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return {"error": "Ce pseudo est déjà utilisé"}, 409
    return {"profile": _profile_payload(user, True)}

from ..chat_features import register_chat_routes, enrich, set_reply
register_chat_routes(users_bp)