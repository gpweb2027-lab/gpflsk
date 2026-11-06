// Photo de profil ou initiale du joueur.
function gameLobbyAvatarHtml(player) {
    const username = String(
    player?.pseudo?.trim() ||
    player?.username ||
    "Joueur"
);
    const initial = username.trim().charAt(0).toUpperCase() || "?";

    const currentUser = JSON.parse(
        localStorage.getItem("user") || "null"
    );

    const isMe = currentUser &&
        Number(player?.user_id) === Number(currentUser.id);

    const avatarUrl = String(
        player?.avatar_url ||
        (isMe ? currentUser.avatar_url : "") ||
        ""
    ).trim();

    // Évite d'insérer une adresse dangereuse dans le HTML.
    const validUrl =
        avatarUrl.startsWith("/") && !avatarUrl.startsWith("//") ||
        /^https?:\/\//i.test(avatarUrl);

    if (!avatarUrl || !validUrl) {
        return escapeHtml(initial);
    }

    return `
        <img
            src="${escapeHtml(avatarUrl)}"
            alt=""
            loading="lazy"
            onerror="this.replaceWith(document.createTextNode('${escapeHtml(initial)}'))"
        >
    `;
}

let gameRoomsLoading = false;

let selectedRoomMode = "NORMAL";
let selectedRoomVisibility = "PUBLIC";
let selectedMaxPlayers =
    Number(currentGameConfig.min_players);

function openCreateRoomModal() {

    const modal =
        document.getElementById(
            "create-room-modal"
        );

    if (!modal) {
        return;
    }

    selectedRoomMode = "NORMAL";
    selectedRoomVisibility = "PUBLIC";
    selectedMaxPlayers =
        Number(currentGameConfig.min_players);

    renderCreateRoomOptions();

    modal.classList.remove("hidden");
    modal.setAttribute(
        "aria-hidden",
        "false"
    );
}

function closeCreateRoomModal() {

    const modal =
        document.getElementById(
            "create-room-modal"
        );

    if (!modal) {
        return;
    }

    modal.classList.add("hidden");
    modal.setAttribute(
        "aria-hidden",
        "true"
    );
}

async function createGameRoom() {

    const button =
        document.getElementById(
            "confirm-create-room"
        );

    if (button) {
        button.disabled = true;
    }


    try {

        const result = await api(
            "/api/rooms",
            {
                method: "POST",

                body: {
                    game_type:
                        currentGameType,

                    room_mode:
                        selectedRoomMode,

                    visibility:
                        selectedRoomVisibility,

                    max_players:
                        selectedMaxPlayers
                }
            }
        );


        if (!result.ok) {

            showToast(
                result.data?.error ||
                "Impossible de créer la partie."
            );

            return;
        }


        const room =
            result.data?.room;


        if (!room?.code) {

            showToast(
                "La salle a été créée mais son code est introuvable."
            );

            return;
        }


        // Fermer la fenêtre avant de quitter la page.
        // Le navigateur peut restaurer cette page depuis son cache
        // lorsque le joueur revient avec la flèche Retour.
        closeCreateRoomModal();

        location.href =
            `/room/${
                encodeURIComponent(
                    room.code
                )
            }`;

    } finally {

        if (button) {
            button.disabled = false;
        }
    }
}

function renderCreateRoomOptions() {

    document
        .querySelectorAll(
            "[data-room-mode]"
        )
        .forEach(button => {

            button.classList.toggle(
                "selected",
                button.dataset.roomMode ===
                    selectedRoomMode
            );
        });


    document
        .querySelectorAll(
            "[data-room-visibility]"
        )
        .forEach(button => {

            button.classList.toggle(
                "selected",
                button.dataset.roomVisibility ===
                    selectedRoomVisibility
            );
        });


    const countLabel =
        document.getElementById(
            "selected-player-count"
        );

    if (countLabel) {
        countLabel.textContent =
            selectedMaxPlayers;
    }


    const container =
        document.getElementById(
            "player-count-options"
        );

    if (!container) {
        return;
    }


    const min =
        Number(
            currentGameConfig.min_players
        );

    const max =
        Number(
            currentGameConfig.max_players
        );


    let html = "";

    for (
        let count = min;
        count <= max;
        count++
    ) {

        html += `
            <button
                type="button"
                class="
                    player-count-button
                    ${
                        count ===
                        selectedMaxPlayers
                            ? "selected"
                            : ""
                    }
                "
                data-player-count="${count}"
            >
                ${count}
            </button>
        `;
    }

    container.innerHTML = html;


    container
        .querySelectorAll(
            "[data-player-count]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    selectedMaxPlayers =
                        Number(
                            button.dataset.playerCount
                        );

                    renderCreateRoomOptions();
                }
            );
        });
}

