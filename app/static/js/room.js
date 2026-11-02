function openPlayerProfile(player) {
     if (player && player.user_id && window.openFullPlayerProfile) { window.openFullPlayerProfile(player.user_id); return; }
    const modal = document.getElementById("player-profile-modal");
    const name = document.getElementById("player-profile-name");
    const avatar = document.getElementById("player-profile-avatar");

    if (!modal || !name || !avatar) return;

    const username = String(player.username || "Joueur");
    const avatarUrl = String(player.avatar_url || "").trim();
    const initial = username.trim().charAt(0).toUpperCase() || "?";

    name.textContent = username;
    avatar.textContent = initial;

    if (avatarUrl) {
        const image = document.createElement("img");
        image.alt = "";
        image.onload = () => {
            if (!modal.hidden && name.textContent === username) {
                avatar.replaceChildren(image);
            }
        };
        image.src = avatarUrl;
    }

        const addFriendButton = document.getElementById(
        "player-profile-add-friend"
    );

    const currentUser = JSON.parse(
        localStorage.getItem("user") || "null"
    );

    const playerId = Number(player.user_id);
    const currentUserId = Number(currentUser?.id);

    if (addFriendButton) {
        const canAddFriend =
            Number.isInteger(playerId) &&
            playerId > 0 &&
            Number.isInteger(currentUserId) &&
            currentUserId > 0 &&
            playerId !== currentUserId;

        addFriendButton.hidden = !canAddFriend;
        addFriendButton.disabled = false;
        addFriendButton.textContent = "🤝 Ajouter en ami";

        if (canAddFriend) {
            addFriendButton.dataset.playerId = String(playerId);
        } else {
            delete addFriendButton.dataset.playerId;
        }
    }

    modal.hidden = false;
}

function closePlayerProfile() {
    const modal = document.getElementById("player-profile-modal");
    if (modal) modal.hidden = true;
}

function initPlayerProfile() {
    const modal = document.getElementById("player-profile-modal");
    const close = document.getElementById("player-profile-close");

    if (!modal || !close) return;

        close.addEventListener("click", closePlayerProfile);

    const addFriendButton = document.getElementById(
        "player-profile-add-friend"
    );

    if (addFriendButton) {
        addFriendButton.addEventListener("click", async () => {
            const receiverId = Number(
                addFriendButton.dataset.playerId
            );

            if (!Number.isInteger(receiverId) || receiverId <= 0) {
                showToast("Impossible d'identifier ce joueur.");
                return;
            }

            addFriendButton.disabled = true;
            addFriendButton.textContent = "Envoi...";

            try {
                const result = await api(
                    "/api/users/friends/request",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            receiver_id: receiverId
                        })
                    }
                );

                if (result.ok) {
                    addFriendButton.textContent = "✓ Demande envoyée";
                    showToast("Demande d'ami envoyée !");
                } else {
                    addFriendButton.textContent = "🤝 Ajouter en ami";
                    addFriendButton.disabled = false;

                    showToast(
                        result.data?.error ||
                        "Impossible d'envoyer la demande."
                    );
                }
            } catch (error) {
                addFriendButton.textContent = "🤝 Ajouter en ami";
                addFriendButton.disabled = false;
                showToast("Erreur de connexion.");
            }
        });
    }

    modal.addEventListener("click", event => {
        if (event.target === modal) closePlayerProfile();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !modal.hidden) {
            closePlayerProfile();
        }
    });
}
let roomExpirationInterval = null;
let roomExpirationHandled = false;

async function loadWaitingRoom() {

    const result = await api(
        `/api/rooms/${
            encodeURIComponent(roomCode)
        }`
    );

    if (!result.ok) {
        return;
    }


    const room =
        result.data.room;
    if (room.status === "CANCELLED") {

        stopRoomExpirationTimer();

        showToast(
            "Cette salle a expiré."
        );

        const slug =
            String(
                room.game_type
            ).toLowerCase();

        setTimeout(
            () => {
                location.href =
                    `/games/${slug}`;
            },
            1500
        );

        return;
    }

    const info =
        document.getElementById(
            "room-info"
        );


    if (info) {

        info.textContent =
            `${room.game_type} · ${
                room.status
            } · maximum ${
                room.max_players
            } joueurs`;

    }


    renderRoomUpdate(
        result.data
    );
}

