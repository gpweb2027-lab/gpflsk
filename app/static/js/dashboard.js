async function createPresidentRoom() {

    const result = await api(
        "/api/rooms",
        {
            method: "POST",

            body: {
                game_type: "PRESIDENT",
                max_players: 8
            }
        }
    );

    if (!result.ok) {
        return;
    }

    const room = result.data.room;

    if (!room || !room.code) {
        showToast(
            "Impossible de récupérer le salon créé."
        );
        return;
    }

    location.href =
        `/room/${encodeURIComponent(room.code)}`;
}

async function joinRoom(roomCode) {

    if (!roomCode) {
        return;
    }

    const result = await api(
        `/api/rooms/${encodeURIComponent(roomCode)}/join`,
        {
            method: "POST",

            body: {
                role: "PLAYER"
            }
        }
    );

    if (!result.ok) {
        return;
    }

    location.href =
        `/room/${encodeURIComponent(roomCode)}`;
}

async function loadPublicRooms() {
    const container =
        document.getElementById(
            "public-rooms-list"
        );

    if (!container) {
        return;
    }


    const result = await api(
        "/api/rooms",
        {
            method: "GET"
        }
    );


    if (!result.ok) {

        container.innerHTML = `
            <div class="empty-room">
                Impossible de charger les salons.
            </div>
        `;

        return;
    }


    const rooms =
        result.data.rooms || [];


    /*
     * Pour l'instant on affiche President uniquement,
     * puisque c'est le jeu que nous connectons réellement.
     */
    const presidentRooms =
        rooms.filter(room =>
            room.game_type === "PRESIDENT" &&
            room.status === "WAITING"
        );


    if (presidentRooms.length === 0) {

        container.innerHTML = `
            <div class="empty-room">
                <span>🎮</span>

                <div>
                    <strong>Aucun salon</strong>
                    <small>
                        Crée la première partie !
                    </small>
                </div>
            </div>
        `;

        return;
    }


    container.innerHTML =
        presidentRooms
            .slice(0, 5)
            .map(room => {

                const code =
                    escapeHtml(room.code);

                return `
                    <div class="public-room">

                        <div class="room-icon">
                            👑
                        </div>

                        <div class="room-details">

                            <strong>
                                President
                            </strong>

                            <small>
                                Salon ${code}
                            </small>

                        </div>

                        <button
                            class="room-join-btn"
                            data-room-code="${code}">
                            Rejoindre
                        </button>

                    </div>
                `;

            })
            .join("");


    container
        .querySelectorAll(
            "[data-room-code]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    joinRoom(
                        button.dataset.roomCode
                    );

                }
            );

        });
}

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const token =
            localStorage.getItem(
                "access_token"
            );

        const userData =
            localStorage.getItem(
                "user"
            );


        if (!token || !userData) {

            location.href =
                "/login";

            return;
        }


        /*
         * Affichage du vrai utilisateur.
         */

        try {

            const user =
                JSON.parse(userData);

            const username =
                document.getElementById(
                    "current-username"
                );

            if (
                username &&
                (user.pseudo || user.username)
            ) {

                username.textContent =
                    (user.pseudo || user.username);

            }

        } catch (error) {

            localStorage.removeItem(
                "access_token"
            );

            localStorage.removeItem(
                "user"
            );

            location.href =
                "/login";

            return;
        }


        /*
         * Chargement des vraies rooms.
         */

        loadPublicRooms();

          // Mise à jour automatique des salons
        setInterval(() => {
            loadPublicRooms();
        }, 5000);

    }
);

async function loadAcceptedFriends() {
    const list = document.getElementById("accepted-friends-list");

    if (!list) return;

    list.textContent = "Chargement des amis...";

    try {
        const response = await fetch("/api/users/friends", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${localStorage.getItem("access_token")}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            list.textContent = data.error || "Impossible de charger les amis.";
            return;
        }

        const friends = data.friends || [];

        if (friends.length === 0) {
            list.textContent = "Tu n'as pas encore d'amis.";
            return;
        }

        list.replaceChildren();

        friends.forEach(friend => {
            const row = document.createElement("div");
            row.className = "friend-request-item";

            const avatar = document.createElement("div");
            avatar.className = "friend-request-avatar";

            if (friend.avatar_url) {
                const img = document.createElement("img");
                img.src = friend.avatar_url;
                img.alt = "Avatar de " + (friend.pseudo || friend.username);
                img.onerror = () => {
                    avatar.textContent = "👤";
                };
                avatar.appendChild(img);
            } else {
                avatar.textContent = "👤";
            }

            const username = document.createElement("strong");
            username.textContent = (friend.pseudo || friend.username);

            row.appendChild(avatar);
            row.appendChild(username);

            list.appendChild(row);
        });

    } catch (error) {
        list.textContent = "Erreur de connexion.";
    }
}

