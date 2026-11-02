from flask import request, session
from threading import Lock
from flask_socketio import join_room, leave_room, emit
from flask_jwt_extended import decode_token
from ...extensions import socketio,db
from ...models import GameRoom, GameRoomMember, ChatMessage
from .state import games
from ...chat_features import enrich, set_reply
from datetime import datetime
from ..config import get_game_config
from ..turn_timer import get_turn_timeout_info

# Connexions Socket.IO actives, classées par utilisateur.
# Un joueur peut avoir plusieurs onglets ouverts.
online_users = {}
online_users_lock = Lock()
# Présence par salle : seuls les onglets ayant rejoint la salle comptent.
room_sids = {}  # sid -> (room_id, user_id)
room_sids_lock = Lock()

def present_user_ids(room_id):
    with room_sids_lock:
        return {uid for rid, uid in room_sids.values() if rid == room_id}

def _presence_members(room):
    present = present_user_ids(room.id)
    return [dict(member.to_dict(), is_present=member.user_id in present)
            for member in GameRoomMember.query.filter_by(room_id=room.id).all()]

def _leave_presence_sid(sid):
    with room_sids_lock:
        previous = room_sids.pop(sid, None)
    if previous:
        room = db.session.get(GameRoom, previous[0])
        if room:
            if room.status == "PLAYING" and not (present_user_ids(room.id) & {m.user_id for m in GameRoomMember.query.filter_by(room_id=room.id, role="PLAYER").all()}):
                room.last_activity_at = datetime.utcnow()
                db.session.commit()
            broadcast_room_update(room)
            if room.status == "PLAYING": broadcast_game_state(room)

def _join_presence_sid(room, user_id, sid):
    with room_sids_lock:
        previous = room_sids.get(sid)
        room_sids[sid] = (room.id, int(user_id))
    if previous and previous[0] != room.id:
        old_room = db.session.get(GameRoom, previous[0])
        if old_room: broadcast_room_update(old_room)
    if room.status == "PLAYING":
        room.last_activity_at = datetime.utcnow()
        db.session.commit()
    broadcast_room_update(room)
    if room.status == "PLAYING": broadcast_game_state(room)


def get_socket_user_id():
    return session.get("socketio_user_id")


def is_user_online(user_id):
    with online_users_lock:
        return bool(online_users.get(int(user_id)))

@socketio.on("connect")
def handle_connect(auth):
    auth = auth or {}
    token = auth.get("token")

    if not token:
        return False

    try:
        decoded = decode_token(token)
        user_id = int(decoded["sub"])
    except Exception:
        return False

    session["socketio_user_id"] = user_id
    with online_users_lock:
        online_users.setdefault(user_id, set()).add(request.sid)
    # Chaque utilisateur possède son propre canal.
    join_room(f"user:{user_id}")

    print(f"Socket.IO connecté : utilisateur {user_id}")

@socketio.on("disconnect")
def handle_disconnect():
    _voice_remove_sid(request.sid)
    _leave_presence_sid(request.sid)
    user_id = get_socket_user_id()

    if user_id is None:
        return

    with online_users_lock:
        connections = online_users.get(user_id)

        if connections:
            connections.discard(request.sid)

            if not connections:
                online_users.pop(user_id, None)

    print(f"Socket.IO déconnecté : utilisateur {user_id}")