function renderRoomUpdate(data) {

    if (
        !data ||
        !data.room ||
        !Array.isArray(data.members)
    ) {
        console.error(
            "Données de salle invalides:",
            data
        );
        return;
    }

    const room = data.room;
    const gameConfig = data.game_config || {};

    const currentUser =
        JSON.parse(
            localStorage.getItem("user") ||
            "null"
        );

    const currentUserId =
        currentUser
            ? Number(currentUser.id)
            : null;

    const ownerId =
        Number(room.owner_id);

    const isOwner =
        currentUserId !== null &&
        ownerId === currentUserId;

    // -------------------------
    // JOUEURS / PLACES
    // -------------------------

    const membersContainer =
        document.getElementById("members");

    window.roomPresence = Object.fromEntries(data.members.map(m => [String(m.user_id), Boolean(m.is_present)]));

    const players =
        data.members.filter(
            member =>
                member.role === "PLAYER"
        );

        // Les spectateurs ne prennent aucune place à la table.
    const spectators = data.members.filter(member => member.role === "SPECTATOR");
    const spectatorMic = document.getElementById("spectator-microphone");
    const isSpectator = spectators.some(member => Number(member.user_id) === currentUserId);
    if (spectatorMic) spectatorMic.hidden = !isSpectator;
    const spectatorList = document.getElementById("spectators-list");
    const spectatorCount = document.getElementById("spectators-count");
    if (spectatorCount) spectatorCount.textContent = String(spectators.length);
    if (spectatorList) {
        spectatorList.replaceChildren();
        if (!spectators.length) {
            const empty = document.createElement("p");
            empty.className = "spectators-empty";
            empty.textContent = "Aucun spectateur pour le moment.";
            spectatorList.appendChild(empty);
        }
        for (const spectator of spectators) {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "spectator-item";
            const avatar = document.createElement("span");
            avatar.className = "spectator-avatar";
            const username = String(spectator.username || "Spectateur");
            avatar.textContent = username.charAt(0).toUpperCase() || "?";
            const url = String(spectator.avatar_url || "").trim();
            if (url && ((url.startsWith("/") && !url.startsWith("//")) || /^https?:\/\//i.test(url))) {
                const img = document.createElement("img");
                img.alt = "";
                img.src = url;
                img.onerror = () => img.remove();
                avatar.appendChild(img);
            }
            const name = document.createElement("span");
            name.textContent = username;
            const dot = document.createElement("span");
            dot.className = "room-presence-dot";
            dot.dataset.present = spectator.is_present ? "true" : "false";
            dot.title = spectator.is_present ? "Dans la salle" : "Absent";
            item.append(avatar, dot, name);
            item.addEventListener("click", () => openPlayerProfile(spectator));
            spectatorList.appendChild(item);
        }
    }

    const maxPlayers =
        Number(room.max_players || 2);


    if (membersContainer) {

        membersContainer.innerHTML = "";

        membersContainer.className =
            "waiting-player-slots";


        // On crée toujours autant de places
        // que la capacité choisie pour la salle.

        for (
            let index = 0;
            index < maxPlayers;
            index++
        ) {

            const player =
                players[index] || null;


            const slot =
                document.createElement("div");

            slot.className =
                "waiting-player-slot";


            // =============================
            // AVATAR
            // =============================

            const avatar =
                document.createElement("div");

            avatar.className =
                "waiting-player-avatar";


            if (player) {

                slot.classList.add(
                    "occupied"
                );


                const username =
                    player.username ||
                    `Joueur #${player.user_id}`;


                const initial =
                    username.trim().charAt(0).toUpperCase() || "?";

                avatar.textContent = initial;

                const avatarUrl = String(player.avatar_url || "").trim();

                if (avatarUrl) {
                    const image = document.createElement("img");
                    image.alt = "";
                    image.className = "waiting-player-avatar-image";

                    image.onload = () => {
                        // Conserver la couronne éventuelle du propriétaire.
                        const crown = avatar.querySelector(".waiting-player-crown");

                        avatar.replaceChildren(image);

                        if (crown) {
                            avatar.appendChild(crown);
                        }
                    };

                    image.onerror = () => {
                        avatar.textContent = initial;
                    };

                    image.src = avatarUrl;
                }


                // Propriétaire
                if (
                    Number(player.user_id) ===
                    ownerId
                ) {

                    slot.classList.add(
                        "owner"
                    );

                    const crown =
                        document.createElement("span");

                    crown.className =
                        "waiting-player-crown";

                    crown.textContent =
                        "👑";

                    avatar.appendChild(
                        crown
                    );
                }


                // =============================
                // NOM
                // =============================

                const name =
                    document.createElement("span");

                name.className =
                    "waiting-player-name";

                name.textContent =
                    username;


                                avatar.classList.add("player-profile-clickable");
                avatar.setAttribute("role", "button");
                avatar.setAttribute("tabindex", "0");
                avatar.setAttribute(
                    "aria-label",
                    `Voir le profil de ${username}`
                );

                const showProfile = () => {
                    openPlayerProfile(player);
                };

                avatar.addEventListener("click", showProfile);

                avatar.addEventListener("keydown", event => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        showProfile();
                    }
                });

                slot.appendChild(avatar);
                slot.appendChild(name);

            } else {

                slot.classList.add(
                    "empty"
                );

                avatar.textContent = "+";

                const name =
                    document.createElement("span");

                name.className =
                    "waiting-player-name";

                name.textContent =
                    "Libre";

                slot.appendChild(avatar);
                slot.appendChild(name);
            }


            membersContainer.appendChild(
                slot
            );
        }


        // =============================
        // COMPTEUR
        // =============================

        const counter =
            document.createElement("div");

        counter.className =
            "waiting-player-counter";

        counter.textContent =
            `${players.length} / ${maxPlayers} joueurs`;


        membersContainer.appendChild(
            counter
        );
    }


    // -------------------------
    // TIMER DE LA SALLE
    // -------------------------

    if (room.status === "WAITING") {

        if (data.timeout) {

            startRoomExpirationTimer(
                data.timeout,
                room
            );
        }

    } else {

        stopRoomExpirationTimer();

        roomExpirationHandled = true;

        document
            .getElementById(
                "room-expiration"
            )
            ?.classList.add(
                "hidden"
            );
    }


    // -------------------------
    // NOMBRE DE JOUEURS
    // -------------------------

    const playerCount =players.length;

    const minimumPlayers =
        Number(
            gameConfig.min_players || 2
        );


    // -------------------------
    // BOUTON DÉMARRER
    // -------------------------

    const startButton =
        document.getElementById(
            "start-btn"
        );

    if (startButton) {

        if (!isOwner) {

            startButton.classList.add(
                "hidden"
            );

            startButton.disabled = true;

        } else {

            startButton.classList.remove(
                "hidden"
            );

            startButton.disabled =
                playerCount < minimumPlayers;
        }
    }


    console.log(
        "ROOM:",
        room.code,
        "OWNER:",
        ownerId,
        "CURRENT USER:",
        currentUserId,
        "IS OWNER:",
        isOwner,
        "PLAYERS:",
        playerCount
    );
}

