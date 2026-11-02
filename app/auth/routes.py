import bcrypt

from flask import Blueprint, request

from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)

from sqlalchemy import or_

from ..extensions import db
from ..models import User


auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)


@auth_bp.post("/register")
def register():

    data = request.get_json()

    if not data:
        return {
            "error": "JSON body required"
        }, 400

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username:
        return {
            "error": "username is required"
        }, 400

    if not email:
        return {
            "error": "email is required"
        }, 400

    if not password:
        return {
            "error": "password is required"
        }, 400

    if len(password) < 6:
        return {
            "error": "password must contain at least 6 characters"
        }, 400

    existing_user = User.query.filter(
        or_(
            User.username == username,
            User.email == email
        )
    ).first()

    if existing_user:

        return {
            "error": "username or email already exists"
        }, 409

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    user = User(
        username=username,
        email=email,
        password_hash=password_hash
    )

    db.session.add(user)
    db.session.commit()

    return {
        "message": "User created successfully",
        "user": user.to_dict()
    }, 201


@auth_bp.post("/login")
def login():

    data = request.get_json()

    if not data:

        return {
            "error": "JSON body required"
        }, 400

    username = data.get("username")
    password = data.get("password")

    if not username or not password:

        return {
            "error": "username and password are required"
        }, 400

    user = User.query.filter(
        User.username == username
    ).first()

    if not user:

        return {
            "error": "invalid username or password"
        }, 401

    password_valid = bcrypt.checkpw(
        password.encode("utf-8"),
        user.password_hash.encode("utf-8")
    )

    if not password_valid:

        return {
            "error": "invalid username or password"
        }, 401

    access_token = create_access_token(
        identity=str(user.id)
    )
    refresh_token = create_refresh_token(identity=str(user.id))

    return {
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict()
    }


@auth_bp.post("/logout")
@jwt_required()
def logout():

    # Dans cette première version,
    # le client supprime simplement son token.

    return {
        "message": "Logout successful"
    }

@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh_access_token():
    user_id = get_jwt_identity()
    if not db.session.get(User, int(user_id)):
        return {"error": "Compte introuvable"}, 401
    return {"access_token": create_access_token(identity=str(user_id))}


@auth_bp.post("/avatar")
@jwt_required()
def upload_avatar():
    """Upload d'avatar, réponse JSON y compris en cas d'erreur."""
    from pathlib import Path
    from uuid import uuid4
    from flask import current_app

    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return {"error": "Utilisateur introuvable"}, 404
    uploaded = request.files.get("avatar")
    if uploaded is None or not uploaded.filename:
        return {"error": "Sélectionne une image"}, 400

    # Vérifier taille et signature réelle du fichier, pas uniquement son extension.
    raw = uploaded.read(5 * 1024 * 1024 + 1)
    if not raw or len(raw) > 5 * 1024 * 1024:
        return {"error": "Image vide ou supérieure à 5 Mo"}, 400
    if raw.startswith(b"\xff\xd8\xff"):
        ext = "jpg"
    elif raw.startswith(b"\x89PNG\r\n\x1a\n"):
        ext = "png"
    elif raw.startswith(b"RIFF") and raw[8:12] == b"WEBP":
        ext = "webp"
    else:
        return {"error": "Format invalide : JPG, PNG ou WEBP uniquement"}, 400

    static_folder = current_app.static_folder
    if not static_folder:
        return {"error": "Dossier static introuvable"}, 500
    directory = Path(static_folder) / "uploads" / "avatars"
    filename = f"{uuid4().hex}.{ext}"
    path = directory / filename
    try:
        directory.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
        user.avatar_url = f"/static/uploads/avatars/{filename}"
        db.session.commit()
    except Exception:
        db.session.rollback()
        path.unlink(missing_ok=True)
        current_app.logger.exception("Échec de l'enregistrement de l'avatar")
        return {"error": "Impossible d'enregistrer la photo"}, 500
    return {"message": "Photo mise à jour", "user": user.to_dict()}, 200