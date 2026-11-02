from datetime import datetime

from ..extensions import db
from ..models import GameRoom
from ..games.config import get_game_config


from datetime import datetime

from ..games.config import get_game_config


def get_room_timeout_info(room):

    game_config = get_game_config(
        room.game_type
    )

    if not game_config:
        return {
            "timeout_seconds": 0,
            "remaining_seconds": 0,
            "expired": False
        }

    timeout_seconds = int(
        game_config.get(
            "room_timeout",
            300
        )
    )

    if not room.created_at:
        return {
            "timeout_seconds": timeout_seconds,
            "remaining_seconds": timeout_seconds,
            "expired": False
        }

    elapsed = (
        datetime.utcnow() -
        room.created_at
    ).total_seconds()

    remaining = max(
        0,
        timeout_seconds - elapsed
    )

    return {
        "timeout_seconds": timeout_seconds,
        "remaining_seconds": int(remaining),
        "expired": remaining <= 0
    }

def expire_waiting_rooms():
    """
    Ferme les salles WAITING ayant dépassé
    le room_timeout défini par leur jeu.

    Retourne le nombre de salles expirées.
    """

    now = datetime.utcnow()

    rooms = GameRoom.query.filter_by(
        status="WAITING"
    ).all()

    expired_count = 0

    for room in rooms:

        game_config = get_game_config(
            room.game_type
        )

        # Configuration inconnue :
        # on ne détruit rien automatiquement.
        if not game_config:
            continue

        timeout_seconds = int(
            game_config.get(
                "room_timeout",
                300
            )
        )

        if not room.created_at:
            continue

        age_seconds = (
            now - room.created_at
        ).total_seconds()

        if age_seconds >= timeout_seconds:

            room.status = "CANCELLED"
            room.finished_at = now

            expired_count += 1

    if expired_count:
        db.session.commit()

    return expired_count

def reconcile_playing_rooms():
    """Clôture les parties orphelines ou sans joueur depuis 5 minutes.

    Appeler depuis la consultation du lobby et des salles. Pour une application
    multi-processus, utiliser un stockage partagé pour les parties et présences.
    """
    from ..games.president.state import games
    from ..games.president.socket_events import present_user_ids
    from ..models import GameRoomMember
    now = datetime.utcnow()
    count = 0
    for room in GameRoom.query.filter_by(game_type="PRESIDENT", status="PLAYING").all():
        game = games.get(room.id)
        if game is None:
            room.status = "ABANDONED"
        elif game.finished:
            # La persistance des résultats est assurée par les routes Président.
            room.status = "FINISHED"
        else:
            players = {m.user_id for m in GameRoomMember.query.filter_by(room_id=room.id, role="PLAYER").all()}
            if present_user_ids(room.id) & players:
                continue
            last_seen = room.last_activity_at or room.started_at or room.created_at
            if last_seen and (now - last_seen).total_seconds() < 300:
                continue
            room.status = "ABANDONED"
        room.finished_at = now
        count += 1
    if count:
        db.session.commit()
    return count