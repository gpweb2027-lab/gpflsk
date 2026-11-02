// Mode non persistant : les autres scripts utilisent encore localStorage.
// Une nouvelle session de navigateur sans marqueur invalide donc les jetons locaux.
if (localStorage.getItem('auth_remember') === 'no' &&
    sessionStorage.getItem('auth_browser_session') !== 'active') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_remember');
}

// Gestion centralisée des requêtes API et du renouvellement JWT.
let authSessionExpired = false;
let authRefreshInFlight = null;

function clearAuthSession() {
    if (authSessionExpired) return;
    authSessionExpired = true;
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    localStorage.removeItem("auth_remember");
    sessionStorage.removeItem("auth_browser_session");
    document.dispatchEvent(new Event("auth:expired"));
    showToast("Session expirée. Veuillez vous reconnecter.");
}

function jwtExpirySeconds(token) {
    try {
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(atob(payload)).exp || 0;
    } catch (_) { return 0; }
}

async function refreshAccessToken() {
    if (authSessionExpired) return false;
    if (authRefreshInFlight) return authRefreshInFlight;
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return false;
    authRefreshInFlight = (async () => {
        try {
            const response = await fetch("/api/auth/refresh", {
                method: "POST",
                headers: { "Authorization": `Bearer ${refreshToken}` }
            });
            if (!response.ok) return false;
            const data = await response.json();
            if (!data.access_token) return false;
            localStorage.setItem("access_token", data.access_token);
            // Une connexion Socket.IO déjà authentifiée conserve son ancien jeton :
            // une reconnexion utilisera la nouvelle valeur depuis localStorage.
            return true;
        } catch (_) { return false; }
    })();
    try { return await authRefreshInFlight; }
    finally { authRefreshInFlight = null; }
}

async function api(url, options = {}) {
        if (authSessionExpired && !url.startsWith("/api/auth/login")) {
        return { ok: false, data: { error: "Session expirée" }, status: 401 };
    }
    const isAuthEndpoint = url.startsWith("/api/auth/");
    if (!isAuthEndpoint) {
        const token = localStorage.getItem("access_token");
        if (token && jwtExpirySeconds(token) - Date.now() / 1000 < 120) {
            await refreshAccessToken();
        }
    }
    async function send() {
        const headers = { ...(options.headers || {}) };
        headers["Content-Type"] = "application/json";
        const token = localStorage.getItem("access_token");
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const request = { ...options, headers };
        if (request.body && typeof request.body !== "string") {
            request.body = JSON.stringify(request.body);
        }
        return fetch(url, request);
    }
    try {
        let response = await send();
        if (response.status === 401 && !isAuthEndpoint) {
            if (await refreshAccessToken()) response = await send();
            else { clearAuthSession(); return { ok: false, data: { error: "Session expirée" }, status: 401 }; }
        }
        const text = await response.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; }
        catch (_) { data = { error: `Réponse serveur invalide (HTTP ${response.status})` }; }
        if (!response.ok) {
            if (response.status === 401 && !isAuthEndpoint) clearAuthSession();
            else showToast(data.error || `Erreur HTTP ${response.status}`);
            return { ok: false, data, status: response.status };
        }
        return { ok: true, data, status: response.status };
    } catch (error) {
        showToast("Impossible de contacter le serveur.");
        return { ok: false, data: {}, status: 0 };
    }
}

function requireAuth() {
    if (!localStorage.getItem("access_token")) location.href = "/login";
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3000);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("access_token");
    const login = document.getElementById("login-link");
    const register = document.getElementById("register-link");
    const logout = document.getElementById("logout-btn");
    if (token) {
        login?.classList.add("hidden");
        register?.classList.add("hidden");
        logout?.classList.remove("hidden");
    }
    logout?.addEventListener("click", () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        localStorage.removeItem("auth_remember");
        sessionStorage.removeItem("auth_browser_session");
        location.href = "/login";
    });
    // Entretien de session tant que l'onglet est ouvert.
    if (token) setInterval(async () => {
        if (authSessionExpired) return;
        const current = localStorage.getItem("access_token");
        if (!current) return;
        if (jwtExpirySeconds(current) - Date.now() / 1000 < 120) {
            if (!await refreshAccessToken()) clearAuthSession();
        }
    }, 60000);
});
