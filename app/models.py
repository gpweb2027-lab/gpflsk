from datetime import datetime
from .extensions import db
from datetime import datetime, timezone


class User(db.Model):

    __tablename__ = "users"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    username = db.Column(
        db.String(50),
        unique=True,
        nullable=False,
        index=True
    )

    email = db.Column(
        db.String(150),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = db.Column(
        db.String(255),
        nullable=False
    )

    is_active = db.Column(
        db.Boolean,
        default=True,
        nullable=False
    )

    avatar_url = db.Column(
        db.String(500),
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    # Profil public et préférences linguistiques.
    # Colonnes nullable pour rester compatibles avec les comptes existants.
    pseudo = db.Column(db.String(50), nullable=True)
    preferred_language = db.Column(db.String(5), nullable=True)
    native_language = db.Column(db.String(5), nullable=True)
    learning_language = db.Column(db.String(5), nullable=True)

    banner_url = db.Column(db.String(500), nullable=True)
    bio = db.Column(db.String(300), nullable=True)
    country_code = db.Column(db.String(2), nullable=True)
    timezone = db.Column(db.String(64), nullable=True)
    show_location = db.Column(db.Boolean, nullable=False, default=False)
    show_stats = db.Column(db.Boolean, nullable=False, default=True)
    show_coins = db.Column(db.Boolean, nullable=False, default=False)
    coins = db.Column(db.Integer,nullable=False,default=1000,server_default=db.text("1000"))

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "pseudo": self.pseudo or self.username,
            "preferred_language": self.preferred_language,
            "native_language": self.native_language,
            "learning_language": self.learning_language,
            "email": self.email,
            "avatar_url": self.avatar_url,
            "is_active": self.is_active,

            "created_at": (
                self.created_at.isoformat()
                if self.created_at
                else None
            )
        }

class GameRoom(db.Model):

    __tablename__ = "game_rooms"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    code = db.Column(
        db.String(20),
        unique=True,
        nullable=False,
        index=True
    )

    game_type = db.Column(
        db.String(30),
        nullable=False
    )

    owner_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    status = db.Column(
        db.String(20),
        default="WAITING",
        nullable=False
    )

    room_mode = db.Column(
        db.String(20),
        default="NORMAL",
        nullable=False
    )

    visibility = db.Column(
        db.String(20),
        default="PUBLIC",
        nullable=False
    )

    max_players = db.Column(
        db.Integer,
        default=10,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    started_at = db.Column(db.DateTime, nullable=True)
    finished_at = db.Column(db.DateTime, nullable=True)
    last_activity_at = db.Column(db.DateTime, nullable=True)

    owner = db.relationship(
        "User",
        foreign_keys=[owner_id]
    )

    members = db.relationship(
        "GameRoomMember",
        backref="room",
        lazy=True,
        cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "game_type": self.game_type,
            "owner_id": self.owner_id,
            "status": self.status,
            "started_at": self.started_at.isoformat() + "Z" if self.started_at else None,
            "finished_at": self.finished_at.isoformat() + "Z" if self.finished_at else None,
            "last_activity_at": self.last_activity_at.isoformat() + "Z" if self.last_activity_at else None,

            "room_mode": self.room_mode,
            "visibility": self.visibility,

            "max_players": self.max_players,

            "created_at": (
                self.created_at.isoformat()
                if self.created_at
                else None
            )
        }

class GameRoomMember(db.Model):

    __tablename__ = "game_room_members"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    room_id = db.Column(
        db.Integer,
        db.ForeignKey("game_rooms.id"),
        nullable=False
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    role = db.Column(
        db.String(20),
        default="PLAYER",
        nullable=False
    )

    joined_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    user = db.relationship(
        "User"
    )

    __table_args__ = (
        db.UniqueConstraint(
            "room_id",
            "user_id",
            name="unique_room_user"
        ),
    )

    def to_dict(self):

        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.user.username,
            "pseudo": self.user.pseudo or self.user.username,
            "avatar_url": self.user.avatar_url,
            "role": self.role,
            "joined_at": (
                self.joined_at.isoformat()
                if self.joined_at
                else None
            )
        }

class ChatMessage(db.Model):
    __tablename__ = "chat_messages"

    id = db.Column(db.Integer, primary_key=True)

    room_id = db.Column(
        db.Integer,
        db.ForeignKey("game_rooms.id"),
        nullable=False,
        index=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    message = db.Column(
        db.String(500),
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    room = db.relationship(
        "GameRoom",
        backref=db.backref(
            "chat_messages",
            lazy=True,
            cascade="all, delete-orphan"
        )
    )

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "room_id": self.room_id,
            "user_id": self.user_id,
            "username": self.user.username,
            "pseudo": self.user.pseudo or self.user.username,
            "avatar_url": self.user.avatar_url,
            "message": self.message,
            "created_at": (
                self.created_at.isoformat() + "Z"
                if self.created_at
                else None
            )
        }
class FriendRequest(db.Model):
    __tablename__ = "friend_requests"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    sender_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    receiver_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="PENDING"
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    sender = db.relationship(
        "User",
        foreign_keys=[sender_id]
    )

    receiver = db.relationship(
        "User",
        foreign_keys=[receiver_id]
    )

    __table_args__ = (
        db.UniqueConstraint(
            "sender_id",
            "receiver_id",
            name="unique_friend_request_pair"
        ),
        db.CheckConstraint(
            "sender_id <> receiver_id",
            name="no_self_friend_request"
        ),
        db.CheckConstraint(
            "status IN ('PENDING', 'ACCEPTED', 'REJECTED')",
            name="valid_friend_request_status"
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "receiver_id": self.receiver_id,
            "status": self.status,
            "created_at": (
                self.created_at.isoformat() + "Z"
                if self.created_at
                else None
            )
        }

class PrivateMessage(db.Model):
    __tablename__ = "private_messages"

    id = db.Column(db.Integer, primary_key=True)

    sender_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    receiver_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    content = db.Column(db.Text, nullable=False)

    is_read = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        server_default=db.text("false")
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    sender = db.relationship("User", foreign_keys=[sender_id])
    receiver = db.relationship("User", foreign_keys=[receiver_id])

    __table_args__ = (
        db.CheckConstraint(
            "sender_id <> receiver_id",
            name="no_self_private_message"
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "receiver_id": self.receiver_id,
            "content": self.content,
            "is_read": self.is_read,
            "created_at": (
                self.created_at.isoformat() + "Z"
                if self.created_at else None
            )
        }

class PresidentResult(db.Model):
    __tablename__ = "president_results"
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey("game_rooms.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    position = db.Column(db.Integer, nullable=False)
    players_count = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("room_id", "user_id", name="uq_president_result_room_user"),)

# Groupes d'amis : distincts des salons de jeu.
class FriendGroup(db.Model):
    __tablename__ = "friend_groups"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    avatar_item_id = db.Column(db.Integer, nullable=True)
    description = db.Column(db.String(300), nullable=True)
    owner = db.relationship("User")

class FriendGroupMember(db.Model):
    __tablename__ = "friend_group_members"
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("friend_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    user = db.relationship("User")
    __table_args__ = (db.UniqueConstraint("group_id", "user_id", name="uq_friend_group_member"),)

class FriendGroupMessage(db.Model):
    __tablename__ = "friend_group_messages"
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey("friend_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    sender = db.relationship("User")
    def to_dict(self):
        return {"id": self.id, "group_id": self.group_id, "sender_id": self.sender_id,
                "username": self.sender.username, "pseudo": self.sender.pseudo or self.sender.username,"avatar_url": self.sender.avatar_url,
                "content": self.content, "created_at": self.created_at.isoformat() + "Z"}

class ChatExtra(db.Model):
    __tablename__ = "chat_extras"
    id = db.Column(db.Integer, primary_key=True)
    kind = db.Column(db.String(12), nullable=False)
    message_id = db.Column(db.Integer, nullable=False)
    reply_to_id = db.Column(db.Integer, nullable=True)
    deleted = db.Column(db.Boolean, nullable=False, default=False)
    __table_args__ = (db.UniqueConstraint("kind", "message_id", name="uq_chat_extra_message"),)

class ChatReaction(db.Model):
    __tablename__ = "chat_reactions"
    id = db.Column(db.Integer, primary_key=True)
    kind = db.Column(db.String(12), nullable=False)
    message_id = db.Column(db.Integer, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    emoji = db.Column(db.String(16), nullable=False)
    __table_args__ = (db.UniqueConstraint("kind", "message_id", "user_id", "emoji", name="uq_chat_reaction"),)

# Boutique : tables deja creees par catalogue_gpflsk_local.sql
class ShopCollection(db.Model):
    __tablename__ = "shop_collections"
    id = db.Column(db.BigInteger, primary_key=True)
    code = db.Column(db.String(60), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    kind = db.Column(db.String(12), nullable=False)
    description = db.Column(db.Text)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True))

class ShopItem(db.Model):
    __tablename__ = "shop_items"
    id = db.Column(db.BigInteger, primary_key=True)
    collection_id = db.Column(db.BigInteger, db.ForeignKey("shop_collections.id"))
    code = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    kind = db.Column(db.String(12), nullable=False)
    image_url = db.Column(db.String(500), nullable=False)
    price_coins = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True))
    collection = db.relationship("ShopCollection")

class UserShopItem(db.Model):
    __tablename__ = "user_shop_items"
    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    item_id = db.Column(db.BigInteger, db.ForeignKey("shop_items.id"), nullable=False)
    acquired_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )
    acquisition_type = db.Column(db.String(16), nullable=False, default="purchase")
    __table_args__ = (db.UniqueConstraint("user_id", "item_id"),)

class ShopTransaction(db.Model):
    __tablename__ = "shop_transactions"
    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    item_id = db.Column(db.BigInteger, db.ForeignKey("shop_items.id"), nullable=False)
    price_coins = db.Column(db.Integer, nullable=False)
    balance_before = db.Column(db.Integer, nullable=False)
    balance_after = db.Column(db.Integer, nullable=False)
    transaction_type = db.Column(db.String(16), nullable=False, default="purchase")
    recipient_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime(timezone=True),nullable=False,default=lambda: datetime.now(timezone.utc))

