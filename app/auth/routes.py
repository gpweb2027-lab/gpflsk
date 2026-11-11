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
    pseudo = (data.get("pseudo") or "").strip()
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
        pseudo=pseudo[:50] or username,
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
    pseudo = (data.get("pseudo") or "").strip()
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



# Gestion locale des images de profil. Pillow : pip install Pillow
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from flask import current_app
from PIL import Image, ImageOps, ImageSequence, UnidentifiedImageError

MAX_SOURCE_BYTES = 20 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 25_000_000


def _prepare_media(uploaded, kind):
    raw = uploaded.read(MAX_SOURCE_BYTES + 1)
    if not raw or len(raw) > MAX_SOURCE_BYTES:
        raise ValueError("Fichier vide ou supérieur à 20 Mo")
    try:
        image = Image.open(BytesIO(raw))
        if image.format not in ("JPEG", "PNG", "WEBP", "GIF"):
            raise ValueError("Format accepté : JPG, PNG, WebP ou GIF")
        if image.width * image.height > 25_000_000:
            raise ValueError("Dimensions trop importantes")
        animated = getattr(image, "is_animated", False) and getattr(image, "n_frames", 1) > 1
        if animated:
            if image.n_frames > 120:
                raise ValueError("GIF trop long : 120 images maximum")
            limit = (256, 256) if kind == "avatar" else (800, 300)
            frames, durations = [], []
            total_ms = 0
            for frame in ImageSequence.Iterator(image):
                duration = max(40, min(1000, int(frame.info.get("duration", 100) or 100)))
                total_ms += duration
                if total_ms > 15000:
                    raise ValueError("Animation limitée à 15 secondes")
                rgb = frame.convert("RGBA")
                rgb.thumbnail(limit, Image.Resampling.LANCZOS)
                frames.append(rgb)
                durations.append(duration)
            out = BytesIO()
            frames[0].save(out, format="WEBP", save_all=True, append_images=frames[1:],
                           duration=durations, loop=0, quality=65, method=4)
            if out.tell() > 4 * 1024 * 1024:
                raise ValueError("Animation encore trop lourde après compression (4 Mo maximum)")
            return out.getvalue(), "webp"
        image = ImageOps.exif_transpose(image)
        limit = (512, 512) if kind == "avatar" else (1600, 600)
        image.thumbnail(limit, Image.Resampling.LANCZOS)
        image = image.convert("RGBA") if "A" in image.getbands() else image.convert("RGB")
        out = BytesIO()
        image.save(out, format="WEBP", quality=80, method=6)
        return out.getvalue(), "webp"
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise ValueError(str(exc) or "Image invalide") from exc

def _store_profile_upload(kind):
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return {"error": "Utilisateur introuvable"}, 404
    uploaded = request.files.get(kind)
    if uploaded is None or not uploaded.filename:
        return {"error": "Sélectionne une image"}, 400
    try:
        content, extension = _prepare_media(uploaded, kind)
    except ValueError as exc:
        return {"error": str(exc)}, 400
    root = Path(current_app.static_folder)
    folder = root / "uploads" / ("avatars" if kind == "avatar" else "banners")
    path = folder / f"{uuid4().hex}.{extension}"
    old_url = getattr(user, f"{kind}_url")
    try:
        folder.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        url = f"/static/uploads/{'avatars' if kind == 'avatar' else 'banners'}/{path.name}"
        setattr(user, f"{kind}_url", url)
        db.session.commit()
    except Exception:
        db.session.rollback()
        path.unlink(missing_ok=True)
        current_app.logger.exception("Erreur enregistrement image profil")
        return {"error": "Enregistrement impossible"}, 500
    # Ne supprimer que nos propres anciens fichiers, jamais ceux du catalogue.
    allowed_prefix = f"/static/uploads/{'avatars' if kind == 'avatar' else 'banners'}/"
    if old_url and old_url.startswith(allowed_prefix):
        old_name = old_url[len(allowed_prefix):]
        if old_name and Path(old_name).name == old_name:
            (folder / old_name).unlink(missing_ok=True)
    return {"message": "Image mise à jour", f"{kind}_url": url, "user": user.to_dict()}, 200


@auth_bp.post("/avatar")
@jwt_required()
def upload_avatar():
    return _store_profile_upload("avatar")


@auth_bp.post("/banner")
@jwt_required()
def upload_banner():
    return _store_profile_upload("banner")