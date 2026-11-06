let selectedCards = new Set();

// Annonces royales et consultation unique : le serveur contrôle les droits.
const royalAnnouncements = { seen: new Set(), queue: [], active: null, timer: null, matchKey: null };
const ROYAL_LABELS = {
  2: ['Président', 'Trou du cul'],
  3: ['Président', 'Citoyen', 'Trou du cul'],
  4: ['Président', 'Vice-président', 'Vice-trou du cul', 'Trou du cul'],
  5: ['Président', 'Vice-président', 'Citoyen', 'Vice-trou du cul', 'Trou du cul'],
  6: ['Président', 'Vice-président', 'Ministre', 'Citoyen', 'Vice-trou du cul', 'Trou du cul'],
  7: ['Président', 'Vice-président', 'Grand ministre', 'Ministre', 'Citoyen', 'Vice-trou du cul', 'Trou du cul'],
  8: ['Président', 'Vice-président', 'Grand ministre', 'Ministre', "Citoyen d'honneur", 'Citoyen', 'Vice-trou du cul', 'Trou du cul']
};
function royalTitle(position, count) {
    return (ROYAL_LABELS[count] || [])[position - 1] || `${position}e place`;
}
function royalSelfId() {
    try { return Number(JSON.parse(localStorage.getItem('user') || '{}').id); }
    catch (_) { return NaN; }
}
function royalEnsureUI() {
    if (document.getElementById('president-royal-announcement')) return;
    const announce = document.createElement('div');
    announce.id = 'president-royal-announcement';
    announce.setAttribute('aria-live', 'polite');
    announce.hidden = true;
    document.body.append(announce);
    const modal = document.createElement('div');
    modal.id = 'president-royal-vision-modal';
    modal.hidden = true;
    modal.innerHTML = '<div class="president-vision-box" role="dialog" aria-modal="true" aria-label="Vision royale"><button class="president-vision-close" type="button" aria-label="Fermer">×</button><h3>👁 Vision royale</h3><p class="president-vision-player"></p><div class="president-vision-cards"></div><p class="president-vision-hint">Photographie des cartes au moment du clic · consultation unique</p></div>';
    modal.querySelector('.president-vision-close').addEventListener('click', () => { modal.hidden = true; });
    document.body.append(modal);
}
function royalShowNext() {
    if (royalAnnouncements.active || !royalAnnouncements.queue.length) return;
    royalEnsureUI();
    const entry = royalAnnouncements.queue.shift();
    royalAnnouncements.active = entry;
    try { sessionStorage.setItem(`president-royal-shown:${royalAnnouncements.matchKey}:${entry.user_id}`, '1'); } catch (_) {}
    const player = (latestState?.players || []).find(p => Number(p.user_id) === Number(entry.user_id));
    const box = document.getElementById('president-royal-announcement');
    box.replaceChildren();
    const avatar = document.createElement('div'); avatar.className = 'president-royal-win-avatar';
    if (player?.avatar_url) { const img = document.createElement('img'); img.src = player.avatar_url; img.alt = ''; avatar.append(img); }
    else avatar.textContent = '👑';
    const title = document.createElement('h2'); title.textContent = '👑 ' + royalTitle(entry.position, latestState?.players?.length || 0);
    const name = document.createElement('strong'); name.textContent = player?.pseudo || entry.pseudo || player?.username || 'Joueur';
    const info = document.createElement('p'); info.textContent = Number(entry.position) === 1 ? 'Termine premier et devient Président !' : `Termine à la ${entry.position}e place !`;
    box.append(avatar, title, name, info);
    if (Number(entry.user_id) === royalSelfId() && latestState?.royal_vision_available && Date.now() < Date.parse(latestState?.royal_vision_deadline || "")) {
        const hint = document.createElement('small'); hint.textContent = '👁 Clique sur un avatar encore en jeu pour voir ses cartes une seule fois.';
        box.append(hint);
    }
    box.hidden = false;
    // Chaque annonce dure 5 s ; les consultations ne sont autorisées que
    // pendant les 5 s réelles suivant le classement, même en cas de file d'attente.
    royalAnnouncements.timer = setTimeout(() => {
        box.hidden = true;
        royalAnnouncements.active = null;
        royalShowNext();
    }, 10000);
}
function royalProcessResults(state) {
    if (!state?.started) return;
    const key = String(state.room_id) + ':' + String(state.round_started_at || '');
    if (royalAnnouncements.matchKey !== key) {
        royalAnnouncements.matchKey = key;
        royalAnnouncements.seen.clear(); royalAnnouncements.queue.length = 0;
        royalAnnouncements.active = null;
        clearTimeout(royalAnnouncements.timer);
        const el = document.getElementById('president-royal-announcement'); if (el) el.hidden = true;
    }
    for (const result of (state.results || [])) {
        const id = String(result.user_id);
        if (royalAnnouncements.seen.has(id)) continue;
        royalAnnouncements.seen.add(id);
         // L'annonce doit rester visible même si le résultat est reçu tardivement.
        // Une annonce est présentée une seule fois par session et par manche.
        const storageKey = `president-royal-shown:${key}:${id}`;
        try { if (sessionStorage.getItem(storageKey) === '1') continue; } catch (_) {}
        royalAnnouncements.queue.push(result);
    }
    royalAnnouncements.queue.sort((a, b) => {
        const self = royalSelfId();
        const aSelf = Number(a.user_id) === self ? 0 : 1;
        const bSelf = Number(b.user_id) === self ? 0 : 1;
        return aSelf - bSelf || Number(a.position) - Number(b.position);
    });
    royalShowNext();
}
let royalInspectPending = false;
async function royalTryInspect(player) {
    if (royalInspectPending) return true;
    const state = latestState;
    if (!state?.royal_vision_available || Number(royalAnnouncements.active?.user_id) !== royalSelfId() || Number(player.user_id) === royalSelfId() || Number(player.cards_count) < 1) return false;
    const deadline = Date.parse(state.royal_vision_deadline || '');
    if (!Number.isFinite(deadline) || Date.now() >= deadline) return false;
    royalEnsureUI();
    royalInspectPending = true;
    try {
        const response = await api(`/api/games/president/${encodeURIComponent(roomCode)}/royal-vision`, {
            method: 'POST', body: JSON.stringify({target_user_id: player.user_id})
        });
        const payload = response?.data || response;
        if (!response?.ok && !Array.isArray(payload?.cards)) throw new Error(payload?.error || 'Consultation refusée');
        if (!Array.isArray(payload?.cards)) throw new Error(payload?.error || 'Aucune carte reçue');
        state.royal_vision_available = false;
        const modal = document.getElementById('president-royal-vision-modal');
        modal.querySelector('.president-vision-player').textContent = `${player.pseudo || player.username || 'Joueur'} · ${payload.cards.length} carte(s)`;
        const cards = modal.querySelector('.president-vision-cards'); cards.replaceChildren();
        const suits = {H:'♥', D:'♦', C:'♣', S:'♠'};
        for (const card of payload.cards) {
            const el = document.createElement('div'); el.className = 'president-vision-card';
            if (card.suit === 'H' || card.suit === 'D') el.classList.add('is-red');
            el.textContent = `${card.rank}${suits[card.suit] || card.suit}`;
            cards.append(el);
        }
        modal.hidden = false;
    } catch (error) {
        alert(error?.message || 'Vision royale indisponible');
    } finally {
        royalInspectPending = false;
    }
    return true;
}

