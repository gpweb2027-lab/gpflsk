from datetime import datetime


def get_turn_timeout_info(game, timeout_seconds):
    """
    Retourne les informations du timer
    du tour courant.
    """

    if not game:
        return None

    if not game.started:
        return None

    if game.finished:
        return None

    if not game.turn_started_at:
        return None

    elapsed = (
        datetime.utcnow() - game.turn_started_at
    ).total_seconds()

    remaining = max(
        0,
        timeout_seconds - elapsed
    )

    return {
        "timeout_seconds": timeout_seconds,
        "remaining_seconds": remaining,
        "expired": remaining <= 0,
    }


def is_turn_expired(game, timeout_seconds):
    info = get_turn_timeout_info(
        game,
        timeout_seconds
    )

    return bool(
        info
        and info["expired"]
    )