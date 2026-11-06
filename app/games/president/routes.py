from datetime import datetime

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from .state import games
from .socket_events import broadcast_game_state, present_user_ids
from ...extensions import db
from ...models import GameRoom, GameRoomMember, PresidentResult
from .game import PresidentGame
from ..config import get_game_config
from ..turn_timer import (
    get_turn_timeout_info,
    is_turn_expired
)



president_bp = Blueprint(
    "president",
    __name__,
    url_prefix="/api/games/president"
)

def get_room_or_404(room_code):
    room = GameRoom.query.filter_by(code=room_code.upper()).first()
    if not room:
        return None
    return room

def get_member(room_id, user_id):
    return GameRoomMember.query.filter_by(
        room_id=room_id,
        user_id=user_id
    ).first()

def get_game(room):
    return games.get(room.id)

def persist_finished_game(room, game):
    """Persist each player's placement once; no invented historic wins/coins."""
    if not game.finished or len(game.results) != len(game.players):
        return
    # A unique constraint also guards against duplicate results.
    if PresidentResult.query.filter_by(room_id=room.id).first():
        return
    for position, user_id in enumerate(game.results, 1):
        db.session.add(PresidentResult(room_id=room.id, user_id=user_id,
                                      position=position, players_count=len(game.players)))
    db.session.flush()



def process_turn_timeout(room, game):
    """
    Vérifie si le tour courant est expiré.

    Retourne True uniquement si une action
    automatique a réellement été effectuée.
    """

    if not game:
        return False

    if not game.started or game.finished:
        return False

    config = get_game_config(
        room.game_type
    )

    timeout_seconds = int(
        config.get(
            "turn_timeout",
            15
        )
    )

    if not is_turn_expired(
        game,
        timeout_seconds
    ):
        return False

    game.handle_turn_timeout()

    if game.finished:
        room.status = "FINISHED"
        room.finished_at = datetime.utcnow()
        persist_finished_game(room, game)
        db.session.commit()

    broadcast_game_state(room)

    return True

def build_game_state(room, game, user_id):

    state = game.public_state_for(user_id)
    member = get_member(room.id, user_id)
    state["viewer_role"] = member.role if member else None
    if member and member.role == "SPECTATOR":
        state["your_hand"] = []
        state["can_play"] = False
        state["can_pass"] = False

    members = GameRoomMember.query.filter_by(
        room_id=room.id
    ).all()

    usernames = {
        member.user_id: member.user.username
        for member in members
        if member.user
    }

    pseudos = {
        member.user_id: (
                member.user.pseudo or member.user.username
        )
        for member in members
        if member.user
    }

    avatars = {
        member.user_id: member.user.avatar_url
        for member in members
        if member.user
    }

    for player in state.get("players", []):
        uid = player.get("user_id")

        player["username"] = usernames.get(
            uid,
            f"Joueur #{uid}"
        )
        player["pseudo"] = pseudos.get(
            uid,
            f"Joueur #{uid}"
        )

        player["avatar_url"] = avatars.get(uid)

    for result in state.get("results", []):
        uid = result.get("user_id")

        result["username"] = usernames.get(
            uid,
            f"Joueur #{uid}"
        )
        result["pseudo"] = pseudos.get(
            uid,
            f"Joueur #{uid}"
        )

    # Pseudos des joueurs dans les derniers coups.
    for history_key in ("last_plays", "last_three_plays"):
        history = state.get(history_key)
        if isinstance(history, list):
            for entry in history:
                if not isinstance(entry, dict):
                    continue
                uid = entry.get("user_id")
                if uid is not None:
                    entry["pseudo"] = pseudos.get(
                        uid, entry.get("pseudo") or entry.get("username") or f"Joueur #{uid}"
                    )

    config = get_game_config(
        room.game_type
    )

    timeout_seconds = int(
        config.get(
            "turn_timeout",
            15
        )
    )

    state["turn_timer"] = (
        get_turn_timeout_info(
            game,
            timeout_seconds
        )
    )

    # Même présence côté HTTP et côté Socket.IO.
    # Sans cela, un rafraîchissement HTTP remet les points en noir.
    state["presence"] = list(present_user_ids(room.id))

    return state

def start_president_game(room):
    """
    Démarre réellement une partie Président.

    Cette fonction peut être utilisée :
    - par le bouton Démarrer
    - par l'auto-start lorsque la salle est pleine
    """

    if room.status != "WAITING":
        raise ValueError(
            "This room cannot be started"
        )

    player_members = (
        GameRoomMember.query
        .filter_by(
            room_id=room.id,
            role="PLAYER"
        )
        .all()
    )

    game_config = get_game_config(
        room.game_type
    )

    min_players = int(
        game_config["min_players"]
    )

    if len(player_members) < min_players:
        raise ValueError(
            f"Il faut au moins "
            f"{min_players} joueurs "
            f"pour démarrer la partie."
        )

    game = get_game(room)

    if game is None:

        game = PresidentGame(
            room.id
        )

        games[room.id] = game

        for player in player_members:
            game.add_player(
                player.user_id
            )

    game.start()

    room.status = "PLAYING"
    room.started_at = datetime.utcnow()
    room.last_activity_at = room.started_at

    db.session.commit()

    broadcast_game_state(
        room
    )

    return game

