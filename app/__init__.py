from flask import Flask, render_template
from config import Config
from .extensions import db, migrate, jwt, socketio
from .games.config import (GAME_CONFIG,get_game_by_slug,get_game_config)


def create_app():

    app = Flask(__name__)

    app.config.from_object(Config)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    socketio.init_app(
        app,
        cors_allowed_origins="*"
    )

    from .auth.routes import auth_bp
    from .users.routes import users_bp
    from .groups.routes import groups_bp
    from .groups.group_avatars_routes import group_avatars_bp
    from .rooms.routes import rooms_bp
    from .games.president.routes import president_bp

    # Important :
    # cela enregistre les événements Socket.IO.
    from .games.president import socket_events

    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(groups_bp)
    app.register_blueprint(group_avatars_bp)
    app.register_blueprint(rooms_bp)
    app.register_blueprint(president_bp)

    @app.get("/")
    def home():
        return render_template("entry.html")

    @app.get("/login")
    def login_page():
        return render_template("login.html")

    @app.get("/register")
    def register_page():
        return render_template("register.html")

    @app.get("/lobby")
    def lobby_page():
        games = []

        for game_type, game_config in GAME_CONFIG.items():
            games.append({
                "type": game_type,
                **game_config
            })

        languages = [
            {
                "name": "Anglais",
                "flag": "🇬🇧"
            },
            {
                "name": "Allemand",
                "flag": "🇩🇪"
            },
            {
                "name": "Français",
                "flag": "🇫🇷"
            },
            {
                "name": "Espagnol",
                "flag": "🇪🇸"
            }
        ]

        friends = [
            {
                "name": "Thomas",
                "avatar": "👨🏽",
                "status": "En ligne"
            },
            {
                "name": "Lucas",
                "avatar": "👨🏻",
                "status": "En partie"
            },
            {
                "name": "Sarah",
                "avatar": "👩🏼",
                "status": "En ligne"
            },
            {
                "name": "Emma",
                "avatar": "👩🏻",
                "status": "En ligne"
            }
        ]

        rooms = [
            {
                "name": "President chill",
                "players": "3 / 8 joueurs"
            },
            {
                "name": "Soirée UNO",
                "players": "4 / 6 joueurs"
            },
            {
                "name": "English only",
                "players": "5 / 8 joueurs"
            }
        ]
        return render_template("dashboard.html",
        games=games,
        languages = languages,
        friends = friends,
        rooms = rooms
        )

    @app.get("/room/<string:code>")
    def room_page(code):

        from .models import GameRoom

        room = GameRoom.query.filter_by(
            code=code.upper()
        ).first()

        if not room:
            return render_template(
                "404.html"
            ), 404

        game_config = get_game_config(
            room.game_type
        )

        if not game_config:
            return render_template(
                "404.html"
            ), 404

        return render_template(
            "room.html",
            code=room.code,
            game_type=room.game_type,
            game=game_config
        )

    @app.get("/health")
    def health():
        return {"status": "ok"}


    @app.get("/games")
    def games_page():

        games = []

        for game_type, config in GAME_CONFIG.items():

            games.append({
                "type": game_type,
                **config,
            })

        return render_template(
            "games.html",
            games=games
        )


    @app.get("/games/<string:slug>")
    def game_lobby_page(slug):

        game_type, game = get_game_by_slug(slug)

        if not game_type or not game:
            return render_template(
                "404.html"
            ), 404

        if not game["enabled"]:
            return render_template(
                "game_unavailable.html",
                game=game
            ), 404

        return render_template(
            "game_lobby.html",
            game_type=game_type,
            game=game
        )

    # =========================
    # DEV - SIMULATEUR PRESIDENT
    # =========================

    @app.get("/dev/president")
    def president_preview():
        return render_template(
            "dev/president_preview.html"
        )

    return app