function initFriendsModal() {
    const modal = document.getElementById("friends-modal");
    const close = document.getElementById("friends-modal-close");

    const buttons = [
        document.getElementById("friends-nav-btn"),
        document.getElementById("friends-sidebar-btn"),
        document.getElementById("friends-see-all")
    ];

    if (!modal || !close) return;

    async function loadFriendRequests() {
        const list = document.getElementById("friend-requests-list");

        if (!list) return;

        list.textContent = "Chargement des demandes...";

        try {
            const response = await fetch("/api/users/friends/requests", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("access_token")}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                list.textContent = data.error || "Impossible de charger les demandes.";
                return;
            }

            const requests = data.requests || [];

            if (requests.length === 0) {
                list.textContent = "Aucune demande d'ami en attente.";
                return;
            }

            list.replaceChildren();

            requests.forEach(friendRequest => {
                const row = document.createElement("div");
                row.className = "friend-request-item";

                const avatar = document.createElement("div");
                avatar.className = "friend-request-avatar";

                if (friendRequest.avatar_url) {
                    const img = document.createElement("img");
                    img.src = friendRequest.avatar_url;
                    img.alt = "Avatar";
                    avatar.appendChild(img);
                } else {
                    avatar.textContent = "👤";
                }

                const username = document.createElement("strong");
                username.textContent = (friendRequest.pseudo || friendRequest.username);

                 // Ouvrir le profil de l'expéditeur sans accepter la demande.
                const openRequesterProfile = () => {
                    const playerId = Number(friendRequest.sender_id);
                    if (!Number.isInteger(playerId) || playerId <= 0) return;
                    if (typeof window.openFullPlayerProfile === "function") {
                        window.openFullPlayerProfile(playerId);
                    } else if (typeof showToast === "function") {
                        showToast("Le profil du joueur n'est pas disponible.");
                    }
                };
                avatar.dataset.friendId = String(friendRequest.sender_id);
                avatar.setAttribute("role", "button");
                avatar.setAttribute("tabindex", "0");
                avatar.setAttribute("aria-label", "Voir le profil de " + username.textContent);
                avatar.style.cursor = "pointer";
                avatar.addEventListener("click", openRequesterProfile);
                avatar.addEventListener("keydown", event => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openRequesterProfile();
                    }
                });
                username.setAttribute("role", "button");
                username.setAttribute("tabindex", "0");
                username.style.cursor = "pointer";
                username.addEventListener("click", openRequesterProfile);
                username.addEventListener("keydown", event => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openRequesterProfile();
                    }
                });

                const info = document.createElement("div");
                info.className = "friend-request-info";
                info.appendChild(username);

                const actions = document.createElement("div");
                actions.className = "friend-request-actions";

                const acceptButton = document.createElement("button");
                acceptButton.type = "button";
                acceptButton.className = "friend-request-accept";
                acceptButton.textContent = "✓ Accepter";

                const rejectButton = document.createElement("button");
                rejectButton.type = "button";
                rejectButton.className = "friend-request-reject";
                rejectButton.textContent = "✕ Refuser";

                async function respondToFriendRequest(action) {
                    acceptButton.disabled = true;
                    rejectButton.disabled = true;

                    try {
                        const response = await fetch(
                            `/api/users/friends/requests/${friendRequest.id}/respond`,
                            {
                                method: "POST",
                                headers: {
                                    "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ action })
                            }
                        );

                        const data = await response.json();

                        if (!response.ok) {
                            throw new Error(data.error || "Impossible de traiter la demande.");
                        }

                        if (typeof showToast === "function") {
                            showToast(data.message);
                        }

                        await loadFriendRequests();

                    } catch (error) {
                        acceptButton.disabled = false;
                        rejectButton.disabled = false;

                        if (typeof showToast === "function") {
                            showToast(error.message);
                        } else {
                            alert(error.message);
                        }
                    }
                }

                acceptButton.addEventListener("click", () => {
                    respondToFriendRequest("accept");
                });

                rejectButton.addEventListener("click", () => {
                    respondToFriendRequest("reject");
                });

                actions.appendChild(acceptButton);
                actions.appendChild(rejectButton);

                info.appendChild(actions);

                row.appendChild(avatar);
                row.appendChild(info);

                list.appendChild(row);
            });

        } catch (error) {
            list.textContent = "Erreur de connexion.";
        }
    }
    window.refreshFriendRequests = loadFriendRequests;
    async function openModal(event) {
        event.preventDefault();

        modal.hidden = false;
        close.focus();

        await loadFriendRequests();
        await loadAcceptedFriends();
    }

    function closeModal() {
        modal.hidden = true;
    }

    buttons.forEach(button => {
        button?.addEventListener("click", openModal);
    });

    close.addEventListener("click", closeModal);

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !modal.hidden) {
            closeModal();
        }
    });
}

