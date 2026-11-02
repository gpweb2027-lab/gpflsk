let selectedCards = new Set();
let latestState = null;
let presidentStateInterval = null;
let presidentStateLoading = false;
let presidentTurnTimerInterval = null;
let presidentTimerTurnStartedAt = null;


function presidentCardLabel(card) {

    const suits = {
        C: "♣",
        D: "♦",
        H: "♥",
        S: "♠"
    };

    const suit =
        suits[card.suit] || card.suit;

    return `${card.rank}${suit}`;
}

function renderPresidentCards() {

    const hand =
        document.getElementById("hand");

    if (!hand) {
        return;
    }

    hand.innerHTML = "";

    const cards =
        latestState?.your_hand || [];


    const handCount =
        document.getElementById(
            "hand-count"
        );

    if (handCount) {

        handCount.textContent =
            `${cards.length} carte${
                cards.length > 1 ? "s" : ""
            }`;
    }


    cards.forEach(card => {

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "playing-card" +
            (
                selectedCards.has(card.id)
                    ? " selected"
                    : ""
            );


        const rank =
            document.createElement("span");

        rank.className = "card-rank";
        rank.textContent = card.rank;


        const suitSymbols = {
            C: "♣",
            D: "♦",
            H: "♥",
            S: "♠"
        };


        const suit =
            document.createElement("span");

        suit.className = "card-suit";

        suit.textContent =
            suitSymbols[card.suit]
            || card.suit;


        if (
            card.suit === "D" ||
            card.suit === "H"
        ) {
            suit.classList.add(
                "red-suit"
            );
        }


        button.appendChild(rank);
        button.appendChild(suit);


        button.addEventListener(
            "click",
            () => {

                if (
                    selectedCards.has(card.id)
                ) {
                    selectedCards.delete(
                        card.id
                    );
                } else {
                    selectedCards.add(
                        card.id
                    );
                }

                renderPresidentCards();
                updatePresidentSelectedCount();
            }
        );


        hand.appendChild(button);
    });
}

function updatePresidentSelectedCount() {

    const counter =
        document.getElementById(
            "selected-count"
        );

    if (!counter) {
        return;
    }

    counter.textContent =
        `${selectedCards.size} carte${
            selectedCards.size > 1
                ? "s"
                : ""
        }`;
}

function stopPresidentTurnTimer() {

    if (presidentTurnTimerInterval) {

        clearInterval(
            presidentTurnTimerInterval
        );

        presidentTurnTimerInterval = null;
    }
}

function startPresidentTurnTimer(timerData, state) {

    stopPresidentTurnTimer();

    if (!timerData || state.finished) {
        return;
    }

    const total =
        Number(timerData.timeout_seconds) || 15;

    let remaining =
        Number(timerData.remaining_seconds);

    if (!Number.isFinite(remaining)) {
        remaining = total;
    }


    function updateTimer() {

        const progress =
            document.querySelector(
                ".president-table-player.is-current " +
                ".president-turn-mini-progress"
            );

        if (!progress) {
            return;
        }


        const percent =
            Math.max(
                0,
                Math.min(
                    100,
                    (remaining / total) * 100
                )
            );


        progress.style.width =
            `${percent}%`;


        if (remaining <= 0) {

            progress.style.width = "0%";

            stopPresidentTurnTimer();

            loadPresidentState();

            return;
        }


        remaining -= 0.05;
    }


    updateTimer();


    presidentTurnTimerInterval =
        setInterval(
            updateTimer,
            50
        );
}

