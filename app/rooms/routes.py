import secrets

from flask import Blueprint, request, current_app

from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity
)

from ..extensions import db

from ..models import (
    GameRoom,
    GameRoomMember
)

from ..games.config import (
    GAME_CONFIG,
    get_game_config
)

from ..games.president.socket_events import (
    broadcast_room_update
)

from .service import (
    expire_waiting_rooms,
    get_room_timeout_info,
    reconcile_playing_rooms
)

rooms_bp = Blueprint(
    "rooms",
    __name__,
    url_prefix="/api/rooms"
)


# =========================================================
# CREATE ROOM
# =========================================================
def generate_room_code():

    while True:

        code = secrets.token_hex(4).upper()

        existing_room = (
            GameRoom.query.filter_by(
                code=code
            ).first()
        )

        if not existing_room:
            return code

@rooms_bp.post("")
@jwt_required()
def create_room():

    user_id = int(
        get_jwt_identity()
    )

    data = request.get_json(
        silent=True
    ) or {}

    game_type = str(
        data.get("game_type", "")
    ).upper()

    game_config = get_game_config(
        game_type
    )

    # Jeu inconnu
    if not game_config:

        return {
            "error": "Game not available",
            "available_games": list(
                GAME_CONFIG.keys()
            )
        }, 400

    # Jeu connu mais pas encore activé
    if not game_config.get(
        "enabled",
        False
    ):

        return {
            "error":
                "This game is not available yet"
        }, 400

    room_mode = str(
        data.get(
            "room_mode",
            "NORMAL"
        )
    ).upper()

    visibility = str(
        data.get(
            "visibility",
            "PUBLIC"
        )
    ).upper()

    if room_mode not in [
        "NORMAL",
        "TOURNAMENT"
    ]:
        return {
            "error":
                "room_mode must be NORMAL or TOURNAMENT"
        }, 400

    if visibility not in [
        "PUBLIC",
        "PRIVATE"
    ]:
        return {
            "error":
                "visibility must be PUBLIC or PRIVATE"
        }, 400
    try:
        max_players = int(
            data.get(
                "max_players",
                game_config["max_players"]
            )
        )

    except (TypeError, ValueError):
        return {
            "error":
                "max_players must be a number"
        }, 400

    min_players = int(
        game_config["min_players"]
    )

    game_max_players = int(
        game_config["max_players"]
    )

    if (
            max_players < min_players
            or
            max_players > game_max_players
    ):
        return {
            "error": (
                f"max_players must be between "
                f"{min_players} and "
                f"{game_max_players}"
            )
        }, 400

    room = GameRoom(
        code=generate_room_code(),
        game_type=game_type,
        owner_id=user_id,

        room_mode=room_mode,
        visibility=visibility,

        max_players=max_players,
        status="WAITING"
    )

    db.session.add(room)
    db.session.flush()

    # Le propriétaire est aussi joueur.
    member = GameRoomMember(
        room_id=room.id,
        user_id=user_id,
        role="PLAYER"
    )

    db.session.add(member)

    db.session.commit()

    return {
        "message": "Room created",
        "room": room.to_dict(),
        "game_config": {
            "min_players":
                game_config["min_players"],

            "max_players":
                game_config["max_players"],

            "room_timeout":
                game_config["room_timeout"],

            "turn_timeout":
                game_config["turn_timeout"]
        }
    }, 201


# =========================================================
# JOIN ROOM
# =========================================================