document.addEventListener("DOMContentLoaded", initFriendsModal);

async function loadDashboardFriends() {
    const list = document.getElementById("dashboard-friends-list");
    const count = document.getElementById("friends-count");

    if (!list || !count) return;

    try {
        const response = await fetch("/api/users/friends", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${localStorage.getItem("access_token")}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            list.textContent = "Impossible de charger les amis.";
            return;
        }

        const friends = data.friends || [];

        count.textContent = friends.length;
        list.replaceChildren();

        if (friends.length === 0) {
            list.textContent = "Tu n'as pas encore d'amis.";
            return;
        }

        friends.forEach(friend => {
            const row = document.createElement("div");
            row.className = "friend";

            const avatar = document.createElement("div");
            avatar.className = "friend-avatar";

            avatar.dataset.friendId = String(friend.id);
            avatar.style.position = "relative";

            const unreadBadge = document.createElement("span");
            unreadBadge.className = "friend-avatar-unread";
            unreadBadge.hidden = true;

            avatar.appendChild(unreadBadge);

            if (friend.avatar_url) {
                const img = document.createElement("img");
                img.src = friend.avatar_url;
                img.alt = "Avatar de " + (friend.pseudo || friend.username);
                img.style.width = "100%";
                img.style.height = "100%";
                img.style.objectFit = "cover";
                img.style.borderRadius = "50%";

                img.onerror = () => {
                    img.remove();
                    avatar.appendChild(document.createTextNode("👤"));
                };

                avatar.appendChild(img);
            } else {
                avatar.appendChild(document.createTextNode("👤"));
            }

            const info = document.createElement("div");
            info.className = "friend-info";

            const username = document.createElement("strong");
            username.textContent = (friend.pseudo || friend.username);

            // Pastille de connexion devant le pseudo
            const statusDot = document.createElement("span");
            statusDot.className = friend.is_online
                ? "friend-status-dot online"
                : "friend-status-dot offline";

            statusDot.title = friend.is_online
                ? "En ligne"
                : "Hors ligne";

            info.appendChild(statusDot);
            info.appendChild(username);

            const messageButton = document.createElement("button");
            messageButton.type = "button";
            messageButton.className = "friend-message-btn";
            messageButton.textContent = "💬 Message";

            messageButton.addEventListener("click", () => {
                openPrivateChat(friend);
            });

            row.appendChild(avatar);
            row.appendChild(info);
            row.appendChild(messageButton);

            list.appendChild(row);
        });

    } catch (error) {
        list.textContent = "Erreur de connexion.";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadDashboardFriends();

    // Actualiser les statuts toutes les 5 secondes.
    setInterval(loadDashboardFriends, 5000);
});

// Présentation commune des messages privés (ouverture, rafraîchissement, envoi).
function createStyledPrivateMessage(message, friend) {
    const currentUser = JSON.parse(localStorage.getItem("user") || "null");
    const mine = Number(message.sender_id) === Number(currentUser?.id);
    const row = document.createElement("div");
    row.className = "private-chat-row " + (mine ? "is-mine" : "is-received");

    const avatar = document.createElement("button");
    avatar.type = "button";
    avatar.className = "private-chat-avatar";
    avatar.title = "Voir le profil";
    avatar.addEventListener("click", () => {
        const id = mine ? currentUser?.id : friend?.id;
        if (id && typeof window.openFullPlayerProfile === "function") window.openFullPlayerProfile(id);
    });
    const avatarUrl = mine ? currentUser?.avatar_url : friend?.avatar_url;
    if (avatarUrl) {
        const image = document.createElement("img");
        image.src = avatarUrl;
        image.alt = "";
        image.onerror = () => { image.remove(); avatar.textContent = "👤"; };
        avatar.appendChild(image);
    } else {
        avatar.textContent = "👤";
    }

    const content = document.createElement("div");
    content.className = "private-chat-content";
    const meta = document.createElement("div");
    meta.className = "private-chat-meta";
    const name = document.createElement("strong");
    name.textContent = mine ? ((currentUser?.pseudo || currentUser?.username) || "Vous") : (friend?.pseudo || friend?.username || "Joueur");
    name.classList.add("chat-profile-link");
    name.addEventListener("click", () => {
        const id = mine ? currentUser?.id : friend?.id;
        if (id && typeof window.openFullPlayerProfile === "function") window.openFullPlayerProfile(id);
    });
    meta.appendChild(name);

    if (message.created_at) {
        const date = new Date(message.created_at);
        if (!Number.isNaN(date.getTime())) {
            const time = document.createElement("time");
            time.dateTime = message.created_at;
            time.textContent = date.toLocaleTimeString("en-US", {hour:"2-digit", minute:"2-digit", hour12:true});
            meta.appendChild(time);
        }
    }

    const bubble = document.createElement("div");
    bubble.className = "private-message " +
        (mine ? "private-message-mine" : "private-message-received");
    bubble.textContent = message.content || "";
    content.append(meta, bubble);
    if (mine) row.append(content, avatar);
    else row.append(avatar, content);
    window.ChatCommon?.decorate(row, "private", message, mine, bubble);
    return row;
}