async function joinGameRoom(code) {

    const result = await api(
        `/api/rooms/${
            encodeURIComponent(code)
        }/join`,
        {
            method: "POST",

            body: {
                role: "PLAYER"
            }
        }
    );

    if (!result.ok) {

        showToast(
            result.data?.error ||
            "Impossible de rejoindre cette partie."
        );

        await loadGameRooms();

        return;
    }

    location.href =
        `/room/${
            encodeURIComponent(code)
        }`;
}

function renderGameRooms(rooms) {

    const container =
        document.getElementById(
            "game-rooms"
        );

    if (!container) {
        return;
    }


    // =====================================================
    // AUCUNE PARTIE
    // =====================================================

    if (!rooms.length) {

        container.innerHTML = `
            <div class="empty-game-rooms">

                <div class="empty-game-icon">
                    ${escapeHtml(
                        currentGameConfig.emoji
                    )}
                </div>

                <h3>
                    Aucune partie disponible
                </h3>

                <p>
                    Il n'y a aucun salon public
                    en attente.
                    Crée la première partie !
                </p>

            </div>
        `;

        return;
    }


    // =====================================================
    // PARTIES
    // =====================================================

    container.innerHTML =
        rooms.map(room => {

            const players =
                Array.isArray(room.players)
                    ? room.players
                    : [];


            const playerCount =
                Number(
                    room.player_count ??
                    players.length
                );


            const maxPlayers =
                Number(
                    room.max_players ||
                    currentGameConfig.max_players
                );


            const isFull =
                playerCount >= maxPlayers;


            const mode =
                String(
                    room.room_mode ||
                    "NORMAL"
                ).toUpperCase();


            const visibility =
                String(
                    room.visibility ||
                    "PUBLIC"
                ).toUpperCase();


            // Le propriétaire est normalement
            // le premier joueur de la salle.
            const owner =
                players.find(
                    player =>
                        Number(player.user_id) ===
                        Number(room.owner_id)
                ) || players[0];


            const ownerName =
                owner?.pseudo?.trim() ||
                owner?.username ||
                "Joueur";


            // =================================================
            // EMPLACEMENTS JOUEURS
            // =================================================

            let slotsHtml = "";


            for (
                let index = 0;
                index < maxPlayers;
                index++
            ) {

                const player =
                    players[index];


                if (player) {

                    const username =
                        String(
                            player.pseudo?.trim() ||
                            player.username ||
                            "Joueur"
                        );


                    const initial =
                        username
                            .trim()
                            .charAt(0)
                            .toUpperCase() ||
                        "?";


                    const isOwner =
                        Number(player.user_id) ===
                        Number(room.owner_id);


                    slotsHtml += `
                        <div
                            class="
                                room-player-slot
                                filled
                                ${
                                    isOwner
                                        ? "owner"
                                        : ""
                                }
                            "
                            title="${
                                escapeHtml(username)
                            }"
                        >

                            <div class="room-player-avatar">

                                ${
                                    isOwner
                                        ? `<span class="room-owner-crown">👑</span>`
                                        : ""
                                }

                                ${gameLobbyAvatarHtml(player)}

                            </div>

                            <span class="room-player-name">
                                ${escapeHtml(username)}
                            </span>

                        </div>
                    `;

                } else {

                    slotsHtml += `
                        <div
                            class="
                                room-player-slot
                                empty
                            "
                            title="Place disponible"
                        >

                            <div class="room-player-avatar">
                                +
                            </div>

                            <span class="room-player-name">
                                Libre
                            </span>

                        </div>
                    `;
                }
            }


            // =================================================
            // BADGES
            // =================================================

            const modeIcon =
                mode === "TOURNAMENT"
                    ? "🏆"
                    : "🎮";


            const modeLabel =
                mode === "TOURNAMENT"
                    ? "TOURNOI"
                    : "NORMAL";


            const visibilityIcon =
                visibility === "PRIVATE"
                    ? "🔒"
                    : "🌍";


            const visibilityLabel =
                visibility === "PRIVATE"
                    ? "PRIVÉE"
                    : "PUBLIQUE";


            return `
                <article class="game-room-row">

                    <div class="game-room-row-header">

                        <div class="game-room-owner">

                            <div class="game-room-owner-avatar">
                                ${gameLobbyAvatarHtml(owner)}
                            </div>
                            <div>

                                <strong>
                                    👑
                                    ${escapeHtml(
                                        ownerName
                                    )}
                                </strong>

                                <div class="game-room-badges">

                                    <span class="room-mode-badge">
                                        ${modeIcon}
                                        ${modeLabel}
                                    </span>

                                    <span class="room-visibility-badge">
                                        ${visibilityIcon}
                                        ${visibilityLabel}
                                    </span>

                                </div>

                            </div>

                        </div>


                        <div class="game-room-capacity">

                            <strong>
                                ${playerCount}/${maxPlayers}
                            </strong>

                            <span>
                                joueurs
                            </span>

                        </div>

                    </div>


                    <div class="game-room-row-bottom">

                        <div class="room-player-slots">
                            ${slotsHtml}
                        </div>


                        <button
                            type="button"
                            class="join-room-button"
                            data-room-code="${
                                escapeHtml(
                                    room.code
                                )
                            }"
                            ${isFull ? "disabled" : ""}
                        >
                            ${
                                isFull
                                     ? "Complet"
                                     : "Rejoindre"
                            }
                        </button>

                    </div>

                </article>
            `;

        }).join("");


    // =====================================================
    // BOUTONS REJOINDRE
    // =====================================================

    container
        .querySelectorAll(
            "[data-room-code]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    if (button.disabled) {
                        return;
                    }

                    button.disabled = true;

                    await joinGameRoom(
                        button.dataset.roomCode
                    );
                }
            );
        });
}

