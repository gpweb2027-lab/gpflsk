import random
from collections import Counter
from datetime import datetime

RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"]
SUITS = ["C", "D", "H", "S"]

RANK_VALUE = {rank: index for index, rank in enumerate(RANKS)}

class PresidentGame:
    """Moteur MVP du President.

    Règles de cette première version :
    - 2 à 10 joueurs.
    - Jeu standard de 52 cartes.
    - 3 est la plus petite valeur, 2 la plus haute.
    - Une combinaison doit contenir 1, 2, 3 ou 4 cartes de même rang.
    - Pour jouer sur le pli courant, le nombre de cartes doit être identique
      et le rang doit être supérieur au précédent.
    - Un joueur peut passer.
    - Quand tous les autres joueurs ont passé, le dernier joueur ayant joué
      relance avec n'importe quelle combinaison.
    - Le premier joueur qui n'a plus de cartes termine premier.
    """
    def __init__(self, room_id):
        self.room_id = room_id
        self.players = []
        self.hands = {}
        self.current_player_index = 0
        self.current_play = []
        self.current_play_rank = None
        self.current_play_count = 0
        self.last_player_index = None
        self.consecutive_passes = 0
        self.started = False
        self.finished = False
        self.results = []
        self.play_history = []  # Derniers coups joués (sans les passes)
        self.turn_started_at = None

    def _start_turn_timer(self):
        self.turn_started_at = datetime.utcnow()

    def add_player(self, user_id):
        if self.started:
            raise ValueError("Game already started")
        if user_id not in self.players:
            if len(self.players) >= 10:
                raise ValueError("Maximum 10 players")
            self.players.append(user_id)

    def start(self):
        if self.started:
            raise ValueError("Game already started")
        if len(self.players) < 2:
            raise ValueError("At least 2 players are required")

        deck = [
            {"rank": rank, "suit": suit, "id": f"{rank}_{suit}"}
            for suit in SUITS
            for rank in RANKS
        ]
        random.shuffle(deck)

        self.hands = {user_id: [] for user_id in self.players}
        for index, card in enumerate(deck):
            self.hands[self.players[index % len(self.players)]].append(card)

        for hand in self.hands.values():
            hand.sort(key=lambda c: (RANK_VALUE[c["rank"]], SUITS.index(c["suit"])))

        self.started = True
        self.finished = False
        # Le premier joueur est tiré au sort à chaque nouvelle partie.
        self.current_player_index = random.randrange(len(self.players))
        self.current_play = []
        self.current_play_rank = None
        self.current_play_count = 0
        self.play_history = []
        self.last_player_index = None
        self.consecutive_passes = 0
        self._start_turn_timer()

    def current_player(self):
        if not self.players:
            return None
        return self.players[self.current_player_index]

    def _advance(self):
        if not self.players:
            return
        for _ in range(len(self.players)):
            self.current_player_index = (
                (self.current_player_index + 1) % len(self.players)
            )
            user_id = self.players[self.current_player_index]
            if user_id in self.hands and self.hands[user_id]:
                self._start_turn_timer()
                return

    def _active_player_count(self):
        return sum(1 for user_id in self.players if self.hands.get(user_id))

    def _validate_cards_in_hand(self, user_id, card_ids):
        if user_id not in self.hands:
            raise ValueError("Player is not in this game")
        if not card_ids:
            raise ValueError("Choose at least one card")

        if len(card_ids) > 4:
            raise ValueError("Maximum 4 cards")

        hand = self.hands[user_id]
        selected = [card for card in hand if card["id"] in card_ids]

        if len(selected) != len(card_ids):
            raise ValueError("You do not have these cards")

        if len({card["rank"] for card in selected}) != 1:
            raise ValueError("All played cards must have the same rank")

        if len(set(card_ids)) != len(card_ids):
            raise ValueError("Duplicate cards")

        return selected

    def play(self, user_id, card_ids):
        if not self.started:
            raise ValueError("Game has not started")
        if self.finished:
            raise ValueError("Game is finished")
        if self.current_player() != user_id:
            raise ValueError("It is not your turn")

        selected = self._validate_cards_in_hand(user_id, card_ids)
        rank = selected[0]["rank"]

        if self.current_play:
            if len(selected) != self.current_play_count:
                raise ValueError(
                    f"You must play {self.current_play_count} card(s)"
                )
            if RANK_VALUE[rank] <= RANK_VALUE[self.current_play_rank]:
                raise ValueError("Your cards must be higher than the current play")

        self.hands[user_id] = [
            card for card in self.hands[user_id]
            if card["id"] not in card_ids
        ]

        self.play_history.append({
            "user_id": user_id,
            "cards": [dict(card) for card in selected],
            "played_at": datetime.utcnow().isoformat() + "Z",
        })
        self.play_history = self.play_history[-3:]

        self.current_play = selected
        self.current_play_rank = rank
        self.current_play_count = len(selected)
        self.last_player_index = self.current_player_index
        self.consecutive_passes = 0

        if not self.hands[user_id]:
            self.results.append(user_id)
            if self._active_player_count() <= 1:
                self.finished = True
                remaining = [
                    uid for uid in self.players
                    if uid not in self.results
                ]
                self.results.extend(remaining)
                return

        self._advance()

    def _record_pass(self, user_id, automatic=False):
        self.play_history.append({
            "user_id": user_id,
            "cards": [],
            "action": "pass",
            "automatic": automatic,
            "played_at": datetime.utcnow().isoformat() + "Z",
        })
        self.play_history = self.play_history[-3:]

    def pass_turn(self, user_id, automatic=False):
        if not self.started:
            raise ValueError("Game has not started")
        if self.finished:
            raise ValueError("Game is finished")
        if self.current_player() != user_id:
            raise ValueError("It is not your turn")
        if not self.current_play:
            raise ValueError("You cannot pass when starting a new trick")

        self._record_pass(user_id, automatic=automatic)

        self.consecutive_passes += 1

        active_players = self._active_player_count()
        if self.consecutive_passes >= max(active_players - 1, 1):
            # The last player who played gets the lead again.
            self.current_player_index = self.last_player_index
            self.current_play = []
            self.current_play_rank = None
            self.current_play_count = 0
            self.consecutive_passes = 0
            self._start_turn_timer()
            return

        self._advance()

    def can_player_play(self, user_id):
        """Vérifie si au moins une combinaison légale existe."""
        hand = self.hands.get(user_id, [])
        if not hand or not self.started or self.finished:
            return False
        if not self.current_play:
            return True
        ranks = Counter(card["rank"] for card in hand)
        return any(
            count >= self.current_play_count
            and RANK_VALUE[rank] > RANK_VALUE[self.current_play_rank]
            for rank, count in ranks.items()
        )

    def handle_turn_timeout(self):
        """
        Action automatique lorsqu'un joueur
        dépasse son temps de jeu.
        """

        if not self.started:
            return

        if self.finished:
            return

        user_id = self.current_player()

        if user_id is None:
            return

        # Un pli existe :
        # le joueur passe automatiquement.
        if self.current_play:
            self.pass_turn(user_id, automatic=True)
            return

        # Nouveau pli :
        # impossible de passer selon les règles
        # actuelles de President.
        #
        # On joue donc automatiquement
        # la plus petite carte du joueur.

        hand = self.hands.get(
            user_id,
            []
        )

        if not hand:
            self._advance()
            return

        lowest_card = hand[0]

        self.play(
            user_id,
            [lowest_card["id"]]
        )

    def get_player_username(self, user_id):
        from app.models import User

        user = User.query.get(user_id)

        if user is None:
            return f"Joueur #{user_id}"

        return user.username

    def public_state_for(self, user_id):
        hand = self.hands.get(user_id, [])
        players = []

        from app.models import User

        users = {
            user.id: user
            for user in User.query.filter(
                User.id.in_(self.players)
            ).all()
        }

        for uid in self.players:
            player_user = users.get(uid)

            players.append({
                "user_id": uid,
                "username": (
                    player_user.username
                    if player_user
                    else f"Joueur #{uid}"
                ),
                "avatar_url": (
                    player_user.avatar_url
                    if player_user
                    else None
                ),
                "cards_count": len(self.hands.get(uid, [])),
                "position": (
                    self.results.index(uid) + 1
                    if uid in self.results else None
                ),
            })

        return {
            "room_id": self.room_id,
            "started": self.started,
            "finished": self.finished,
            "current_player": self.current_player(),
            "turn_started_at": (
                self.turn_started_at.isoformat() + "Z"
                if self.turn_started_at
                else None
            ),
            "current_play": self.current_play,
            "last_plays": [
                {
                    **play,
                    "username": users[play["user_id"]].username
                    if play["user_id"] in users
                    else f"Joueur #{play['user_id']}",
                }
                for play in self.play_history
            ],
            "can_play": self.current_player() == user_id and self.can_player_play(user_id),
            "can_pass": self.current_player() == user_id and bool(self.current_play) and not self.finished,
            "current_play_count": self.current_play_count,
            "current_play_rank": self.current_play_rank,
            "consecutive_passes": self.consecutive_passes,
            "players": players,
            "your_hand": hand,
            "your_result": (
                self.results.index(user_id) + 1
                if user_id in self.results else None
            ),
            "results": [
                {"user_id": uid, "position": index + 1}
                for index, uid in enumerate(self.results)
            ],
        }



