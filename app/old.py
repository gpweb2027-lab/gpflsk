from flask import Flask

from config import Config

from .extensions import (
    db,
    migrate,
    jwt,
    socketio
)


def create_app():

    app = Flask(__name__)

    app.config.from_object(Config)

    # Extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    socketio.init_app(app)

    # Blueprints
    from .auth.routes import auth_bp
    from .users.routes import users_bp
    from .rooms.routes import rooms_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(rooms_bp)

    @app.get("/")
    def home():

        return {
            "application": "Game Platform",
            "status": "running",
            "version": "1.0.0"
        }

    @app.get("/health")
    def health():

        return {
            "status": "ok"
        }

    return app