function renderPresidentState(state) {

    if (!state) {

        console.error(
            "renderPresidentState: state absent"
        );

        return;
    }


    console.log(
        "RENDER PRESIDENT",
        {
            currentPlayer:
                state.current_player,

            cards:
                state.your_hand?.length,

            finished:
                state.finished
        }
    );


    latestState = state;
    renderPresidentPlayers(state);

    // ==========================================
    // TIMER DU TOUR
    // ==========================================

    if (
        state.started &&
        !state.finished &&
        state.turn_timer
    ) {

        if (
            presidentTimerTurnStartedAt !==
            state.turn_started_at
        ) {

            presidentTimerTurnStartedAt =
                state.turn_started_at;

            startPresidentTurnTimer(
                state.turn_timer,
                state
            );
        }

    } else {

        presidentTimerTurnStartedAt = null;

        stopPresidentTurnTimer();

        document
            .getElementById(
                "president-turn-timer"
            )
            ?.classList.add(
                "hidden"
            );
    }


    // ==========================================
    // POLLING
    // ==========================================

    if (
        state.started &&
        !state.finished
    ) {

        startPresidentStatePolling();

    } else {

        stopPresidentStatePolling();
    }


    // ==========================================
    // PANELS
    // ==========================================

    document
        .getElementById(
            "waiting-panel"
        )
        ?.classList.add(
            "hidden"
        );


    document
        .getElementById(
            "game-panel"
        )
        ?.classList.remove(
            "hidden"
        );


    // ==========================================
    // UTILISATEUR
    // ==========================================

    const userData =
        localStorage.getItem(
            "user"
        );


    if (!userData) {

        location.href = "/login";

        return;
    }


    const user =
        JSON.parse(userData);


    const myTurn =
        Number(state.current_player) ===
        Number(user.id);


    // ==========================================
    // INFORMATION DU TOUR
    // ==========================================

    const turnInfo =
        document.getElementById(
            "turn-info"
        );


    if (turnInfo) {

        const currentPlayer =
            state.players.find(
                player =>
                    Number(player.user_id) ===
                    Number(state.current_player)
            );


        const currentPlayerName =
            currentPlayer?.username ||
            `Joueur #${state.current_player}`;


        turnInfo.textContent =
            state.finished
                ? "La partie est terminée."
                : myTurn
                    ? "C'est ton tour."
                    : `Tour de ${currentPlayerName}`;
    }


    // ==========================================
    // AFFICHAGE
    // ==========================================

    renderPresidentCurrentPlay(state);

    renderPresidentResults(state);

    renderPresidentCards();


    // ==========================================
    // BOUTONS
    // ==========================================

    const playButton =
        document.getElementById(
            "play-btn"
        );


    const passButton =
        document.getElementById(
            "pass-btn"
        );


    if (playButton) {

        playButton.disabled =
            !myTurn ||
            state.finished;
    }


    if (passButton) {

        passButton.disabled =
            !myTurn ||
            state.finished ||
            !state.current_play.length;
    }
}

