function connectGameSocket(roomCode, onState, onRoomUpdate, onChatMessage,onChatHistory) {

    const token = localStorage.getItem("access_token");

    if (!token) {
        location.href = "/login";
        return null;
    }

    const socket = io({
        transports: ["polling"],
        auth: (callback) => {
            callback({ token: localStorage.getItem("access_token") });
        }
    });

    socket.on("connect", () => {

        console.log("Socket.IO connecté");

        socket.emit("room:join", {
            room_code: roomCode
        });
    });

    socket.on("room:joined", (data) => {

        console.log(
            "Salle Socket.IO rejointe :",
            data.room_code
        );
    });

    socket.on("room:update", (data) => {

        console.log(
            "Mise à jour de la salle reçue :",
            data
        );

        if (typeof onRoomUpdate === "function") {
            onRoomUpdate(data);
        }
    });

    socket.on("game:state", (state) => {

        console.log(
            "GAME STATE SOCKET :",
            state
        );

        console.log(
            "MAIN SOCKET :",
            state?.your_hand?.length ?? "absente"
        );

        if (typeof onState === "function") {
            onState(state);
        }
    });

    socket.on("chat:message", (data) => {

        console.log(
            "Message chat reçu :",
            data
        );

        if (typeof onChatMessage === "function") {
            onChatMessage(data);
        }
    });

    socket.on("chat:error", (data) => {

        console.error(
            "Erreur chat :",
            data.error
        );

        showToast(
            data.error || "Erreur du chat"
        );
    });

    socket.on("connect_error", (error) => {

        console.error(
            "Erreur Socket.IO",
            error
        );

        showToast(
            "Connexion temps réel impossible"
        );
    });

    socket.on("disconnect", () => {

        console.log(
            "Socket.IO déconnecté"
        );
    });

    socket.on("chat:history", (data) => {
        console.log(
            "Historique du chat reçu :",
            data
        );

        if (typeof onChatHistory === "function") {
            onChatHistory(data.messages || []);
        }
    });

    return socket;
}