function renderChatMessage(data) {
    const container = document.getElementById("chat-messages");
    if (!container || !data) return;

    container.querySelector(".chat-empty")?.remove();

    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    const username = String(data.username || "Joueur");
    const senderId = data.user_id ?? data.sender_id;
    const isMe = senderId != null && currentUser?.id != null
        ? String(senderId) === String(currentUser.id)
        : username === currentUser?.username;

    const row = document.createElement("div");
    row.className = "chat-message" + (isMe ? " is-me" : "");

        const avatar = document.createElement("div");
    avatar.className = "chat-avatar";
    avatar.setAttribute("aria-label", `Avatar de ${username}`);

    const initial = username.trim().charAt(0).toUpperCase() || "?";
    const avatarUrl = String(data.avatar_url || "").trim();

    // Affichage par défaut si aucune photo n'existe.
    avatar.textContent = initial;

    if (avatarUrl) {
        const image = document.createElement("img");

        image.className = "chat-avatar-image";
        image.alt = "";
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";

        image.addEventListener("load", () => {
            avatar.replaceChildren(image);
        });

        image.addEventListener("error", () => {
            // En cas de photo introuvable, on garde l'initiale.
            avatar.textContent = initial;
        });

        image.src = avatarUrl;
    }
        avatar.classList.add("player-profile-clickable");
    avatar.setAttribute("role", "button");
    avatar.setAttribute("tabindex", "0");
    avatar.setAttribute(
        "aria-label",
        `Voir le profil de ${username}`
    );

    const showProfile = () => {
        openPlayerProfile({
            user_id: senderId,
            username: username,
            avatar_url: avatarUrl
        });
    };

    avatar.addEventListener("click", showProfile);

    avatar.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            showProfile();
        }
    });

    const content = document.createElement("div");
    content.className = "chat-message-content";

    const header = document.createElement("div");
    header.className = "chat-message-header";

    const name = document.createElement("strong");
    name.textContent = isMe ? "Moi" : username;

    const time = document.createElement("span");
    const date = data.created_at ? new Date(data.created_at) : null;
    time.textContent = date && !Number.isNaN(date.getTime())
        ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";

    header.append(name, time);

    const text = document.createElement("div");
    text.className = "chat-message-text";
    text.textContent = String(data.message ?? "");

    content.append(header, text);
    row.append(avatar, content);
    container.appendChild(row);
    window.ChatCommon?.decorate(row, "room", data, isMe, text);
    container.scrollTop = container.scrollHeight;
}