function renderPresidentPlayers(state) {

    const container =
        document.getElementById("players");

    if (!container) {
        return;
    }

    container.innerHTML = "";


    // ==========================================
    // UTILISATEUR CONNECTÉ
    // ==========================================

    const userData =
        localStorage.getItem("user");

    if (!userData) {
        return;
    }

    const currentUser =
        JSON.parse(userData);

    const myUserId =
        Number(currentUser.id);


    // ==========================================
    // JOUEURS
    // ==========================================

    const players =
        Array.isArray(state.players)
            ? [...state.players]
            : [];


    /*
     * On place toujours le joueur connecté
     * en premier.
     *
     * Position 0 = bas de la table.
     */

    const myIndex =
        players.findIndex(
            player =>
                Number(player.user_id) ===
                myUserId
        );


    if (myIndex > 0) {

        const reordered = [
            ...players.slice(myIndex),
            ...players.slice(0, myIndex)
        ];

        players.splice(
            0,
            players.length,
            ...reordered
        );
    }


    const playerCount =
        players.length;


    // Permet au CSS de savoir combien
    // de joueurs sont présents.
    container.dataset.playerCount =
        String(playerCount);


    // ==========================================
    // CRÉATION DES JOUEURS
    // ==========================================

    players.forEach((player, index) => {

        const playerElement =
            document.createElement("div");

        playerElement.className =
            "president-table-player";


        const isMe =
            Number(player.user_id) ===
            myUserId;


        const isCurrent =
            Number(player.user_id) ===
            Number(state.current_player);

        let playerSide = "top";

        if (isMe) {
            playerSide = "bottom";
        } else if (playerCount > 2) {

            const relativePosition =
                index / (playerCount - 1);

            if (relativePosition < 0.35) {
                playerSide = "left";
            } else if (relativePosition > 0.65) {
                playerSide = "right";
            }
        }

        playerElement.classList.add(
            `player-${playerSide}`
        );

        if (isMe) {
            playerElement.classList.add("is-me");
        }


        if (isCurrent) {
            playerElement.classList.add(
                "is-current"
            );
        }


        /*
         * Le premier joueur est toujours
         * placé en bas.
         *
         * Les autres sont distribués
         * automatiquement autour de la table.
         */

        let angle;

        if (index === 0) {

            // Moi = bas
            angle = 90;

        } else {

            const opponents =
                playerCount - 1;

            /*
             * Les adversaires occupent
             * l'arc supérieur de la table.
             *
             * De gauche à droite :
             * 200° -> 340°
             */

            if (opponents === 1) {

                // 2 joueurs :
                // adversaire exactement en haut
                angle = 270;

            } else {

                angle =
                    200 +
                    (
                        (index - 1) /
                        (opponents - 1)
                    ) * 140;
            }
        }


        const radians =
            angle * Math.PI / 180;

        const x =
            50 + Math.cos(radians) * 42;

        const y =
            50 + Math.sin(radians) * 37;

        playerElement.style.left =
            `${x}%`;

        playerElement.style.top =
            `${y}%`;


        // ======================================
        // AVATAR
        // ======================================

        const username =
            player.username ||
            `Joueur #${player.user_id}`;


        const initial =
            username
                .trim()
                .charAt(0)
                .toUpperCase() ||
            "?";


        const avatar =
            document.createElement("div");

        avatar.className =
            "president-player-avatar";

        avatar.textContent = initial;


        // ======================================
        // DOS DES CARTES DE L'ADVERSAIRE
        // ======================================

        let opponentCards = null;

        if (!isMe) {

            opponentCards =
                document.createElement("div");

            opponentCards.className =
                "president-opponent-cards";

            const visibleCards =
                Math.min(
                    Number(player.cards_count) || 0,
                    6
                );

            for (
                let i = 0;
                i < visibleCards;
                i++
            ) {

                const cardBack =
                    document.createElement("span");

                cardBack.className =
                    "president-card-back";

                cardBack.style.setProperty(
                    "--card-index",
                    i
                );

                opponentCards.appendChild(
                    cardBack
                );
            }
        }



        // ======================================
        // INFORMATIONS
        // ======================================

        const info =
            document.createElement("div");

        info.className =
            "president-player-info";


        const name =
            document.createElement("strong");

        name.className =
            "president-player-name";

        name.textContent =
            isMe
                ? `${username} (toi)`
                : username;

        const presenceDot =
            document.createElement("span");

        presenceDot.className =
            "president-presence-dot";

        presenceDot.title = "Joueur présent";

        const cardCount =
            document.createElement("div");

        cardCount.className =
            "president-card-count";

        cardCount.textContent =
            player.position
                ? `🏆 ${player.position}e`
                : `${player.cards_count}`;


        info.appendChild(name);

        const nameRow =
            document.createElement("div");

        nameRow.className =
            "president-player-name-row";

        const audioButton =
    document.createElement("button");

audioButton.type = "button";

audioButton.className =
    "president-audio-button";


if (isMe) {

    // MON MICRO
    audioButton.classList.add(
        "president-mic-button"
    );

    audioButton.innerHTML = "🎤";
    audioButton.title = "Couper mon microphone";

    audioButton.dataset.audioState = "on";

    audioButton.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            const enabled =
                audioButton.dataset.audioState === "on";

            if (enabled) {

                audioButton.dataset.audioState = "off";
                audioButton.innerHTML = "🔇";
                audioButton.title = "Activer mon microphone";

                audioButton.classList.add(
                    "is-muted"
                );

            } else {

                audioButton.dataset.audioState = "on";
                audioButton.innerHTML = "🎤";
                audioButton.title = "Couper mon microphone";

                audioButton.classList.remove(
                    "is-muted"
                );
            }
        }
    );

} else {

    // HAUT-PARLEUR DES AUTRES JOUEURS
    audioButton.classList.add(
        "president-speaker-button"
    );

    audioButton.innerHTML = "🔊";
    audioButton.title =
        `Couper ${username}`;

    audioButton.dataset.audioState = "on";

    audioButton.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            const enabled =
                audioButton.dataset.audioState === "on";

            if (enabled) {

                audioButton.dataset.audioState = "off";
                audioButton.innerHTML = "🔇";

                audioButton.title =
                    `Écouter ${username}`;

                audioButton.classList.add(
                    "is-muted"
                );

            } else {

                audioButton.dataset.audioState = "on";
                audioButton.innerHTML = "🔊";

                audioButton.title =
                    `Couper ${username}`;

                audioButton.classList.remove(
                    "is-muted"
                );
            }
        }
    );
}

        nameRow.appendChild(name);
        nameRow.appendChild(presenceDot);
        info.appendChild(audioButton);
        info.appendChild(nameRow);

        if (isCurrent && !state.finished) {

            const turnBar =
                document.createElement("div");

            turnBar.className =
                "president-turn-mini-bar";

            const clock =
                document.createElement("span");

            clock.className =
                "president-turn-clock";

            clock.textContent = "◷";

            turnBar.appendChild(clock);


            const turnProgress =
                document.createElement("div");

            turnProgress.className =
                "president-turn-mini-progress";


            turnBar.appendChild(
                turnProgress
            );

            info.appendChild(
                turnBar
            );
        }

        if (!isMe) {
            playerElement.appendChild(cardCount);
        }

        playerElement.appendChild(avatar);

        if (opponentCards) {
            playerElement.appendChild(opponentCards);
        }
        playerElement.appendChild(info);

        container.appendChild(
            playerElement
        );
    });
}