function privateChatDayLabel(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    }).format(date).toLocaleUpperCase("fr-FR");
}
function renderPrivateConversation(container, conversation, friend) {
    container.replaceChildren();
    if (!conversation.length) {
        container.textContent = "Aucun message pour le moment.";
        return;
    }
    let lastDay = null;
    conversation.forEach(message => {
        const date = message.created_at ? new Date(message.created_at) : null;
        const dayKey = date && !Number.isNaN(date.getTime())
            ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : null;
        if (dayKey && dayKey !== lastDay) {
            const separator = document.createElement("div");
            separator.className = "private-chat-date-separator";
            const label = document.createElement("span");
            label.textContent = privateChatDayLabel(message.created_at);
            separator.appendChild(label);
            container.appendChild(separator);
        }
        lastDay = dayKey;
        container.appendChild(createStyledPrivateMessage(message, friend));
    });
}
function setupPrivateChatHeader(friend) {
    const modal = document.getElementById("private-chat-modal");
    const title = document.getElementById("private-chat-title");
    if (!modal || !title) return;
    const header = title.closest(".private-chat-header");
    if (!header) return;
    title.replaceChildren();
    const profile = document.createElement("button");
    profile.type = "button";
    profile.className = "chat-header-profile";
    profile.title = "Voir le profil de " + (friend.pseudo || friend.username);
    profile.addEventListener("click", () => {
        if (typeof window.openFullPlayerProfile === "function") window.openFullPlayerProfile(friend.id);
    });
    const avatar = document.createElement("span");
    avatar.className = "chat-header-avatar";
    if (friend.avatar_url) {
        const img = document.createElement("img");
        img.src = friend.avatar_url;
        img.alt = "";
        img.onerror = () => { img.remove(); avatar.textContent = "👤"; };
        avatar.appendChild(img);
    } else avatar.textContent = "👤";
    const labels = document.createElement("span");
    labels.className = "chat-header-labels";
    const name = document.createElement("strong");
    name.textContent = (friend.pseudo || friend.username) || "Joueur";
    const subtitle = document.createElement("small");
    const dot = document.createElement("span");
    dot.className = "chat-presence-dot " + (friend.is_online ? "online" : "offline");
    subtitle.append(dot, document.createTextNode(friend.is_online ? " En ligne" : " Hors ligne"));
    const lastSeen = document.createElement("small");
    lastSeen.className = "chat-last-seen";
    const lastSeenDate = friend.last_seen_at ? new Date(friend.last_seen_at) : null;
    lastSeen.textContent = friend.is_online
        ? "Connecté actuellement"
        : lastSeenDate && !Number.isNaN(lastSeenDate.getTime())
            ? "Dernière connexion : " + lastSeenDate.toLocaleString("fr-FR")
            : "Dernière connexion non enregistrée";
    labels.append(name, subtitle, lastSeen);
    profile.append(avatar, labels);
    title.appendChild(profile);

    // Retour placé à gauche de l'avatar, hors du bouton profil.
    let backButton = title.querySelector('.private-chat-back');
    if (!backButton) {
        backButton = document.createElement('button');
        backButton.type = 'button';
        backButton.className = 'private-chat-back';
        backButton.textContent = '←';
        backButton.title = 'Retour aux amis';
        backButton.setAttribute('aria-label', 'Retour aux amis');
        backButton.addEventListener('click', event => {
            event.stopPropagation();
            document.getElementById('private-chat-close')?.click();
        });
    }
    title.prepend(backButton);

    let menuButton = header.querySelector(".chat-more-button");
    if (!menuButton) {
        menuButton = document.createElement("button");
        menuButton.type = "button";
        menuButton.className = "chat-more-button";
        menuButton.textContent = "⋮";
        menuButton.setAttribute("aria-label", "Options de conversation");
        const menu = document.createElement("div");
        menu.className = "chat-more-menu";
        menu.hidden = true;
        const stats = document.createElement("button");
        stats.type = "button";
        stats.textContent = "Voir le profil et les statistiques";
        stats.addEventListener("click", () => {
            menu.hidden = true;
            const id = Number(modal.dataset.friendId);
            if (id && typeof window.openFullPlayerProfile === "function") window.openFullPlayerProfile(id);
        });
        const block = document.createElement("button");
        block.type = "button";
        block.textContent = "Bloquer les messages (bientôt)";
        block.disabled = true;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Supprimer l'amitié (bientôt)";
        remove.disabled = true;
        menu.append(stats, block, remove);
        menuButton.addEventListener("click", () => { menu.hidden = !menu.hidden; });
        const wrap = document.createElement("div");
        wrap.className = "chat-more-wrap";
        wrap.append(menuButton, menu);
        header.insertBefore(wrap, document.getElementById("private-chat-close"));
    } else {
        const menu = header.querySelector(".chat-more-menu");
        if (menu) menu.hidden = true;
    }
    const send = document.querySelector("#private-chat-form button[type='submit']");
    if (send) {
        send.textContent = "➤";
        send.setAttribute("aria-label", "Envoyer le message");
        send.title = "Envoyer";
        send.classList.add("chat-send-arrow");
    }
}

