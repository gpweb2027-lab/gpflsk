GAME_CONFIG = {

    "PRESIDENT": {
        "slug": "president",
        "name": "President",
        "emoji": "👑",
        "description":
            "Débarrasse-toi de tes cartes avant les autres.",

        "enabled": True,

        "min_players": 2,
        "max_players": 8,

        # Utilisés plus tard par le gestionnaire global
        "room_timeout": 3000,
        "turn_timeout": 20,
    },

    "UNO": {
        "slug": "uno",
        "name": "UNO",
        "emoji": "🃏",
        "description":
            "Le célèbre jeu de cartes rapide et amusant.",

        "enabled": False,

        "min_players": 2,
        "max_players": 10,

        "room_timeout": 300,
        "turn_timeout": 20,
    },

    "CHESS": {
        "slug": "chess",
        "name": "Échecs",
        "emoji": "♟️",
        "description":
            "Affronte un joueur dans un duel stratégique.",

        "enabled": False,

        "min_players": 2,
        "max_players": 2,

        "room_timeout": 300,
        "turn_timeout": 60,
    },

    "POKER": {
        "slug": "poker",
        "name": "Poker",
        "emoji": "♠️",
        "description":
            "Bluffe et affronte tes amis autour de la table.",

        "enabled": False,

        "min_players": 2,
        "max_players": 8,

        "room_timeout": 30,
        "turn_timeout": 10,
    },
}


def get_game_config(game_type):
    return GAME_CONFIG.get(
        str(game_type).upper()
    )


def get_game_by_slug(slug):
    slug = str(slug).lower()

    for game_type, config in GAME_CONFIG.items():

        if config["slug"] == slug:
            return game_type, config

    return None, None