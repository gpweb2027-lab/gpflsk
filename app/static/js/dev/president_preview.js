const fakePlayers = [
    {
        id: 1,
        name: "pitchprime34",
        cards: 12,
        me: true,
        avatar: "/static/images/avatars/demo/avatar_01.png"
    },
    {
        id: 2,
        name: "Camila",
        cards: 8,
        avatar: "/static/images/avatars/demo/avatar_05.png"
    },
    {
        id: 3,
        name: "ssavp",
        cards: 8,
        avatar: "/static/images/avatars/demo/avatar_02.png"
    },
    {
        id: 4,
        name: "mati1814",
        cards: 7,
        avatar: "/static/images/avatars/demo/avatar_07.png"
    },
    {
        id: 5,
        name: "Jaiko15",
        cards: 8,
        avatar: "/static/images/avatars/demo/avatar_09.png"
    },
    {
        id: 6,
        name: "Kens29",
        cards: 9,
        avatar: "/static/images/avatars/demo/avatar_13.png"
    },
    {
        id: 7,
        name: "Thomas",
        cards: 11,
        avatar: "/static/images/avatars/demo/avatar_20.png"
    },
    {
        id: 8,
        name: "Sarah",
        cards: 6,
        avatar: "/static/images/avatars/demo/avatar_30.png"
    }
];

let playerCount = 6;
let currentPlayerId = 2;
let ownerId = 3;
let timerSeconds = 11;


const playersContainer =
    document.getElementById(
        "preview-players"
    );

const countButtons =
    document.getElementById(
        "player-count-buttons"
    );

const turnSelect =
    document.getElementById(
        "turn-player"
    );

const ownerSelect =
    document.getElementById(
        "owner-player"
    );

const timerRange =
    document.getElementById(
        "timer-range"
    );

const timerValue =
    document.getElementById(
        "timer-value"
    );


function createCountButtons() {

    countButtons.innerHTML = "";

    for (
        let count = 2;
        count <= 8;
        count++
    ) {

        const button =
            document.createElement(
                "button"
            );

        button.textContent = count;

        button.classList.toggle(
            "active",
            count === playerCount
        );

        button.addEventListener(
            "click",
            () => {

                playerCount = count;

                const visible =
                    fakePlayers.slice(
                        0,
                        playerCount
                    );

                if (
                    !visible.some(
                        player =>
                            player.id ===
                            currentPlayerId
                    )
                ) {
                    currentPlayerId =
                        visible[0].id;
                }

                if (
                    !visible.some(
                        player =>
                            player.id ===
                            ownerId
                    )
                ) {
                    ownerId =
                        visible[0].id;
                }

                render();
            }
        );

        countButtons.appendChild(
            button
        );
    }
}


function populateSelects(players) {

    turnSelect.innerHTML = "";
    ownerSelect.innerHTML = "";

    players.forEach(player => {

        const turnOption =
            document.createElement(
                "option"
            );

        turnOption.value = player.id;
        turnOption.textContent =
            player.name;

        turnOption.selected =
            player.id ===
            currentPlayerId;

        turnSelect.appendChild(
            turnOption
        );


        const ownerOption =
            document.createElement(
                "option"
            );

        ownerOption.value = player.id;
        ownerOption.textContent =
            player.name;

        ownerOption.selected =
            player.id === ownerId;

        ownerSelect.appendChild(
            ownerOption
        );
    });
}


/*
 * Le joueur local reste en bas.
 * Les autres sont répartis sur l'arc supérieur.
 */
 function getPlayerPosition(index, count) {

    /*
     * index 0 = joueur local
     *
     * Les positions suivantes sont définies
     * pour reproduire une table type Plato.
     */

    const layouts = {

        2: [
            { x: 50, y: 90 }, // moi
            { x: 50, y: 18 }
        ],

        3: [
            { x: 50, y: 90 },
            { x: 12, y: 25 },// Camila
            { x: 88, y: 25 }// ssavp
        ],

        4: [
            { x: 50, y: 90 },
            { x: 12, y: 45 },
            { x: 50, y: 18 },
            { x: 88, y: 45 }
        ],

        5: [
            { x: 50, y: 90 },

            { x: 12, y: 45 },// Camila
            { x: 50, y: 18 },// ssavp
            { x: 88, y: 25 },// mati1814
            { x: 88, y: 60 }// Jaiko15
        ],

        6: [
            { x: 50, y: 90 }, // pitchprime34

            { x: 12, y: 30 }, // Camila
            { x: 50, y: 18 }, // ssavp
            { x: 88, y: 30 }, // mati1814
            { x: 12, y: 60 }, // Jaiko15
            { x: 88, y: 60 }  // Kens29
        ],

        7: [
            { x: 50, y: 90 },// pitchprime34
            { x: 12, y: 30 },
            { x: 37, y: 18 },// ssavp
            { x: 63, y: 18 },// mati1814
            { x: 88, y: 30 },// Jaiko15
            { x: 12, y: 63 },// Kens29
            { x: 88, y: 62 }//thomas
        ],

        8: [
            { x: 50, y: 90 },

            { x: 12, y: 30 },// Camila
            { x: 28, y: 18 }, // ssavp
            { x: 50, y: 18 },// mati1814

            { x: 88, y: 30 },// Jaiko15

            { x: 12, y: 60 },
            { x: 88, y: 60 },
            { x: 72, y: 18 } // Sarah
        ]
    };


    const layout =
        layouts[count] || layouts[6];

    return layout[index];
}


function createHiddenCards() {

    const container =
        document.createElement("div");

    container.className =
        "hidden-cards";


    for (
        let index = 0;
        index < 4;
        index++
    ) {

        const card =
            document.createElement("img");

        card.className =
            "hidden-card";

        card.src =
            "/static/images/cards/carte_01/back.svg";

        card.alt =
            "Carte cachée";

        card.draggable =
            false;

        card.style.setProperty(
            "--i",
            index
        );

        container.appendChild(card);
    }


    return container;
}