function getOpenChatFriend() {
    const modal = document.getElementById("private-chat-modal");
    return {
        id: Number(modal?.dataset.friendId),
        username: modal?.dataset.friendName || "Joueur",
        pseudo: modal?.dataset.friendName || "Joueur",
        avatar_url: modal?.dataset.friendAvatar || ""
    };
}

async function openPrivateChat(friend) {
    const modal = document.getElementById("private-chat-modal");
    const title = document.getElementById("private-chat-title");
    const messages = document.getElementById("private-chat-messages");
    const input = document.getElementById("private-chat-input");

    if (!modal || !title || !messages || !input) return;

    // Recharger la présence depuis l'API plutôt que depuis une ancienne liste.
    try {
        const presenceResponse = await fetch('/api/users/friends', {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
            cache: 'no-store'
        });
        if (presenceResponse.ok) {
            const presenceData = await presenceResponse.json();
            const currentFriend = (presenceData.friends || []).find(f => Number(f.id) === Number(friend.id));
            if (currentFriend) friend = { ...friend, ...currentFriend };
        }
    } catch (error) { console.warn('Présence indisponible', error); }
    setupPrivateChatHeader(friend);
    modal.dataset.friendId = String(friend.id);
    modal.dataset.friendName = (friend.pseudo || friend.username) || "Joueur";
    modal.dataset.friendAvatar = friend.avatar_url || "";
    delete messages.dataset.signature;

    modal.hidden = false;
    messages.textContent = "Chargement des messages...";

    // Ne pas sélectionner le champ à l'ouverture, même si le HTML a autofocus.
    input.removeAttribute('autofocus');
    if (document.activeElement === input) input.blur();
    requestAnimationFrame(() => {
        if (!modal.hidden && document.activeElement === input) input.blur();
    });

    try {
        const response = await fetch(
            `/api/users/messages/${friend.id}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("access_token")}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Impossible de charger les messages."
            );
        }

        // Éviter d'afficher une ancienne conversation
        // si le joueur a changé d'ami entre-temps.
        if (modal.hidden || modal.dataset.friendId !== String(friend.id)) {
            return;
        }

        const conversation = data.messages || [];
        renderPrivateConversation(messages, conversation, friend);
        messages.dataset.signature = JSON.stringify(conversation.map(message => message.id));

        messages.scrollTop = messages.scrollHeight;

    } catch (error) {
        if (!modal.hidden && modal.dataset.friendId === String(friend.id)) {
            messages.textContent = error.message;
        }
    }
}

async function loadUnreadMessagesCount() {
    const badge = document.getElementById("messages-unread-count");

    if (!badge) return;

    try {
        const response = await fetch("/api/users/messages/unread", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${localStorage.getItem("access_token")}`
            }
        });

        if (!response.ok) {
            throw new Error("Impossible de récupérer les messages non lus.");
        }

        const data = await response.json();
        const count = Number(data.unread_count) || 0;

        badge.textContent = count > 99 ? "99+" : String(count);
        badge.hidden = count === 0;

        // Compteurs individuels sur les avatars des amis.
        const unreadBySender = data.unread_by_sender || {};

        document.querySelectorAll(".friend-avatar[data-friend-id]").forEach(avatar => {
            const friendId = avatar.dataset.friendId;
            const friendCount = Number(unreadBySender[friendId]) || 0;

            const friendBadge = avatar.querySelector(".friend-avatar-unread");

            if (!friendBadge) return;

            friendBadge.textContent =
                friendCount > 99 ? "99+" : String(friendCount);

            friendBadge.hidden = friendCount === 0;
        });

    } catch (error) {
        console.error("Erreur notifications :", error);
        badge.hidden = true;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Charger les notifications dès l'ouverture du tableau de bord.
    loadUnreadMessagesCount();

    // Vérifier automatiquement les nouveaux messages toutes les 3 secondes.
    setInterval(() => {
        loadUnreadMessagesCount();
    }, 3000);
});