function presidentIsSpectator(state = latestState) {
    if (!state) return false;
    let uid = null;
    try { uid = Number(JSON.parse(localStorage.getItem("user") || "{}").id); } catch (_) {}
    return !Array.isArray(state.players) || !state.players.some(p => Number(p.user_id) === uid);
}

let latestState = null;
let presidentStateInterval = null;
let presidentStateLoading = false;
let presidentLastRenderedGameSignature = null;
let presidentTurnTimerInterval = null;
let presidentTimerTurnStartedAt = null;
let presidentTimerTurnKey = null;
const PRESIDENT_TURN_SECONDS = 20;

/*
 * État local de l'audio.
 * Il reste stable même lorsque le polling reconstruit les joueurs.
 * Pour l'instant ceci pilote uniquement l'interface.
 */
const presidentAudioState = {
    microphoneEnabled: false,
    mutedUsers: new Set()
};

/* Podium royal. Appeler renderPresidentRoyalPodium(state) depuis renderPresidentState(state).
   Les positions ne sont attribuées que si le serveur les confirme dans state.results. */
(function () {
  const labels = ['Président', '2e place', '3e place', '4e place'];
  function render(state) {
    const target = document.getElementById('president-royal-podium');
    if (!target || !state) return;
    const players = Array.isArray(state.players) ? state.players : [];
    const results = Array.isArray(state.results) ? state.results : [];
    const count = Math.min(4, players.length);
    target.replaceChildren();
    const ranked = results.slice().sort((a,b) => Number(a.position)-Number(b.position));
    for (let index = 0; index < count; index++) {
      const result = ranked.find(r => Number(r.position) === index + 1);
      const player = result ? players.find(p => Number(p.user_id) === Number(result.user_id)) : null;
      const entry = document.createElement('div');
      entry.className = 'president-podium-entry' + (player ? '' : ' is-empty');
      entry.dataset.rank = String(index+1);
      const rank = document.createElement('span');
      rank.className = 'president-podium-rank';
      rank.textContent = index === 0 ? '♛ 1' : String(index + 1);
      const avatar = document.createElement('button');
      avatar.type = 'button';
      avatar.className = 'president-podium-avatar';
      avatar.disabled = !player;
      if (player) {
        const name = player.pseudo || result.pseudo ||
             player.username || result.username || `Joueur #${player.user_id}`;

        avatar.setAttribute('aria-label', `Voir le profil de ${name}`);
        // Aucun caractère superposé à la photo.
        avatar.replaceChildren();
        if (player.avatar_url) {
          const img = document.createElement('img');
          img.alt = '';
          img.onerror = () => { img.remove(); avatar.classList.add('is-avatar-fallback'); };
          img.src = player.avatar_url;
          avatar.append(img);
        }
        avatar.addEventListener('click', () => {
          if (typeof window.openFullPlayerProfile === 'function') window.openFullPlayerProfile(Number(player.user_id));
          else if (typeof window.openPlayerProfile === 'function') window.openPlayerProfile(player);
        });
      } else { avatar.textContent = '♛'; }
      const name = document.createElement('span');
      name.className = 'president-podium-name';
      name.textContent = player? (player.pseudo || result.pseudo || player.username || result.username || 'Joueur') : 'À déterminer';
      const status = document.createElement('span');
      status.className = 'president-podium-status';
      status.textContent = player ? labels[index] : 'En jeu';
      entry.append(rank, avatar, name, status);
      target.append(entry);
    }
  }
  window.renderPresidentRoyalPodium = render;
})();

// Timer : la valeur du serveur est la seule référence temporelle.
// performance.now() mesure uniquement le temps écoulé depuis la dernière réponse.
let presidentTimerRemainingAtSync = null;
let presidentTimerSyncedAt = null;
let presidentTimerDuration = 15;