@rooms_bp.post(
    "/<string:room_code>/join"
)
@jwt_required()
def join_room(room_code):

    user_id = int(
        get_jwt_identity()
    )

    room = GameRoom.query.filter_by(
        code=room_code.upper()
    ).first()

    if not room:

        return {
            "error": "Room not found"
        }, 404

    expire_waiting_rooms()
    reconcile_playing_rooms()
    db.session.refresh(room)

    existing_member = GameRoomMember.query.filter_by(
        room_id=room.id, user_id=user_id
    ).first()
    if existing_member:
        # Un membre déjà inscrit peut revenir même si la salle est pleine.
        # Les états clos restent consultables, mais ne sont pas rejoints comme une partie active.
        if room.status not in ("WAITING", "PLAYING"):
            return {"error": "Cette partie est terminée ou indisponible"}, 409
        broadcast_room_update(room)
        return {
            "message": "Already in room",
            "room": room.to_dict(),
            "member": existing_member.to_dict()
        }

    data = request.get_json(silent=True) or {}
    role = str(data.get("role", "PLAYER")).upper()
    if role not in ("PLAYER", "SPECTATOR"):
        return {"error": "role must be PLAYER or SPECTATOR"}, 400

    if room.status not in ("WAITING", "PLAYING"):
        return {"error": "This room is not available"}, 409
    if room.status == "PLAYING" and role != "SPECTATOR":
        return {"error": "La partie a commencé : entrée spectateur uniquement"}, 409
    if role == "SPECTATOR" and room.game_type != "PRESIDENT":
        return {"error": "Spectator mode unavailable for this game"}, 409

    if role == "PLAYER":
        player_count = GameRoomMember.query.filter_by(
            room_id=room.id, role="PLAYER"
        ).count()
        if player_count >= room.max_players:
            return {"error": "Room is full"}, 409

    member = GameRoomMember(
        room_id=room.id,
        user_id=user_id,
        role=role
    )

    db.session.add(member)
    db.session.commit()
    # ==========================================
    # AUTO-START SI LA SALLE EST PLEINE
    # ==========================================

    if (
            role == "PLAYER"
            and room.game_type == "PRESIDENT"
            and room.status == "WAITING"
    ):

        player_count = (
            GameRoomMember.query
            .filter_by(
                room_id=room.id,
                role="PLAYER"
            )
            .count()
        )

        if player_count >= room.max_players:

            from ..games.president.routes import (
                start_president_game
            )

            try:

                start_president_game(
                    room
                )

            except ValueError as exc:
                db.session.rollback()
                current_app.logger.warning(
                    "Démarrage Président refusé pour %s : %s", room.code, exc
                )
                broadcast_room_update(room)
                return {"error": str(exc)}, 409

            except Exception:
                # Traceback complet dans la console Flask : utile pour trouver
                # la vraie cause (moteur, migration SQL, événement Socket.IO...).
                db.session.rollback()
                current_app.logger.exception(
                    "Échec du démarrage automatique de la salle %s", room.code
                )
                # Le membre reste enregistré : une nouvelle tentative ne
                # consommera pas une troisième place dans la salle.
                broadcast_room_update(room)
                return {
                    "error": "Le joueur est inscrit, mais le démarrage de la partie a échoué. Consulte les logs Flask.",
                    "code": "PRESIDENT_START_FAILED",
                    "room_code": room.code
                }, 503
    broadcast_room_update(room)

    return {
        "message": "Joined room",
        "room": room.to_dict(),
        "member": member.to_dict()
    }


# =========================================================
# LIST ROOMS
# =========================================================

@rooms_bp.get("")
@jwt_required()
def list_rooms():
    expire_waiting_rooms()
    reconcile_playing_rooms()

    # Pour la page d'un jeu, seules les salles
    # réellement rejoignables nous intéressent.
    rooms = GameRoom.query.filter(
        GameRoom.visibility == "PUBLIC",
        GameRoom.status.in_(["WAITING", "PLAYING"])
    ).order_by(
        GameRoom.created_at.desc()
    ).all()

    room_list = []

    for room in rooms:
        data = room.to_dict()

        players = (
            GameRoomMember.query.filter_by(
                room_id=room.id,
                role="PLAYER"
            )
            .order_by(
                GameRoomMember.joined_at.asc()
            )
            .all()
        )

        data["player_count"] = len(
            players
        )

        data["players"] = [
            {
                "user_id":
                    player.user_id,

                "username":
                    player.user.username
                    if player.user
                    else f"Joueur #{player.user_id}",

                "pseudo": (
                    player.user.pseudo or player.user.username
                    if player.user
                    else f"Joueur #{player.user_id}"
                ),

                "avatar_url":
                    player.user.avatar_url
                    if player.user
                    else None
            }
            for player in players
        ]

        room_list.append(data)
    return {
        "rooms": room_list
    }


# =========================================================
# GET ROOM
# =========================================================

