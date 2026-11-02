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

    const players =
        data.members.filter(
            member =>
                member.role === "PLAYER"
        );

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


                avatar.textContent =
                    username
                        .trim()
                        .charAt(0)
                        .toUpperCase() ||
                    "?";


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

    const container =
        document.getElementById(
            "chat-messages"
        );

    if (!container) {
        return;
    }


    const row =
        document.createElement("div");

    row.className =
        "chat-message";


    const header =
        document.createElement("div");

    header.className =
        "chat-message-header";


    const username =
        document.createElement("strong");

    username.textContent =
        data.username;


    const time =
        document.createElement("span");

    const date =
        new Date(data.created_at);

    time.textContent =
        date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );


    header.appendChild(username);
    header.appendChild(time);


    const text =
        document.createElement("div");

    text.className =
        "chat-message-text";

    text.textContent =
        data.message;


    row.appendChild(header);
    row.appendChild(text);

    container.appendChild(row);

    container.scrollTop =
        container.scrollHeight;
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
                        message
                }
            );


            input.value = "";

            input.focus();

        }
    );
}

function initRoom() {

    console.log("initRoom OK");

    initRoomChat();

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