async function loadGameRooms() {

    if (gameRoomsLoading) {
        return;
    }

    gameRoomsLoading = true;

    const container =
        document.getElementById(
            "game-rooms"
        );

    try {

        const result = await api(
            "/api/rooms"
        );

        if (!result.ok) {

            if (container) {
                container.innerHTML = `
                    <div class="rooms-error">
                        Impossible de charger les parties.
                    </div>
                `;
            }

            return;
        }


        const rooms =
            (result.data?.rooms || [])
                .filter(room =>
                    room.game_type ===
                        currentGameType &&
                    room.status ===
                        "WAITING"
                );


        renderGameRooms(
            rooms
        );

    } finally {

        gameRoomsLoading = false;
    }
}

let roomListInterval = null;

document.addEventListener(
    "DOMContentLoaded",
    () => {

        // =====================================================
        // OUVRIR LA MODALE
        // =====================================================

        document
            .getElementById(
                "create-game-room"
            )
            ?.addEventListener(
                "click",
                openCreateRoomModal
            );


        // =====================================================
        // CONFIRMER LA CRÉATION
        // =====================================================

        document
            .getElementById(
                "confirm-create-room"
            )
            ?.addEventListener(
                "click",
                createGameRoom
            );


        // =====================================================
        // FERMER LA MODALE
        // =====================================================

        document
            .getElementById(
                "close-create-room-modal"
            )
            ?.addEventListener(
                "click",
                closeCreateRoomModal
            );


        document
            .getElementById(
                "cancel-create-room"
            )
            ?.addEventListener(
                "click",
                closeCreateRoomModal
            );


        document
            .querySelector(
                ".room-modal-backdrop"
            )
            ?.addEventListener(
                "click",
                closeCreateRoomModal
            );


        // =====================================================
        // TYPE : NORMAL / TOURNOI
        // =====================================================

        document
            .querySelectorAll(
                "[data-room-mode]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        selectedRoomMode =
                            button.dataset.roomMode;

                        renderCreateRoomOptions();
                    }
                );
            });


        // =====================================================
        // VISIBILITÉ : PUBLIC / PRIVÉ
        // =====================================================

        document
            .querySelectorAll(
                "[data-room-visibility]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        selectedRoomVisibility =
                            button.dataset.roomVisibility;

                        renderCreateRoomOptions();
                    }
                );
            });


        // =====================================================
        // TOUCHE ÉCHAP
        // =====================================================

        document.addEventListener(
            "keydown",
            event => {

                if (event.key === "Escape") {
                    closeCreateRoomModal();
                }
            }
        );


        // =====================================================
        // ACTUALISER LES PARTIES
        // =====================================================

        document
            .getElementById(
                "refresh-game-rooms"
            )
            ?.addEventListener(
                "click",
                loadGameRooms
            );


        // =====================================================
        // INITIALISATION
        // =====================================================

        renderCreateRoomOptions();

        // Premier chargement immédiat
        loadGameRooms();


        // Actualisation automatique
        // toutes les 3 secondes.
        roomListInterval =
            setInterval(
                loadGameRooms,
                3000
            );
    }
);
// Interrompt immédiatement les interrogations répétées après expiration de session.
document.addEventListener("auth:expired", () => {
    if (roomListInterval !== null) {
        clearInterval(roomListInterval);
        roomListInterval = null;
    }
});