document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("private-chat-modal");
    const close = document.getElementById("private-chat-close");
    const form = document.getElementById("private-chat-form");

    if (!modal || !close || !form) return;

    function closePrivateChat() {
        modal.hidden = true;
    }

    close.addEventListener("click", closePrivateChat);

    modal.addEventListener("click", event => {
        if (event.target === modal) closePrivateChat();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !modal.hidden) {
            closePrivateChat();
        }
    });

    form.addEventListener("submit", async event => {
    event.preventDefault();

        const input = document.getElementById("private-chat-input");
        const messages = document.getElementById("private-chat-messages");
        const friendId = Number(modal.dataset.friendId);
        const content = input.value.trim();

        if (!content || !Number.isInteger(friendId) || friendId <= 0) {
            return;
        }

        const sendButton = form.querySelector('button[type="submit"]');

        sendButton.disabled = true;

        try {
            const response = await fetch(
                `/api/users/messages/${friendId}`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ content, reply_to_id: window.ChatCommon?.replyId("private") })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Impossible d'envoyer le message.");
            }

            input.value = "";
            window.ChatCommon?.clearReply("private");

            const currentUser = JSON.parse(localStorage.getItem("user") || "null");
            const sentMessage = data.private_message || {
                content,
                sender_id: currentUser?.id,
                created_at: new Date().toISOString()
            };
            // Recharger les séparateurs et les heures sans perdre l'envoi immédiat.
            messages.appendChild(createStyledPrivateMessage(sentMessage, getOpenChatFriend()));
            // La prochaine synchronisation récupère le message et son vrai ID.
            delete messages.dataset.signature;
            messages.scrollTop = messages.scrollHeight;

            if (typeof showToast === "function") {
                showToast("Message envoyé !");
            }

        } catch (error) {
            if (typeof showToast === "function") {
                showToast(error.message);
            } else {
                alert(error.message);
            }
        } finally {
            sendButton.disabled = false;
        }
    });
});

async function refreshPrivateChat() {
    const modal = document.getElementById("private-chat-modal");
    const messages = document.getElementById("private-chat-messages");

    if (!modal || modal.hidden || !messages) return;

    const friendId = Number(modal.dataset.friendId);

    if (!Number.isInteger(friendId) || friendId <= 0) return;

    try {
        const response = await fetch(
            `/api/users/messages/${friendId}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("access_token")}`
                }
            }
        );

        if (!response.ok) return;

        const data = await response.json();

        // Ne pas afficher les messages d'une autre conversation.
        if (modal.hidden || Number(modal.dataset.friendId) !== friendId) {
            return;
        }

        const conversation = data.messages || [];
        const currentUser = JSON.parse(
            localStorage.getItem("user") || "null"
        );

        // Éviter de reconstruire la conversation si rien n'a changé.
        const signature = JSON.stringify(
            conversation.map(message => message.id)
        );

        if (messages.dataset.signature === signature) return;

        const wasNearBottom =
            messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;

        renderPrivateConversation(messages, conversation, getOpenChatFriend());

        messages.dataset.signature = signature;

        if (wasNearBottom) {
            messages.scrollTop = messages.scrollHeight;
        }

        // Actualiser le compteur après lecture des messages.
        loadUnreadMessagesCount();

    } catch (error) {
        console.error("Synchronisation du chat :", error);
    }
}
document.addEventListener("DOMContentLoaded", () => {
    setInterval(refreshPrivateChat, 2000);
});