function createPlayer(player,index,players) {

    const element =
        document.createElement("div");

    element.className =
        "preview-player";


    if (
        player.id ===
        currentPlayerId
    ) {
        element.classList.add(
            "current"
        );
    }


    const position =
        getPlayerPosition(
            index,
            players.length
        );


    element.style.left =
        `${position.x}%`;

    element.style.top =
        `${position.y}%`;

    /*
     * Détermine l'orientation des cartes
     * suivant la position du joueur.
     */

    /* Joueurs placés sur la rangée du haut */
    if (position.y <= 20 && !player.me) {

        element.classList.add(
            "player-center",
            "player-top"
        );

    /* Joueurs sur le côté gauche */
    } else if (position.x < 50) {

        element.classList.add(
            "player-left"
        );

    /* Joueurs sur le côté droit */
    } else if (position.x > 50) {

        element.classList.add(
            "player-right"
        );

    /* Joueur local / centre */
    } else {

        element.classList.add(
            "player-center"
        );
    }

    const count =
        document.createElement("div");

    count.className = "preview-card-count";

    count.textContent = player.cards;

    const avatar =
        document.createElement("div");

    avatar.className =
        "preview-avatar";


    const avatarImage =
        document.createElement("img");

    avatarImage.src =
        player.avatar;

    avatarImage.alt =
        `Avatar de ${player.name}`;

    avatarImage.draggable =
        false;


    avatar.appendChild(
        avatarImage
    );

    const nameRow =
        document.createElement("div");

    nameRow.className =
        "preview-name-row";


    const name =
        document.createElement("span");

    name.textContent =
        player.me
            ? `${player.name} (toi)`
            : player.name;


    const presence =
        document.createElement("span");

    presence.className =
        "presence";

    if (player.id === ownerId) {

        const crown =
            document.createElement(
                "span"
            );

        crown.className = "owner";
        crown.textContent = "👑";

        nameRow.appendChild(crown);
    }


    const audio =
        document.createElement(
            "button"
        );

    audio.className =
        "audio-button";

    audio.textContent =
        player.me
            ? "🎤"
            : "🔊";


    audio.addEventListener(
        "click",
        () => {

            const muted =
                audio.dataset.muted ===
                "true";

            audio.dataset.muted =
                muted
                    ? "false"
                    : "true";

            audio.textContent =
                muted
                    ? (
                        player.me
                            ? "🎤"
                            : "🔊"
                    )
                    : "🔇";
        }
    );

    nameRow.appendChild(presence);
    nameRow.appendChild(name);
    nameRow.appendChild(audio);



    if (!player.me) {
        element.appendChild(
            createHiddenCards()
        );
    }


     let timer = null;

if (player.id === currentPlayerId) {

    timer =
        document.createElement("div");

    timer.className =
        "turn-timer";

    const progress =
        document.createElement("div");

    progress.className =
        "turn-progress";

    progress.style.width =
        `${(timerSeconds / 15) * 100}%`;

    timer.appendChild(progress);
}


/*
 * JOUEUR LOCAL
 */
if (player.me) {
    //element.appendChild(count);
    element.classList.add("is-me");

    element.appendChild(avatar);

    // nom sous l'avatar
    element.appendChild(nameRow);

    // timer sous le nom
    if (timer) {
        element.appendChild(timer);
    }

    // nombre de cartes déplacé au-dessus de la main



/*
 * ADVERSAIRES
 */
} else {
    if (timer) {
        element.appendChild(timer);
    }
    element.appendChild(nameRow);
    element.appendChild(avatar);
   // element.appendChild(count);
    if (!player.me) {
        element.appendChild(count);
    }


}

    return element;
}

function renderPlayers(players) {

    playersContainer.innerHTML = "";

    players.forEach(
        (player, index) => {

            playersContainer.appendChild(
                createPlayer(
                    player,
                    index,
                    players
                )
            );
        }
    );
}


function render() {

    const players =
        fakePlayers.slice(
            0,
            playerCount
        );

    createCountButtons();

    populateSelects(players);

    renderPlayers(players);


    /*
     * Nombre de cartes du joueur local
     * affiché juste au-dessus de sa main.
     */
    const localPlayer =
        players.find(
            player => player.me
        );

    const hand =
        document.querySelector(
            ".hand-cards"
        );

    if (localPlayer && hand) {

        let localCount =
            document.querySelector(
                ".local-hand-count"
            );

        if (!localCount) {

            localCount =
                document.createElement(
                    "div"
                );

            localCount.className =
                "local-hand-count";

            hand.parentNode.insertBefore(
                localCount,
                hand
            );
        }

        localCount.textContent =
            localPlayer.cards;
    }


    timerValue.textContent =
        `${timerSeconds}s`;
}


turnSelect.addEventListener(
    "change",
    () => {

        currentPlayerId =
            Number(
                turnSelect.value
            );

        render();
    }
);


ownerSelect.addEventListener(
    "change",
    () => {

        ownerId =
            Number(
                ownerSelect.value
            );

        render();
    }
);


timerRange.addEventListener(
    "input",
    () => {

        timerSeconds =
            Number(
                timerRange.value
            );

        render();
    }
);

function updateHandLayout() {

    const hand =
        document.querySelector(
            ".hand-cards"
        );

    if (!hand) {
        return;
    }

    const cards =
        hand.querySelectorAll(
            ".preview-card-image"
        );

    hand.classList.toggle(
        "two-rows",
        cards.length > 14
    );
}

updateHandLayout();
render();