@socketio.on("room:join")
def handle_room_join(data):
    user_id = get_socket_user_id()

    if not user_id:
        emit("room:error", {
            "error": "Utilisateur non authentifié"
        })
        return

    room_code = str(
        (data or {}).get("room_code", "")
    ).upper()

    room = GameRoom.query.filter_by(
        code=room_code
    ).first()

    if not room:
        emit("room:error", {
            "error": "Salle introuvable"
        })
        return

    member = GameRoomMember.query.filter_by(
        room_id=room.id,
        user_id=user_id
    ).first()

    if not member:
        emit("room:error", {
            "error": "Tu ne fais pas partie de cette salle"
        })
        return

    join_room(room.code)
    _join_presence_sid(room, user_id, request.sid)

    emit("room:joined", {
        "room_code": room.code,
        "user_id": user_id,
        "role": member.role
    })
    members = GameRoomMember.query.filter_by(
        room_id=room.id
    ).all()

    emit(
        "room:update",
        {
            "room": room.to_dict(),
            "members": _presence_members(room)
        }
    )
    messages = (
        ChatMessage.query
        .filter_by(room_id=room.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(100)
        .all()
    )

    # On remet les messages dans l'ordre chronologique
    messages.reverse()

    emit(
        "chat:history",
        {
            "messages": [
                message.to_dict()
                for message in messages
            ]
        }
    )

    game = games.get(room.id)

    if game:
        game_config = get_game_config(room.game_type)
        turn_timeout = int(game_config.get("turn_timeout", 20))
        state = game.public_state_for(user_id)
        state["viewer_role"] = member.role
        if member.role == "SPECTATOR":
            state["your_hand"] = []
            state["can_play"] = False
            state["can_pass"] = False
        state["turn_timer"] = get_turn_timeout_info(game, turn_timeout)
        state = add_usernames_to_game_state(room, state)
        state["presence"] = list(present_user_ids(room.id))
        emit("game:state", state)

@socketio.on("room:leave")
def handle_room_leave(data):
    _voice_remove_sid(request.sid)
    _leave_presence_sid(request.sid)
    room_code = str(
        (data or {}).get("room_code", "")
    ).upper()

    if room_code:
        leave_room(room_code)

def add_usernames_to_game_state(room, state):
    """
    Ajoute les pseudos aux joueurs de l'état President
    sans modifier le moteur du jeu.
    """

    members = GameRoomMember.query.filter_by(
        room_id=room.id
    ).all()

    usernames = {
        member.user_id: member.user.username
        for member in members
        if member.user
    }

    for player in state.get("players", []):
        user_id = player.get("user_id")

        player["username"] = usernames.get(
            user_id,
            f"Joueur #{user_id}"
        )

    for result in state.get("results", []):
        user_id = result.get("user_id")

        result["username"] = usernames.get(
            user_id,
            f"Joueur #{user_id}"
        )

    return state

def broadcast_game_state(room):

    game = games.get(room.id)

    if not game:
        return

    game_config = get_game_config(
        room.game_type
    )

    turn_timeout = int(
        game_config.get(
            "turn_timeout",
            15
        )
    )

    timer_info = get_turn_timeout_info(
        game,
        turn_timeout
    )

    members = GameRoomMember.query.filter_by(
        room_id=room.id
    ).all()

    for member in members:

        state = game.public_state_for(
            member.user_id
        )
        state["viewer_role"] = member.role
        if member.role == "SPECTATOR":
            state["your_hand"] = []
            state["can_play"] = False
            state["can_pass"] = False

        state["turn_timer"] = timer_info

        state = add_usernames_to_game_state(
            room,
            state
        )
        state["presence"] = list(present_user_ids(room.id))

        socketio.emit(
            "game:state",
            state,
            room=f"user:{member.user_id}"
        )

def broadcast_room_update(room):
    data = {"room": room.to_dict(), "members": _presence_members(room)}
    socketio.emit("room:update", data, room=room.code)

@socketio.on("chat:send")
def handle_chat_send(data):
    user_id = get_socket_user_id()

    if not user_id:
        emit("chat:error", {
            "error": "Utilisateur non authentifié"
        })
        return

    data = data or {}

    room_code = str(
        data.get("room_code", "")
    ).upper().strip()

    message = str(
        data.get("message", "")
    ).strip()

    if not room_code:
        emit("chat:error", {
            "error": "Salle invalide"
        })
        return

    if not message:
        emit("chat:error", {
            "error": "Le message est vide"
        })
        return

    if len(message) > 500:
        emit("chat:error", {
            "error": "Le message ne peut pas dépasser 500 caractères"
        })
        return

    room = GameRoom.query.filter_by(
        code=room_code
    ).first()

    if not room:
        emit("chat:error", {
            "error": "Salle introuvable"
        })
        return

    member = GameRoomMember.query.filter_by(
        room_id=room.id,
        user_id=user_id
    ).first()

    if not member:
        emit("chat:error", {
            "error": "Tu ne fais pas partie de cette salle"
        })
        return

    chat_message = ChatMessage(
        room_id=room.id,
        user_id=user_id,
        message=message
    )

    db.session.add(chat_message)
    db.session.flush()
    try:
        set_reply("room", chat_message, data.get("reply_to_id"), user_id)
    except ValueError as exc:
        db.session.rollback()
        emit("chat:error", {"error": str(exc)})
        return
    db.session.commit()

    socketio.emit(
        "chat:message",
        enrich("room", chat_message),
        room=room.code
    )


# --- Salon vocal WebRTC : signalisation uniquement (aucun audio sur le serveur). ---
# Associe chaque socket participant à une salle autorisée.
voice_participants = {}  # sid -> (room_code, user_id)
voice_lock = Lock()


def _voice_authorized_room(code, user_id):
    code = str(code or "").strip().upper()
    if not code or not user_id:
        return None
    room = GameRoom.query.filter_by(code=code).first()
    if not room:
        return None
    member = GameRoomMember.query.filter_by(room_id=room.id, user_id=int(user_id)).first()
    return room if member else None


def _voice_remove_sid(sid):
    with voice_lock:
        entry = voice_participants.pop(sid, None)
    if entry:
        code, user_id = entry
        socketio.emit("voice:peer-left", {"sid": sid, "user_id": user_id}, room=f"voice:{code}", skip_sid=sid)
        leave_room(f"voice:{code}", sid=sid)


@socketio.on("voice:join")
def voice_join(data):
    user_id = get_socket_user_id()
    room = _voice_authorized_room((data or {}).get("room_code"), user_id)
    if not room:
        emit("voice:error", {"error": "Accès vocal refusé : salle ou membre invalide"})
        return
    _voice_remove_sid(request.sid)
    with voice_lock:
        peers = [{"sid": sid, "user_id": uid} for sid, (code, uid) in voice_participants.items()
                 if code == room.code and uid != user_id]
        voice_participants[request.sid] = (room.code, int(user_id))
    join_room(f"voice:{room.code}")
    emit("voice:peers", {"peers": peers})
    emit("voice:peer-joined", {"sid": request.sid, "user_id": int(user_id)},
         room=f"voice:{room.code}", include_self=False)


@socketio.on("voice:signal")
def voice_signal(data):
    user_id = get_socket_user_id()
    data = data or {}
    target_sid = data.get("to")
    signal = data.get("signal")
    if not isinstance(target_sid, str) or not isinstance(signal, dict):
        return
    if signal.get("type") not in ("offer", "answer", "candidate"):
        return
    with voice_lock:
        sender = voice_participants.get(request.sid)
        target = voice_participants.get(target_sid)
    if not sender or not target or sender[0] != target[0] or sender[1] != user_id:
        return
    if not _voice_authorized_room(sender[0], user_id):
        return
    socketio.emit("voice:signal", {"from": request.sid, "user_id": int(user_id), "signal": signal}, room=target_sid)


@socketio.on("voice:leave")
def voice_leave(data=None):
    _voice_remove_sid(request.sid)