// Connexion Socket.IO du tableau de bord.
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("access_token");

    if (!token || typeof io === "undefined") {
        return;
    }

    const dashboardSocket = io({
        auth: {
            token: token
        }
    });

    dashboardSocket.on("connect", () => {
        console.log("Dashboard Socket.IO connecté !");
    });

    dashboardSocket.on("disconnect", () => {
        console.log("Dashboard Socket.IO déconnecté.");
    });

    dashboardSocket.on("connect_error", error => {
        console.error("Erreur Socket.IO dashboard :", error.message);
     });
});
document.addEventListener('DOMContentLoaded',()=>{
  const name=document.getElementById('current-username');
  const open=()=>{try{window.openFullPlayerProfile(JSON.parse(localStorage.getItem('user')).id);}catch{}};
  name?.addEventListener('click',open);
  name?.addEventListener('keydown',e=>{if(e.key==='Enter')open();});
  document.addEventListener('click',e=>{const avatar=e.target.closest('.friend-avatar[data-friend-id],.friend-request-avatar');if(avatar?.dataset.friendId)window.openFullPlayerProfile(avatar.dataset.friendId);});
});
document.addEventListener('DOMContentLoaded',()=>{
  const avatar=document.getElementById('header-avatar-btn');
  avatar?.addEventListener('click',e=>{
    if(window.__profileAvatarEditOnce){window.__profileAvatarEditOnce=false;return;}
    e.stopImmediatePropagation();
    try{window.openFullPlayerProfile(JSON.parse(localStorage.getItem('user')).id);}catch{}
  },true);
});

// Indicateur de demandes d'amis reçues (sans toucher aux messages privés).
document.addEventListener("DOMContentLoaded", () => {
    const trigger = document.getElementById("friends-see-all");
    if (!trigger) return;
    const indicator = document.createElement("span");
    indicator.id = "friend-requests-indicator";
    indicator.hidden = true;
    indicator.setAttribute("role", "status");
    indicator.style.cssText = "margin-left:8px;padding:3px 7px;border-radius:12px;background:#7543ff;color:white;font-size:11px;font-weight:700";
    trigger.insertAdjacentElement("afterend", indicator);

    async function refreshPendingRequests() {
        if (document.hidden || !localStorage.getItem("access_token")) return;
        try {
            const result = typeof api === "function"
                ? await api("/api/users/friends/requests", {method:"GET"})
                : null;
            if (!result || !result.ok) return;
            const count = (result.data.requests || []).length;
            indicator.textContent = count > 99 ? "99+" : String(count);
            indicator.hidden = count === 0;
            trigger.title = count ? `${count} demande(s) d'amis en attente` : "Voir tous les amis";
        } catch (error) { console.warn("Demandes d'amis :", error); }
    }
    refreshPendingRequests();
    setInterval(refreshPendingRequests, 10000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshPendingRequests(); });
});
// Sur mobile, l'activité rejoint l'accueil, après les langues et avant la bannière.
// Le même noeud DOM est réutilisé : pas de duplication d'API ni de listeners.
document.addEventListener("DOMContentLoaded", () => {
    const buttons = [...document.querySelectorAll("[data-mobile-view]")];
    const tabs = [...document.querySelectorAll("[data-social-tab]")];
    const sidebar = document.querySelector(".app-layout > .activity-sidebar");
    const slot = document.getElementById("mobile-activity-slot");
    const layout = document.querySelector(".app-layout");
    const mobile = window.matchMedia("(max-width: 760px)");
    const brand = document.querySelector(".lobby-topbar .lobby-brand");

    function updateBrand() {
        if (!brand) return;
        const isPeople = mobile.matches && document.body.dataset.mobileView === "social";
        brand.textContent = isPeople ? "Personnes" : "Game Platform";
        brand.setAttribute("aria-label", isPeople ? "Personnes, retour à l’accueil" : "Game Platform, accueil");
    }

    function placeActivity() {
        if (!sidebar || !slot || !layout) return;
        if (mobile.matches) {
            if (sidebar.parentElement !== slot) slot.appendChild(sidebar);
        } else if (sidebar.parentElement !== layout) {
            layout.insertBefore(sidebar, layout.firstElementChild);
        }
    }

    function showView(view) {
        const selected = view === "social" ? "social" : "home";
        document.body.dataset.mobileView = selected;
        buttons.forEach(button => {
            const active = button.dataset.mobileView === selected;
            button.classList.toggle("is-active", active);
            if (active) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });
        updateBrand();
        window.scrollTo({top: 0, behavior: "instant"});
    }

    function showSocialTab(tab) {
        const selected = tab === "groups" ? "groups" : "friends";
        document.body.dataset.socialTab = selected;
        tabs.forEach(button => button.setAttribute("aria-selected", String(button.dataset.socialTab === selected)));
    }

    buttons.forEach(button => button.addEventListener("click", () => showView(button.dataset.mobileView)));
    tabs.forEach(button => button.addEventListener("click", () => showSocialTab(button.dataset.socialTab)));
    mobile.addEventListener("change", () => { placeActivity(); updateBrand(); });
    placeActivity();
    showSocialTab("friends");
    showView("home");
});