function syncPresidentTurnTimer(state) {
    if (!state || state.finished || state.current_player == null) {
        presidentTimerTurnKey = null;
        presidentTimerRemainingAtSync = null;
        presidentTimerSyncedAt = null;
        return;
    }

    const key = `${state.current_player}:${state.turn_started_at ?? ''}`;
    const info = state.turn_timer;
        const rawDuration = info?.timeout_seconds ?? state.turn_duration;
    const duration = rawDuration == null ? NaN : Number(rawDuration);
    if (Number.isFinite(duration) && duration > 0) presidentTimerDuration = duration;

    if (key !== presidentTimerTurnKey) {
        presidentTimerTurnKey = key;
        presidentTimerRemainingAtSync = null;
        presidentTimerSyncedAt = null;
    }

    // Number(null) vaut 0 : ne jamais interpréter un champ absent comme
    // « 0 seconde restante ». Certaines versions du serveur n'envoient
    // que turn_started_at, sans objet turn_timer.
    const rawRemaining = info?.remaining_seconds;
    let remaining = rawRemaining !== null && rawRemaining !== undefined && rawRemaining !== ''
        ? Number(rawRemaining) : NaN;

    if (!Number.isFinite(remaining) && state.turn_started_at) {
        // Le serveur envoie un timestamp UTC ISO, parfois sans suffixe Z.
        const rawStart = String(state.turn_started_at);
        const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawStart)
            ? rawStart : `${rawStart}Z`;
        const startedMs = Date.parse(normalized);
        if (Number.isFinite(startedMs)) {
            remaining = presidentTimerDuration - (Date.now() - startedMs) / 1000;
        }
    }

    if (Number.isFinite(remaining)) {
        presidentTimerRemainingAtSync = Math.max(0, Math.min(presidentTimerDuration, remaining));
        presidentTimerSyncedAt = performance.now();
    } else if (presidentTimerRemainingAtSync == null && Number.isFinite(duration)) {
        presidentTimerRemainingAtSync = presidentTimerDuration;
        presidentTimerSyncedAt = performance.now();
    }
}

function updatePresidentTurnTimer(state) {
    if (!state || state.finished || state.current_player == null) {
        document.querySelectorAll('.president-timer-avatar').forEach(el => {
            el.classList.remove('president-timer-avatar');
            el.style.removeProperty('--timer-progress');
            el.style.removeProperty('--timer-color');
        });
        document.querySelectorAll('.president-timer-seconds').forEach(el => el.remove());
        return;
    }
    if (presidentTimerRemainingAtSync == null || presidentTimerSyncedAt == null) {
        document.querySelectorAll(".president-timer-seconds").forEach(el => el.remove());
        return;
    }
    const remainingExact = presidentTimerRemainingAtSync == null || presidentTimerSyncedAt == null
        ? presidentTimerDuration
        : Math.max(0, presidentTimerRemainingAtSync - (performance.now() - presidentTimerSyncedAt) / 1000);
    const remaining = Math.max(0, Math.ceil(remainingExact));
    const fraction = Math.max(0, Math.min(1, remainingExact / presidentTimerDuration));
    document.querySelectorAll('.president-table-player').forEach(player => {
        const active = player.classList.contains('is-current');
        const avatar = player.querySelector('.president-player-avatar');
        if (!avatar) return;
        avatar.classList.toggle('president-timer-avatar', active);
        const old = avatar.querySelector('.president-timer-seconds');
        if (!active) {
            old?.remove();
            avatar.style.removeProperty('--timer-progress');
            avatar.style.removeProperty('--timer-color');
            return;
        }
                const color = remaining <= 3 ? '#f15d5d' : remaining <= 10 ? '#f1b94f' : '#55bfff';
        avatar.style.setProperty('--timer-progress', `${fraction * 100}%`);
        avatar.style.setProperty('--timer-color', color);
        // Aucun chiffre affiché : seul l'anneau de progression reste visible.
        old?.remove();
    });
}