function renderChatHistory(messages) {

    const container =
        document.getElementById(
            "chat-messages"
        );

    if (!container) {
        return;
    }


    container.innerHTML = "";

    messages.forEach(
        renderChatMessage
    );
}

async function leaveRoom() {

    const result = await api(
        `/api/rooms/${
            encodeURIComponent(roomCode)
        }/leave`,
        {
            method: "POST"
        }
    );


    if (result.ok) {

        location.href =
            "/lobby";

    }
}

function initRoomChat() {

    const form =
        document.getElementById(
            "chat-form"
        );


    if (!form) {
        return;
    }


     // Le sélecteur commun est installé par emoji-picker.js.

      form.addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const input =
                document.getElementById(
                    "chat-input"
                );

            const message =
                input.value.trim();


            if (!message) {
                return;
            }


            if (!window.gameSocket) {

                showToast(
                    "Connexion temps réel indisponible."
                );

                return;

            }


            window.gameSocket.emit(
                "chat:send",
                {
                    room_code:
                        roomCode,

                    message:
                        message,
                        reply_to_id: window.ChatCommon?.replyId("room")
                }
            );


            input.value = "";
            window.ChatCommon?.clearReply("room");

            input.focus();

        }
    );
}

function initRoom() {

    console.log("initRoom OK");

    initRoomChat();
    initChatCustomScrollbar();
    initPlayerProfile();
    const spectatorMic = document.getElementById("spectator-microphone");
    spectatorMic?.addEventListener("click", async () => {
        if (typeof presidentVoice === "undefined") return;
        await presidentVoice.toggleMicrophone();
        const enabled = presidentAudioState.microphoneEnabled;
        spectatorMic.textContent = enabled ? "🎙️ Couper mon micro" : "🎙️ Activer mon micro";
        spectatorMic.setAttribute("aria-label", enabled ? "Couper mon microphone" : "Activer mon microphone");
    });

    document
        .getElementById("leave-btn")
        ?.addEventListener(
            "click",
            leaveRoom
        );

    loadWaitingRoom();
}

function stopRoomExpirationTimer() {

    if (roomExpirationInterval) {

        clearInterval(
            roomExpirationInterval
        );

        roomExpirationInterval = null;
    }
}