@rooms_bp.get("/<string:room_code>")
@jwt_required()
def get_room(room_code):
    reconcile_playing_rooms()

    # Ferme d'abord toutes les salles expirées
    expire_waiting_rooms()

    room = GameRoom.query.filter_by(
        code=room_code.upper()
    ).first()

    if not room:
        return {
            "error": "Room not found"
        }, 404

    game_config = get_game_config(
        room.game_type
    )

    if not game_config:
        return {
            "error": "Invalid game configuration"
        }, 500

    members = (
        GameRoomMember.query.filter_by(
            room_id=room.id
        ).all()
    )

    timeout_info = get_room_timeout_info(
        room
    )

    return {
        "room": room.to_dict(),

        "members": [
            member.to_dict()
            for member in members
        ],

        "game_config": {
            "name": game_config["name"],
            "emoji": game_config["emoji"],
            "min_players": game_config["min_players"],
            "max_players": game_config["max_players"],
            "turn_timeout": game_config["turn_timeout"]
        },

        "timeout": timeout_info
    }

# =========================================================
# LEAVE ROOM
# =========================================================

@rooms_bp.post(
    "/<string:room_code>/leave"
)
@jwt_required()
def leave_room(room_code):

    user_id = int(
        get_jwt_identity()
    )

    room = GameRoom.query.filter_by(
        code=room_code.upper()
    ).first()

    if not room:

        return {
            "error": "Room not found"
        }, 404

    member = (
        GameRoomMember.query.filter_by(
            room_id=room.id,
            user_id=user_id
        ).first()
    )

    if not member:

        return {
            "error":
                "You are not in this room"
        }, 404

    db.session.delete(member)
    db.session.commit()

    # Prévenir immédiatement les autres membres.
    broadcast_room_update(room)

    return {
        "message":
            "You left the room"
    }

# Mes parties : API JWT reutilisable par le web et le mobile.
@rooms_bp.get("/my")
@jwt_required()
def my_rooms():
    from ..models import PresidentResult, User

    user_id = int(get_jwt_identity())
    expire_waiting_rooms()
    reconcile_playing_rooms()

    active = (
        GameRoom.query.join(GameRoomMember, GameRoomMember.room_id == GameRoom.id)
        .filter(GameRoomMember.user_id == user_id,
                GameRoomMember.role == "PLAYER",
                GameRoom.status.in_(("WAITING", "PLAYING")))
        .order_by(GameRoom.created_at.desc(), GameRoom.id.desc()).first()
    )

    member_room_ids = db.session.query(GameRoomMember.room_id).filter(
        GameRoomMember.user_id == user_id, GameRoomMember.role == "PLAYER"
    )
    result_room_ids = db.session.query(PresidentResult.room_id).filter(
        PresidentResult.user_id == user_id
    )
    finished = (
        GameRoom.query.filter(
            GameRoom.status == "FINISHED",
            db.or_(GameRoom.id.in_(member_room_ids), GameRoom.id.in_(result_room_ids))
        )
        .order_by(GameRoom.finished_at.desc().nullslast(), GameRoom.id.desc())
        .limit(2).all()
    )
    results = {}
    if finished:
        results = {result.room_id: result for result in PresidentResult.query.filter(
            PresidentResult.user_id == user_id,
            PresidentResult.room_id.in_([room.id for room in finished])
        ).all()}

    # Le vainqueur est le joueur classe premier, pas necessairement l'utilisateur connecte.
    winners = {}
    if finished:
        winning_rows = (
            db.session.query(PresidentResult.room_id, User.username)
            .join(User, User.id == PresidentResult.user_id)
            .filter(PresidentResult.room_id.in_([room.id for room in finished]),
                    PresidentResult.position == 1)
            .all()
        )
        winners = {room_id: username for room_id, username in winning_rows}

    history = []
    for room in finished:
        data = room.to_dict()
        result = results.get(room.id)
        data["position"] = result.position if result else None
        data["players_count"] = result.players_count if result else None
        data["winner_username"] = winners.get(room.id)
        history.append(data)

    return {
        "active_room": active.to_dict() if active else None,
        "recent_finished": history,
    }