(function installPresidentTimerStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .president-player-avatar.president-timer-avatar { position:relative; isolation:isolate; overflow:visible !important; }
      .president-player-avatar.president-timer-avatar::after {
        content:''; position:absolute; inset:-7px; border-radius:50%; pointer-events:none;
        background:conic-gradient(var(--timer-color, #55bfff) var(--timer-progress, 100%), #26364e 0);
        -webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
        mask:radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
      }
      .president-timer-seconds { position:absolute; z-index:5; top:-17px; right:-18px;
        color:var(--timer-color,#55bfff); background:#06172d; border:1px solid #49607a;
        border-radius:12px; min-width:24px; padding:1px 4px; font:700 12px Outfit,sans-serif;
        text-align:center; pointer-events:none; }
      .president-podium-avatar.is-avatar-fallback { background:radial-gradient(circle at 35% 25%, #d8b56c, #15385c 60%, #081a31); }
    `;
    document.head.appendChild(style);
})();

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

function updatePresidentSelectedCount() {
    const selectedCount = selectedCards.size;

    const counter = document.getElementById("selected-count");

    if (counter) {
        counter.textContent = selectedCount;
    }
}

function isPresidentCardPlayable(card) {

    const state = latestState;

    if (!state || state.finished) {
        return false;
    }

    const user = JSON.parse(
        localStorage.getItem("user") || "{}"
    );

    if (
        Number(state.current_player) !==
        Number(user.id)
    ) {
        return false;
    }

    const currentPlay = state.current_play || [];
    const hand = state.your_hand || [];

    const requiredCount = currentPlay.length;

    // Pli vide : toutes les cartes peuvent être sélectionnées
    if (requiredCount === 0) {
        return true;
    }

    const order = {
        "3": 3, "4": 4, "5": 5,
        "6": 6, "7": 7, "8": 8,
        "9": 9, "10": 10,
        "J": 11, "Q": 12,
        "K": 13, "A": 14,
        "2": 15
    };

    const rank = String(card.rank).toUpperCase();
    const centerRank = String(
        currentPlay[0].rank
    ).toUpperCase();

    const cardValue = order[rank];
    const centerValue = order[centerRank];

    // La carte doit être supérieure à celle du centre
    if (
        cardValue === undefined ||
        centerValue === undefined ||
        cardValue <= centerValue
    ) {
        return false;
    }

    // Compter les cartes de même valeur dans la main
    const matchingCount = hand.filter(
        c => String(c.rank).toUpperCase() === rank
    ).length;

    // Paire : au moins 2 cartes
    // Brelan : au moins 3 cartes
    // Carré : au moins 4 cartes
    return matchingCount >= requiredCount;
}

// Les commandes sont initialement disabled dans le HTML : les actualiser
// après chaque état reçu ET chaque modification de sélection.
function updatePresidentActionButtons() {
    const play = document.getElementById("play-btn");
    const pass = document.getElementById("pass-btn");
    if (!play || !pass) return;
    const state = latestState;
    let userId = null;
    try { userId = JSON.parse(localStorage.getItem("user") || "{}").id; } catch (_) {}
    const myTurn = Boolean(state && !presidentIsSpectator(state) && !state.finished &&
        Number(state.current_player) === Number(userId) && userId != null);
    const center = state?.current_play || [];
    const hand = state?.your_hand || [];
    const chosen = hand.filter(card => selectedCards.has(card.id));
    const sameRank = chosen.length > 0 && chosen.every(card =>
        String(card.rank).toUpperCase() === String(chosen[0].rank).toUpperCase());
    const required = center.length;
    const validCount = required === 0 || chosen.length === required;
    const rankOrder = {"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:11,Q:12,K:13,A:14,"2":15};
    const higher = required === 0 ||
        (rankOrder[String(chosen[0]?.rank).toUpperCase()] || 0) >
        (rankOrder[String(center[0]?.rank).toUpperCase()] || 0);
    // Ne dépend pas de can_play/can_pass, absents des anciennes API.
    play.disabled = !(myTurn && sameRank && validCount && higher);
    pass.disabled = !(myTurn && required > 0);
    play.title = !myTurn ? "Attends ton tour" : play.disabled ? "Sélectionne un coup valide" : "Jouer";
    pass.title = !myTurn ? "Attends ton tour" : pass.disabled ? "Impossible de passer sur un tapis vide" : "Passer";
}

function renderPresidentLastPlays(state) {
    const host = document.getElementById("president-last-plays");
    if (!host) return;
    const history = state?.last_plays || state?.last_three_plays || [];
    if (!Array.isArray(history)) return;
    const recent = history.slice(-3);
    const signature = JSON.stringify(recent);
    if (host.dataset.historySignature === signature) return;
    host.dataset.historySignature = signature;
    host.replaceChildren();
    recent.forEach((entry, i) => {
        const item = document.createElement("div");
        item.className = "president-history-item";
        item.style.opacity = String(0.4 + 0.6 * (i + 1) / recent.length);
        const name = document.createElement("span");
        name.className = "president-history-name";
        name.textContent = entry.pseudo || entry.username || entry.player_name || `Joueur #${entry.user_id || "?"}`;
        const content = document.createElement("div");
        content.className = "president-history-cards";
        if (entry.action === "pass") {
            item.classList.add("is-pass");
            const label = document.createElement("span");
            label.className = "president-history-pass";
            label.textContent = entry.automatic ? "⏱ Passe automatiquement" : "↪ Passe son tour";
            content.appendChild(label);
        } else {
            (entry.cards || []).forEach(card => {
                const label = document.createElement("span");
                label.className = "president-history-symbol";
                label.textContent = presidentCardLabel(card);
                if (card.suit === "D" || card.suit === "H") label.classList.add("is-red");
                content.appendChild(label);
            });
        }
        item.append(name, content);
        host.appendChild(item);
    });
}

function renderPresidentCards() {

    const hand = document.getElementById("hand");

    if (!hand) {
        return;
    }

    hand.innerHTML = "";

    const cards = latestState?.your_hand || [];

       // Supprime uniquement le compteur local redondant sous la main.
    document.querySelectorAll(".local-hand-count").forEach(el => el.remove());

    // Construire des rangées de 10 cartes maximum,
    // sans séparer les cartes de même valeur.
    const rows = [];
    let currentRow = [];

    let index = 0;

    while (index < cards.length) {

        const rank = String(cards[index].rank).toUpperCase();

        const group = [];

        while (
            index < cards.length &&
            String(cards[index].rank).toUpperCase() === rank
        ) {
            group.push(cards[index]);
            index++;
        }

        if (
            currentRow.length > 0 &&
            currentRow.length + group.length > 10
        ) {
            rows.push(currentRow);
            currentRow = [];
        }

        currentRow.push(...group);
    }

    if (currentRow.length > 0) {
        rows.push(currentRow);
    }

    hand.classList.toggle("two-rows", rows.length > 1);

    const handCount = document.getElementById( "hand-count");

    if (handCount) {

        handCount.textContent =
            `${cards.length} carte${
                cards.length > 1 ? "s" : ""
            }`;
    }


    rows.forEach(rowCards => {

    const row = document.createElement("div");
    row.className = "president-hand-row";

    rowCards.forEach(card => {

        const button =
            document.createElement("button");

        button.type = "button";

        const playable = isPresidentCardPlayable(card);

        button.className =
            "playing-card" +
            (selectedCards.has(card.id) ? " selected" : "");

        button.disabled = !playable;

        if (!playable) {
            button.classList.add("unplayable");
        }

        const suits = {
            C: "clubs",
            D: "diamonds",
            H: "hearts",
            S: "spades"
        };

        const rank = String(card.rank).toLowerCase();
        const suit = suits[card.suit];

        const image = document.createElement("img");

        image.className = "president-card-image";

        image.src =
            `/static/images/cards/carte_01/${rank}_${suit}.svg`;

        image.alt = `${card.rank} ${suit}`;
        image.draggable = false;

        button.appendChild(image);

        button.addEventListener("click", () => {

            if (selectedCards.has(card.id)) {

                // Carte déjà sélectionnée : on la désélectionne
                selectedCards.delete(card.id);

            } else {

                // Récupérer les cartes actuellement sélectionnées
                const previousSelectedCards = cards.filter(
                    c => selectedCards.has(c.id)
                );

                // Vérifier si la valeur est différente
                const differentRank = previousSelectedCards.some(
                    c => String(c.rank).toUpperCase() !==
                         String(card.rank).toUpperCase()
                );

                // Si la valeur change, on vide l'ancienne sélection
                if (differentRank) {
                    selectedCards.clear();
                }

                // Sélectionner la nouvelle carte
                // Nombre de cartes à jouer pour répondre au pli
                const requiredCount =
                    latestState?.current_play?.length || 0;

                // Si le pli est vide, on peut choisir librement
                if (
                    requiredCount === 0 ||
                    selectedCards.size < requiredCount
                ) {
                    selectedCards.add(card.id);
                }
            }

            renderPresidentCards();
         //   updatePresidentSelectedCount();

        });

        row.appendChild(button);

            });

            hand.appendChild(row);

        });
    updatePresidentSelectedCount();
    updatePresidentActionButtons();
}

function getPresidentPlayerPosition(index, count) {

    const layouts = {
        2: [
            { x: 50, y: 90 },
            { x: 50, y: 18 }
        ],

        3: [
            { x: 50, y: 90 },
            { x: 12, y: 35 },
            { x: 88, y: 35 }
        ],

        4: [
            { x: 50, y: 90 },
            { x: 12, y: 35 },
            { x: 50, y: 18 },
            { x: 88, y: 35 }
        ],

        5: [
            { x: 50, y: 90 },
            { x: 12, y: 30 },
            { x: 50, y: 18 },
            { x: 88, y: 30 },
            { x: 50, y: 62 }
        ],

        6: [
            { x: 50, y: 90 },
            { x: 12, y: 30 },
            { x: 50, y: 18 },
            { x: 88, y: 30 },
            { x: 12, y: 60 },
            { x: 88, y: 60 }
        ],

        7: [
            { x: 50, y: 90 },
            { x: 12, y: 30 },
            { x: 35, y: 18 },
            { x: 65, y: 18 },
            { x: 88, y: 30 },
            { x: 12, y: 60 },
            { x: 88, y: 60 }
        ],

        8: [
            { x: 50, y: 90 },
            { x: 12, y: 30 },
            { x: 28, y: 18 },
            { x: 50, y: 18 },
            { x: 88, y: 30 },
            { x: 12, y: 60 },
            { x: 88, y: 60 },
            { x: 72, y: 18 }
        ]
    };

    return layouts[count]?.[index] || { x: 50, y: 50 };
}

function renderPresidentPlayers(state) {

    const container =
        document.getElementById(
            "players"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

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
            !state.finished && state.current_player != null &&
            Number(player.cards_count) > 0 &&
            Number(player.user_id) === Number(state.current_player);

        const position =
                getPresidentPlayerPosition(
                    index,
                    playerCount
                );

            let playerSide = "top";

            if (isMe) {

                playerSide = "bottom";

            } else if (position.y <= 20) {

                playerSide = "top";

            } else if (position.x < 50) {

                playerSide = "left";

            } else if (position.x > 50) {

                playerSide = "right";
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


        playerElement.style.left =
            `${position.x}%`;

        playerElement.style.top =
            `${position.y}%`;

        // ======================================
        // AVATAR
        // ======================================

        const username =
            player.pseudo ||
            (isMe ? currentUser.pseudo : null) ||
            player.username ||
            (isMe ? currentUser.username : null) ||
            `Joueur #${player.user_id}`;

        const avatar = document.createElement("div");
            avatar.className = "president-player-avatar";

            const initial = username.trim().charAt(0).toUpperCase() || "?";

            const avatarUrl = String(
                player.avatar_url ||
                (isMe ? currentUser.avatar_url : "") ||
                ""
            ).trim();

            // Initiale si aucune photo n'est disponible.
            avatar.textContent = initial;

            if (avatarUrl) {
                const avatarImage = document.createElement("img");

                avatarImage.alt = username;
                avatarImage.draggable = false;

                avatarImage.onload = () => {
                    avatar.replaceChildren(avatarImage);
                };

                avatarImage.onerror = () => {
                    avatar.textContent = initial;
                };

                avatarImage.src = avatarUrl;
            }

        // Profil accessible depuis l'avatar et le pseudo, sans interférer
        // avec les cartes ou les commandes de la partie.
        const openTablePlayerProfile = (event) => {
            event.stopPropagation();
            if (latestState?.royal_vision_available && Number(royalAnnouncements.active?.user_id) === royalSelfId() && Number(player.cards_count) > 0 && Number(player.user_id) !== royalSelfId()) {
                royalTryInspect(player);
                return;
            }
            const playerId = Number(player.user_id);
            if (!Number.isInteger(playerId) || playerId <= 0) return;
            if (typeof window.openFullPlayerProfile === "function") {
                window.openFullPlayerProfile(playerId);
            } else if (typeof openPlayerProfile === "function") {
                openPlayerProfile(player);
            }
        };

        const enableProfileInteraction = (element, label) => {
            element.classList.add("player-profile-clickable");
            element.setAttribute("role", "button");
            element.setAttribute("tabindex", "0");
            element.setAttribute("aria-label", `Voir le profil de ${label}`);
            element.style.cursor = "pointer";
            element.addEventListener("click", openTablePlayerProfile);
            element.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openTablePlayerProfile(event);
                }
            });
        };
        enableProfileInteraction(avatar, username);

        // ======================================
        // DOS DES CARTES DE L'ADVERSAIRE
        // ======================================

        let opponentCards = null;

        if (!isMe) {

            opponentCards =
                document.createElement("div");

            opponentCards.className =
                "president-opponent-cards";

            const visibleCards = Number(player.cards_count) || 0;

            for (
                let i = 0;
                i < visibleCards;
                i++
            ) {

                const cardBack =
                    document.createElement("img");

                cardBack.className =
                    "president-card-back";

                cardBack.src =
                    "/static/images/cards/carte_01/back.svg";

                cardBack.alt = "";
                cardBack.draggable = false;

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

        name.textContent = username;
        enableProfileInteraction(name, username);

        const presenceDot =
            document.createElement("span");

        presenceDot.className =
            "president-presence-dot";

        const isPresent = Array.isArray(state.presence) && state.presence.some(id => Number(id) === Number(player.user_id));
        presenceDot.style.backgroundColor = isPresent ? "#22c55e" : "#050505";
        presenceDot.style.boxShadow = isPresent ? "0 0 7px #22c55e" : "none";
        presenceDot.title = isPresent ? "Dans la salle" : "Absent de la salle";

        const cardCount =
            document.createElement("div");

        cardCount.className =
            "president-card-count";

        cardCount.textContent =
            player.position
                ? `🏆 ${player.position}e`
                : `${player.cards_count}`;


        const nameRow =
            document.createElement("div");

        nameRow.className =
            "president-player-name-row";

        const audioButton =
            document.createElement("button");

        audioButton.type = "button";
        audioButton.className = "president-audio-button";

        function refreshAudioButton() {

            if (isMe) {

                const enabled =
                    presidentAudioState.microphoneEnabled;

                audioButton.classList.add(
                    "president-mic-button"
                );

                audioButton.classList.toggle(
                    "is-muted",
                    !enabled
                );

                audioButton.innerHTML = `<img class="president-audio-icon" src="/static/images/president_audio_png/${enabled ? "micro_on" : "micro_off"}.png" alt="" draggable="false">`;

                audioButton.title =
                    enabled
                        ? "Couper mon microphone"
                        : "Activer mon microphone";

                return;
            }

            const muted =
                presidentAudioState.mutedUsers.has(
                    Number(player.user_id)
                );

            audioButton.classList.add(
                "president-speaker-button"
            );
            audioButton.dataset.voiceUserId = String(player.user_id);

            audioButton.classList.toggle(
                "is-muted",
                muted
            );
            audioButton.classList.toggle("is-speaking", !muted && presidentVoice.isSpeaking(Number(player.user_id)));

            audioButton.innerHTML = `<img class="president-audio-icon" src="/static/images/president_audio_png/${muted ? "speaker_off" : "speaker_on"}.png" alt="" draggable="false">`;

            audioButton.title =
                muted
                    ? `Écouter ${username}`
                    : `Couper ${username}`;
        }

        refreshAudioButton();

        audioButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                if (isMe) {

                    presidentVoice.toggleMicrophone();

                } else {

                    const playerId =
                        Number(player.user_id);

                    if (
                        presidentAudioState.mutedUsers.has(
                            playerId
                        )
                    ) {
                        presidentAudioState.mutedUsers.delete(
                            playerId
                        );
                        presidentVoice.applyMute(playerId);
                    } else {
                        presidentAudioState.mutedUsers.add(
                            playerId
                        );
                        presidentVoice.applyMute(playerId);
                    }
                }

                refreshAudioButton();
            }
        );

        // Une seule ligne compacte : présence, pseudo, cartes, audio.
        // Le nombre de cartes ne prend plus une ligne verticale sous l'avatar.
        nameRow.appendChild(presenceDot);
        nameRow.appendChild(name);
        nameRow.appendChild(cardCount);
        nameRow.appendChild(audioButton);

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

        if (isMe) {

            // Joueur local : conserver l'affichage actuel
            playerElement.appendChild(avatar);
            playerElement.appendChild(info);

        } else {

            // Adversaire : même ordre que dans la simulation DEV

            if (opponentCards) {
                playerElement.appendChild(opponentCards);
            }

            // Déplacer le timer avant le pseudo
            const turnBar = info.querySelector(
                ".president-turn-mini-bar"
            );

            if (turnBar) {
                playerElement.appendChild(turnBar);
            }

            // Pseudo et haut-parleur
            playerElement.appendChild(info);

            // Avatar
            playerElement.appendChild(avatar);

        }

        container.appendChild(
            playerElement
        );
    });
}