// Synchronisation immédiate de l'avatar personnel après changement dans le profil.
// N'affecte pas les avatars des amis.
window.addEventListener('profile-avatar-updated', (event) => {
    const url = event.detail?.avatar_url;
    if (typeof url !== 'string' || !url.startsWith('/static/')) return;

    const header = document.getElementById('header-avatar-btn');
    if (header) {
        let img = header.matches('img') ? header : header.querySelector('img');
        if (!img) {
            img = document.createElement('img');
            img.alt = 'Mon avatar';
            header.replaceChildren(img);
        }
        img.src = url;
    }

    // Les conversations ouvertes peuvent déjà contenir des messages du joueur.
    // On ne modifie que leurs avatars, identifiés par is-mine.
    document.querySelectorAll('.private-chat-row.is-mine .private-chat-avatar img')
        .forEach(img => { img.src = url; });
});


// Pont public pour la règle 3 du profil : réutilise la messagerie privée existante.
window.openPrivateChat = openPrivateChat;
window.loadDashboardFriends = loadDashboardFriends;

// Espace Personnes : interactions spécifiques au mobile uniquement.
document.addEventListener("DOMContentLoaded", () => {
    const mobile = window.matchMedia("(max-width:760px)");
    const list = document.getElementById("dashboard-friends-list");
    const counter = document.getElementById("friends-count");
    const mobileCounter = document.getElementById("mobile-friends-count");
    const requestsCount = document.getElementById("social-requests-count");
    const badge = document.getElementById("mobile-requests-badge");
    const toggle = document.getElementById("mobile-requests-toggle");
    const add = document.getElementById("mobile-add-friend");
    const share = document.getElementById("mobile-share-friend");
    if (!list || !toggle) return;

    const sync = () => {
        if (mobileCounter && counter) mobileCounter.textContent = counter.textContent;
        const n = Number(requestsCount?.textContent) || 0;
        if (badge) { badge.textContent = n > 99 ? "99+" : String(n); badge.hidden = n === 0; }
        const notice = document.getElementById("mobile-social-notice");
        if (notice) notice.hidden = n === 0;
    };
    const observer = new MutationObserver(sync);
    if (counter) observer.observe(counter, {childList:true, characterData:true, subtree:true});
    if (requestsCount) observer.observe(requestsCount, {childList:true, characterData:true, subtree:true});
    sync();

    toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(expanded));
        document.body.classList.toggle("mobile-requests-expanded", expanded);
        if (expanded) window.refreshLobbyFriendRequests?.();
    });
    list.addEventListener("click", event => {
        if (!mobile.matches || event.target.closest(".friend-message-btn")) return;
        const row = event.target.closest(".friend");
        const id = Number(row?.querySelector(".friend-avatar[data-friend-id]")?.dataset.friendId);
        if (id > 0) window.openFullPlayerProfile?.(id);
    });
    add?.addEventListener("click", () => {
        // L'ajout d'amis s'effectue actuellement depuis le profil d'un joueur.
        if (typeof showToast === "function") showToast("Ouvre le profil d'un joueur pour l'ajouter en ami.");
        else alert("Ouvre le profil d'un joueur pour l'ajouter en ami.");
    });
    share?.addEventListener("click", async () => {
        // Partage de l'adresse de la plateforme, sans inventer de lien d'invitation API.
        const url = new URL("/lobby", location.origin).href;
        try {
            if (navigator.share) await navigator.share({title:"Game Platform", url});
            else { await navigator.clipboard.writeText(url); if (typeof showToast === "function") showToast("Lien copié !"); }
        } catch (error) {
            if (error.name !== "AbortError" && typeof showToast === "function") showToast("Impossible de partager le lien.");
        }
    });
});