function startRoomExpirationTimer(timeoutData,room) {
    stopRoomExpirationTimer();
    roomExpirationHandled = false;
    const container =
        document.getElementById(
            "room-expiration"
        );

    const timeLabel =
        document.getElementById(
            "room-time-left"
        );

    const progress =
        document.getElementById(
            "room-timeout-progress"
        );

    if (
        !container ||
        !timeLabel ||
        !progress ||
        !timeoutData
    ) {
        return;
    }


    const total =
        Number(
            timeoutData.timeout_seconds
        );

    let remaining =
        Number(
            timeoutData.remaining_seconds
        );


    if (
        !Number.isFinite(total) ||
        total <= 0
    ) {
        container.classList.add(
            "hidden"
        );

        return;
    }


    container.classList.remove(
        "hidden"
    );

    function renderTimer() {

        remaining = Math.max(
            0,
            remaining
        );

        timeLabel.textContent =
            `${Math.ceil(remaining)} s`;


        const percentage =
            Math.max(
                0,
                Math.min(
                    100,
                    (remaining / total) * 100
                )
            );

        progress.style.width =
            `${percentage}%`;


        container.classList.toggle(
            "expiring",
            remaining <= 10 &&
            remaining > 0
        );


        if (remaining <= 0) {

            stopRoomExpirationTimer();

            handleRoomExpiration(
                room
            );

            return;
        }

        remaining -= 1;
    }


    renderTimer();

    roomExpirationInterval =
        setInterval(
            renderTimer,
            1000
        );
}

async function handleRoomExpiration(room) {

    if (roomExpirationHandled) {
        return;
    }

    roomExpirationHandled = true;

    // On demande toujours l'état réel au serveur.
    const result = await api(
        `/api/rooms/${
            encodeURIComponent(room.code)
        }`
    );

    if (!result.ok) {
        return;
    }

    const serverRoom =
        result.data?.room;

    if (!serverRoom) {
        return;
    }


    // IMPORTANT :
    // la partie a été lancée entre-temps.
    // Le room timeout ne s'applique plus.
    if (serverRoom.status === "PLAYING") {

        stopRoomExpirationTimer();

        document
            .getElementById(
                "room-expiration"
            )
            ?.classList.add(
                "hidden"
            );

        return;
    }


    // Si elle n'est pas réellement annulée,
    // le frontend ne fait rien.
    if (serverRoom.status !== "CANCELLED") {

        roomExpirationHandled = false;

        return;
    }


    // Ici seulement le serveur confirme
    // réellement l'expiration.
    const container =
        document.getElementById(
            "room-expiration"
        );

    const label =
        document.getElementById(
            "room-time-left"
        );

    if (container) {
        container.classList.add(
            "expired"
        );
    }

    if (label) {
        label.textContent =
            "Temps expiré";
    }


    showToast(
        "Le temps d'attente est expiré. La partie a été annulée."
    );


    setTimeout(
        () => {

            const slug =
                String(
                    serverRoom.game_type
                ).toLowerCase();

            location.href =
                `/games/${slug}`;

        },
        1800
    );
}

function initChatCustomScrollbar() {
    const messages = document.getElementById("chat-messages");
    const panel = document.getElementById("chat-panel");

    if (!messages || !panel) return;

    const track = document.createElement("div");
    track.className = "chat-scroll-track";

    const thumb = document.createElement("div");
    thumb.className = "chat-scroll-thumb";

    track.appendChild(thumb);
    panel.appendChild(track);

    function updateScrollbar() {
        const scrollHeight = messages.scrollHeight;
        const clientHeight = messages.clientHeight;

        if (scrollHeight <= clientHeight) {
            track.style.display = "none";
            return;
        }

        track.style.display = "block";

        const trackHeight = track.clientHeight;

        const thumbHeight = Math.max(
            24,
            (clientHeight / scrollHeight) * trackHeight
        );

        const maxScroll = scrollHeight - clientHeight;

        const thumbTop =
            (messages.scrollTop / maxScroll) *
            (trackHeight - thumbHeight);

        thumb.style.height = `${thumbHeight}px`;
        thumb.style.top = `${thumbTop}px`;
    }

    messages.addEventListener("scroll", updateScrollbar);

    const observer = new ResizeObserver(updateScrollbar);
    observer.observe(messages);

    const mutationObserver = new MutationObserver(updateScrollbar);
    mutationObserver.observe(messages, {
        childList: true,
        subtree: true,
        characterData: true
    });

    updateScrollbar();
}