function renderPresidentCurrentPlay(state) {

    const container =
        document.getElementById("current-play");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const cards = state.current_play || [];

    const suits = {
        C: "clubs",
        D: "diamonds",
        H: "hearts",
        S: "spades"
    };

    cards.forEach(card => {

        const rank = String(card.rank).toLowerCase();
        const suit = suits[card.suit];

        if (!suit) {
            return;
        }

        const image =
            document.createElement("img");

        image.className =
            "president-played-card";

        image.src =
            `/static/images/cards/carte_01/${rank}_${suit}.svg`;

        image.alt =
            presidentCardLabel(card);

        image.draggable = false;

        container.appendChild(image);
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
                        result.pseudo ||
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

function renderPresidentState(state) {

    if (!state) {
        return;
    }

    latestState = state;
    royalProcessResults(state);
    const spectator = presidentIsSpectator(state);
    const handArea = document.querySelector(".president-local-hand");
    if (handArea) handArea.style.display = spectator ? "none" : "";
    if (spectator) selectedCards.clear();

    const waitingPanel =
        document.getElementById("waiting-panel");

    const gamePanel =
        document.getElementById("game-panel");

    if (waitingPanel) {
        waitingPanel.classList.add("hidden");
    }

    if (gamePanel) {
        gamePanel.classList.remove("hidden");
    }

    syncPresidentTurnTimer(state);
    if (state.started && !state.finished) {
        startPresidentStatePolling();
    } else {
        stopPresidentStatePolling();
    }
        // Le polling HTTP a lieu chaque seconde pour permettre au serveur de
    // traiter les tours expirés. Ne reconstruire le DOM que lorsque le jeu
    // change réellement : sinon les images d'avatars clignotent.
    // Les informations du timer sont volontairement exclues de cette signature.
    const gameSignature = JSON.stringify({
        started: state.started,
        spectator: spectator,
        finished: state.finished,
        current_player: state.current_player,
        turn_started_at: state.turn_started_at,
        players: state.players,
        your_hand: state.your_hand,
        current_play: state.current_play,
        last_plays: state.last_plays,
        last_three_plays: state.last_three_plays,
        results: state.results,
        can_play: state.can_play,
        can_pass: state.can_pass
    });
    const gameChanged = gameSignature !== presidentLastRenderedGameSignature;
    if (gameChanged) {
        presidentLastRenderedGameSignature = gameSignature;
        renderPresidentPlayers(state);
    }
    // Actualisation du chiffre et de l'anneau, sans recréer l'avatar.
    updatePresidentTurnTimer(state);
    if (state.finished || state.current_player == null) {
        document.querySelectorAll('.president-table-player.is-current').forEach(el => el.classList.remove('is-current'));
    }
    if (!gameChanged) {
        updatePresidentActionButtons();
        return;
    }
    renderPresidentCards();
    renderPresidentCurrentPlay(state);
    renderPresidentLastPlays(state);
    renderPresidentResults(state);

    updatePresidentSelectedCount();
    updatePresidentActionButtons();
    if (typeof window.renderPresidentRoyalPodium === "function") {
    window.renderPresidentRoyalPodium(state);
}
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

    const requiredCount =
        latestState?.current_play?.length || 0;

    if (
        requiredCount > 0 &&
        selectedCards.size !== requiredCount
    ) {
        showToast(
            `Tu dois sélectionner exactement ${requiredCount} carte(s).`
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

    renderPresidentState(
        result.data.state
    );
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

function positionPresidentActions() {
    const table = document.querySelector(".president-table");
    const actions = document.querySelector(".president-hand-actions");
    if (table && actions && actions.parentElement !== table) table.appendChild(actions);
}

function initPresidentGame() {
     if (!presidentTurnTimerInterval) {
        presidentTurnTimerInterval = setInterval(() => {
            if (latestState) updatePresidentTurnTimer(latestState);
        }, 250);
    }
    positionPresidentActions();
    presidentVoice.init();

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

// Icônes audio PNG transparentes, sans pastille ni fond.
(function installPresidentAudioIconStyles() {
    if (document.getElementById("president-audio-png-style")) return;
    const style = document.createElement("style");
    style.id = "president-audio-png-style";
    style.textContent = `
        .president-audio-button { background: transparent !important; border: 0 !important; box-shadow: none !important; padding: 2px !important; display: inline-flex; align-items: center; justify-content: center; }
        .president-audio-icon { display: block; width: 20px; height: 20px; object-fit: contain; pointer-events: none; }
        .president-speaker-button { position: relative; overflow: visible; }
        .president-speaker-button.is-speaking:not(.is-muted) .president-audio-icon { animation: president-speaker-pulse .65s ease-in-out infinite alternate; filter: drop-shadow(0 0 5px rgba(255,205,74,.85)); }
        .president-speaker-button.is-speaking:not(.is-muted)::after { content: ""; position: absolute; inset: -4px; border: 1.5px solid rgba(255,205,74,.9); border-radius: 50%; pointer-events: none; animation: president-speaker-wave 1s ease-out infinite; }
        @keyframes president-speaker-pulse { from { transform: scale(1); } to { transform: scale(1.18); } }
        @keyframes president-speaker-wave { from { transform: scale(.7); opacity: .9; } to { transform: scale(1.6); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .president-speaker-button.is-speaking:not(.is-muted) .president-audio-icon, .president-speaker-button.is-speaking:not(.is-muted)::after { animation: none; } }
    `;
    document.head.appendChild(style);
})();

// --- WebRTC voix : connexion indépendante du socket du jeu. ---
const presidentVoice = (() => {
    let socket = null;
    let stream = null;
    let joining = false;
    let audioContext = null;
    const speakingUsers = new Set();
    const peers = new Map(); // sid -> { pc, userId, audio, pending }
    const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

    function notify(message) {
        if (typeof showToast === 'function') showToast(message);
        else console.warn('[Voix]', message);
    }
    function myId() {
        try { return Number(JSON.parse(localStorage.getItem('user') || '{}').id); }
        catch (_) { return NaN; }
    }
    function refreshButtons() {
        document.querySelectorAll('.president-mic-button').forEach(button => {
            const enabled = presidentAudioState.microphoneEnabled;
            button.classList.toggle('is-muted', !enabled);
            button.title = enabled ? 'Couper mon microphone' : 'Activer mon microphone';
            const img = button.querySelector('img');
            if (img) img.src = `/static/images/president_audio_png/${enabled ? 'micro_on' : 'micro_off'}.png`;
        });
    }
    function isSpeaking(userId) { return speakingUsers.has(Number(userId)); }
    function updateSpeaking(userId, active) {
        userId = Number(userId);
        if (!Number.isFinite(userId)) return;
        if (active) speakingUsers.add(userId);
        else speakingUsers.delete(userId);
        document.querySelectorAll('.president-speaker-button').forEach(button => {
            if (Number(button.dataset.voiceUserId) === userId) {
                button.classList.toggle('is-speaking', active && !presidentAudioState.mutedUsers.has(userId));
            }
        });
    }
    function monitorPeerAudio(peer, remoteStream) {
        if (!remoteStream?.getAudioTracks().length) return;
        try {
            if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
            if (peer.source) { peer.source.disconnect(); peer.analyser.disconnect(); }
            peer.source = audioContext.createMediaStreamSource(remoteStream);
            peer.analyser = audioContext.createAnalyser();
            peer.analyser.fftSize = 512;
            peer.source.connect(peer.analyser); // analyse uniquement, ne pas renvoyer vers les haut-parleurs
            peer.samples = new Uint8Array(peer.analyser.fftSize);
            peer.speakingFrames = 0;
            if (!peer.meter) peer.meter = setInterval(() => {
                if (!peer.analyser) return;
                peer.analyser.getByteTimeDomainData(peer.samples);
                let energy = 0;
                for (const value of peer.samples) energy += (value - 128) ** 2;
                const rms = Math.sqrt(energy / peer.samples.length) / 128;
                // Petite hystérésis pour éviter un clignotement à chaque syllabe.
                peer.speakingFrames = rms > 0.035 ? 5 : Math.max(0, peer.speakingFrames - 1);
                const active = peer.speakingFrames > 0;
                const anySpeaking = [...peers.values()].some(p => p.userId === peer.userId && p.speakingFrames > 0);
                updateSpeaking(peer.userId, active || anySpeaking);
            }, 120);
        } catch (error) { console.warn('Indicateur vocal', error); }
    }
    function applyMute(userId) {
        peers.forEach(peer => {
            if (peer.userId === Number(userId) && peer.audio) {
                peer.audio.muted = presidentAudioState.mutedUsers.has(Number(userId));
            }
        });
    }
    function closePeer(sid) {
        const peer = peers.get(sid);
        if (!peer) return;
        if (peer.meter) clearInterval(peer.meter);
        try { peer.source?.disconnect(); peer.analyser?.disconnect(); } catch (_) {}
        peer.pc.close();
        peer.audio?.remove();
        peers.delete(sid);
        if (![...peers.values()].some(p => p.userId === peer.userId && p.speakingFrames > 0)) updateSpeaking(peer.userId, false);
    }
    function closeAll() { [...peers.keys()].forEach(closePeer); }
    function signal(to, payload) {
        if (socket?.connected) socket.emit('voice:signal', { to, signal: payload });
    }
    function createPeer(sid, userId) {
        if (peers.has(sid)) return peers.get(sid);
        const pc = new RTCPeerConnection(rtcConfig);
        const peer = { pc, userId: Number(userId), audio: null, pending: [] };
        peers.set(sid, peer);
        if (stream) stream.getTracks().forEach(track => pc.addTrack(track, stream));
        else pc.addTransceiver('audio', { direction: 'recvonly' });
        pc.onicecandidate = event => {
            if (event.candidate) signal(sid, { type: 'candidate', candidate: event.candidate.toJSON() });
        };
        pc.ontrack = event => {
            if (!peer.audio) {
                peer.audio = document.createElement('audio');
                peer.audio.autoplay = true;
                peer.audio.playsInline = true;
                peer.audio.style.display = 'none';
                document.body.appendChild(peer.audio);
            }
            peer.audio.srcObject = event.streams[0] || new MediaStream([event.track]);
            applyMute(peer.userId);
            monitorPeerAudio(peer, peer.audio.srcObject);
            peer.audio.play().catch(() => {});
        };
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') closePeer(sid);
        };
        return peer;
    }
    async function flushCandidates(peer) {
        for (const candidate of peer.pending.splice(0)) {
            try { await peer.pc.addIceCandidate(candidate); } catch (error) { console.warn('ICE', error); }
        }
    }
    async function offerTo(sid, userId) {
        const peer = createPeer(sid, userId);
        if (peer.pc.signalingState !== 'stable') return;
        await peer.pc.setLocalDescription(await peer.pc.createOffer());
        signal(sid, { type: 'offer', sdp: peer.pc.localDescription });
    }
    async function onSignal(data) {
        const sid = data?.from;
        const message = data?.signal;
        if (!sid || !message) return;
        const peer = createPeer(sid, data.user_id);
        const pc = peer.pc;
        try {
            if (message.type === 'offer') {
                if (pc.signalingState !== 'stable') {
                    await pc.setLocalDescription({ type: 'rollback' });
                }
                await pc.setRemoteDescription(message.sdp);
                await flushCandidates(peer);
                await pc.setLocalDescription(await pc.createAnswer());
                signal(sid, { type: 'answer', sdp: pc.localDescription });
            } else if (message.type === 'answer') {
                if (pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(message.sdp);
                    await flushCandidates(peer);
                }
            } else if (message.type === 'candidate' && message.candidate) {
                if (pc.remoteDescription) await pc.addIceCandidate(message.candidate);
                else peer.pending.push(message.candidate);
            }
        } catch (error) { console.error('WebRTC signal', error); }
    }
    function init() {
        if (socket || typeof io !== 'function' || typeof roomCode === 'undefined') return;
        const token = localStorage.getItem('access_token');
        if (!token) return;
        socket = io({ transports: ['polling'], auth: { token } });
        document.addEventListener('click', () => { if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {}); }, { passive: true });
        socket.on('connect', () => {
            closeAll();
            socket.emit('voice:join', { room_code: roomCode });
        });
        socket.on('voice:peers', async data => {
            // Le nouvel arrivant initie les offres, ce qui évite les offres simultanées.
            for (const peer of data?.peers || []) {
                if (Number(peer.user_id) !== myId()) {
                    try { await offerTo(peer.sid, peer.user_id); } catch (error) { console.error(error); }
                }
            }
        });
        socket.on('voice:peer-joined', data => {
            if (Number(data?.user_id) !== myId()) createPeer(data.sid, data.user_id);
        });
        socket.on('voice:signal', onSignal);
        socket.on('voice:peer-left', data => closePeer(data?.sid));
        socket.on('voice:error', data => notify(data?.error || 'Erreur audio'));
        socket.on('disconnect', closeAll);
        window.addEventListener('pagehide', () => {
            socket?.emit('voice:leave');
            stream?.getTracks().forEach(track => track.stop());
            closeAll();
        }, { once: true });
    }
    async function toggleMicrophone() {
        if (joining) return;
        if (presidentAudioState.microphoneEnabled) {
            presidentAudioState.microphoneEnabled = false;
            stream?.getAudioTracks().forEach(track => { track.enabled = false; });
            refreshButtons();
            return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            notify('Microphone indisponible : ouvre le jeu en HTTPS ou sur localhost.');
            return;
        }
        joining = true;
        try {
            if (!stream || !stream.getAudioTracks().some(track => track.readyState === 'live')) {
                stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
                // Recréer les connexions existantes pour ajouter les pistes audio proprement.
                const current = [...peers.entries()].map(([sid, peer]) => ({ sid, userId: peer.userId }));
                closeAll();
                // Les pairs existants recevront une nouvelle offre depuis ce client.
                for (const peer of current) await offerTo(peer.sid, peer.userId);
            }
            stream.getAudioTracks().forEach(track => { track.enabled = true; });
            presidentAudioState.microphoneEnabled = true;
            refreshButtons();
        } catch (error) {
            console.error('Microphone', error);
            notify('Accès au microphone refusé ou indisponible.');
        } finally { joining = false; }
    }
    return { init, toggleMicrophone, applyMute, isSpeaking };
})();