@president_bp.post("/<string:room_code>/start")
@jwt_required()
def start_game(room_code):

    user_id = int(get_jwt_identity())

    room = get_room_or_404(room_code)

    if not room:
        return {
            "error": "Room not found"
        }, 404

    # Vérifie qu'on est bien dans une salle President
    if room.game_type != "PRESIDENT":
        return {
            "error": "This room is not a President room"
        }, 400

    # Seul le créateur/propriétaire peut démarrer
    if int(room.owner_id) != int(user_id):
        return {
            "error": "Only the room owner can start the game"
        }, 403

    # Le propriétaire doit aussi être joueur
    member = get_member(
        room.id,
        user_id
    )

    if not member or member.role != "PLAYER":
        return {
            "error": "Room owner is not a player"
        }, 403

    # La salle doit encore être en attente
    if room.status != "WAITING":
        return {
            "error": "This room cannot be started"
        }, 409

    try:

        game = start_president_game(
            room
        )

    except ValueError as exc:

        return {
            "error": str(exc)
        }, 400

    return {
        "message": "President game started",
        "state": build_game_state(
            room,
            game,
            user_id
        )
    }

@president_bp.get("/<string:room_code>")
@jwt_required()
def get_state(room_code):

    user_id = int(get_jwt_identity())

    room = get_room_or_404(room_code)

    if not room:
        return {
            "error": "Room not found"
        }, 404


    member = get_member(
        room.id,
        user_id
    )

    if not member:
        return {
            "error": "You are not in this room"
        }, 403


    game = get_game(room)

    if not game:
        return {
            "started": False,
            "state": None
        }

    process_turn_timeout(
        room,
        game
    )
    return {
        "started": game.started,
        "state": build_game_state(
            room,
            game,
            user_id
        )
    }

@president_bp.post("/<string:room_code>/play")
@jwt_required()
def play_cards(room_code):
    user_id = int(get_jwt_identity())
    room = get_room_or_404(room_code)

    if not room:
        return {"error": "Room not found"}, 404

    member = get_member(room.id, user_id)
    if not member or member.role != "PLAYER":
        return {"error": "Only a player can play"}, 403

    game = get_game(room)
    if not game:
        return {"error": "Game has not started"}, 400

    data = request.get_json() or {}
    card_ids = data.get("card_ids", [])

    timeout_processed = process_turn_timeout(
        room,
        game
    )

    if timeout_processed:
        return {
            "error": (
                "Ton temps est écoulé. "
                "Le tour a déjà changé."
            )
        }, 409

    try:
        game.play(user_id, card_ids)
        if game.finished:
            room.status = "FINISHED"
            room.finished_at = datetime.utcnow()
            persist_finished_game(room, game)
            db.session.commit()
        broadcast_game_state(room)
    except ValueError as exc:
        return {"error": str(exc)}, 400

    return {
        "message": "Cards played",
        "state": build_game_state(
            room,
            game,
            user_id
        )
    }

@president_bp.post("/<string:room_code>/pass")
@jwt_required()
def pass_turn(room_code):
    user_id = int(get_jwt_identity())
    room = get_room_or_404(room_code)

    if not room:
        return {"error": "Room not found"}, 404

    member = get_member(room.id, user_id)
    if not member or member.role != "PLAYER":
        return {"error": "Only a player can pass"}, 403

    game = get_game(room)
    if not game:
        return {"error": "Game has not started"}, 400

    timeout_processed = process_turn_timeout(
        room,
        game
    )

    if timeout_processed:
        return {
            "error": (
                "Ton temps est écoulé. "
                "Le tour a déjà changé."
            )
        }, 409

    try:
        game.pass_turn(user_id)
        broadcast_game_state(room)
    except ValueError as exc:
        return {"error": str(exc)}, 400

    return {
        "message": "Pass",
        "state": build_game_state(
            room,
            game,
            user_id
        )
    }

@president_bp.post("/<string:room_code>/royal-vision")
@jwt_required()
def use_royal_vision(room_code):
    """Renvoie une photographie d'une main, une seule fois, pendant 5 s."""
    user_id = int(get_jwt_identity())
    room = get_room_or_404(room_code)
    if room is None:
        return {"error": "Salon introuvable"}, 404
    member = get_member(room.id, user_id)
    if not member or member.role != "PLAYER":
        return {"error": "Réservé aux joueurs de la manche"}, 403
    game = get_game(room)
    if not game or not game.started:
        return {"error": "Aucune manche en cours"}, 409
    data = request.get_json(silent=True) or {}
    try:
        target_id = int(data.get("target_user_id"))
    except (ValueError, TypeError):
        return {"error": "Joueur cible invalide"}, 400
    try:
        cards = game.use_royal_vision(user_id, target_id)
    except ValueError as exc:
        return {"error": str(exc)}, 403
    # Ne jamais inclure les mains adverses dans l'état public ou les sockets.
    return {"target_user_id": target_id, "cards": cards, "used": True}