function renderPresidentCurrentPlay(state) {

    const container =
        document.getElementById(
            "current-play"
        );

    if (!container) {
        return;
    }


    container.innerHTML = "";


    state.current_play.forEach(card => {

        const element =
            document.createElement("div");

        element.className =
            "mini-card";

        element.textContent =
            presidentCardLabel(card);

        container.appendChild(element);

    });
}

function renderPresidentResults(state) {

    const results =
        document.getElementById(
            "results"
        );

    if (!results) {
        return;
    }


    if (!state.results.length) {

        results.innerHTML = "";

        return;

    }


    results.innerHTML =
        "<strong>Classement actuel :</strong> ";


    const text =
        state.results
            .map(
                result => {

                    const displayName =
                        result.username ||
                        `Joueur #${result.user_id}`;

                    return `#${result.position}: ${displayName}`;
                }
            )
            .join(" · ");


    results.appendChild(
        document.createTextNode(text)
    );
}

async function loadPresidentState() {

    if (presidentStateLoading) {
        return;
    }

    presidentStateLoading = true;

    try {

        const result = await api(
            `/api/games/president/${
                encodeURIComponent(roomCode)
            }`
        );

        if (!result.ok) {
            return;
        }

        if (!result.data.started) {

            await loadWaitingRoom();

            return;
        }

        renderPresidentState(
            result.data.state
        );

        if (result.data.state?.finished) {

            stopPresidentStatePolling();
        }

    } finally {

        presidentStateLoading = false;
    }
}

function startPresidentStatePolling() {

    if (presidentStateInterval) {
        return;
    }

    presidentStateInterval = setInterval(
        () => {
            loadPresidentState();
        },
        1000
    );
}

function stopPresidentStatePolling() {

    if (!presidentStateInterval) {
        return;
    }

    clearInterval(
        presidentStateInterval
    );

    presidentStateInterval = null;
}

async function startPresidentGame() {

    const result = await api(
        `/api/games/president/${
            encodeURIComponent(roomCode)
        }/start`,
        {
            method: "POST"
        }
    );


    if (!result.ok) {
        console.error(
            "Impossible de démarrer President",
            result
        );

        return;
    }


    selectedCards.clear();

    renderPresidentState(
        result.data.state
    );
}

async function playPresidentCards() {

    if (!selectedCards.size) {

        showToast(
            "Sélectionne au moins une carte."
        );

        return;

    }


    const result = await api(
        `/api/games/president/${
            encodeURIComponent(roomCode)
        }/play`,
        {
            method: "POST",

            body: {
                card_ids:
                    [...selectedCards]
            }
        }
    );


    if (!result.ok) {
            showToast(
                result.data?.error ||
                "Impossible de jouer."
            );

            await loadPresidentState();

            return;
        }


    selectedCards.clear();
    updatePresidentSelectedCount();

    //renderPresidentState(result.data.state);
}

async function passPresidentTurn() {

    const result = await api(
        `/api/games/president/${
            encodeURIComponent(roomCode)
        }/pass`,
        {
            method: "POST"
        }
    );

    if (!result.ok) {

        showToast(
            result.data?.error ||
            "Impossible de passer."
        );

        await loadPresidentState();

        return;
}


    selectedCards.clear();

    renderPresidentState(
        result.data.state
    );
}

function initPresidentGame() {

    document
        .getElementById("start-btn")
        ?.addEventListener(
            "click",
            startPresidentGame
        );


    document
        .getElementById("play-btn")
        ?.addEventListener(
            "click",
            playPresidentCards
        );


    document
        .getElementById("pass-btn")
        ?.addEventListener(
            "click",
            passPresidentTurn
        );


    loadPresidentState();
}