from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
def index():
    games = [
        {
            "name": "President",
            "description": "Jeu de cartes multijoueur",
            "players": "2 - 8 joueurs",
            "emoji": "👑",
            "available": True,
        },
        {
            "name": "UNO",
            "description": "Jeu de cartes multijoueur",
            "players": "2 - 10 joueurs",
            "emoji": "🃏",
            "available": True,
        },
        {
            "name": "Échecs",
            "description": "Jeu de stratégie",
            "players": "2 joueurs",
            "emoji": "♟️",
            "available": False,
        },
        {
            "name": "Poker",
            "description": "Jeu de cartes multijoueur",
            "players": "2 - 8 joueurs",
            "emoji": "♠️",
            "available": False,
        },
    ]

    languages = [
        {"name": "Anglais", "flag": "🇬🇧", "code": "en"},
        {"name": "Allemand", "flag": "🇩🇪", "code": "de"},
        {"name": "Français", "flag": "🇫🇷", "code": "fr"},
        {"name": "Espagnol", "flag": "🇪🇸", "code": "es"},
    ]

    friends = [
        {"name": "Thomas", "avatar": "🧑🏽", "status": "En ligne"},
        {"name": "Lucas", "avatar": "👨🏻", "status": "En ligne"},
        {"name": "Sarah", "avatar": "👩🏼", "status": "En ligne"},
        {"name": "Emma", "avatar": "👩🏻", "status": "En partie (UNO)"},
        {"name": "Nathan", "avatar": "👨🏾", "status": "En ligne"},
    ]

    rooms = [
        {"name": "Partie rapide UNO", "players": "3 / 6 joueurs"},
        {"name": "President chill", "players": "5 / 8 joueurs"},
        {"name": "Débutants Échecs", "players": "2 / 2 joueurs"},
        {"name": "Poker entre amis", "players": "4 / 8 joueurs"},
    ]

    return render_template(
        "index.html",
        games=games,
        languages=languages,
        friends=friends,
        rooms=rooms,
    )


if __name__ == "__main__":
    app.run(debug=True)