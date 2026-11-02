// Localisation de la page de connexion. Ajouter d'autres langues ici.
window.LOGIN_TRANSLATIONS = {
  fr: { title: "Heureux de vous revoir", subtitle: "Connectez-vous pour retrouver vos parties.", username: "Nom d'utilisateur", usernamePlaceholder: "Votre nom d'utilisateur", password: "Mot de passe", passwordPlaceholder: "Votre mot de passe", submit: "Se connecter", loading: "Connexion…", noAccount: "Pas encore de compte ?", register: "Créer un compte", error: "Connexion impossible. Vérifiez vos identifiants.", networkError: "Serveur indisponible. Réessayez plus tard.", remember: "Rester connecté", showPassword: "Afficher le mot de passe", hidePassword: "Masquer le mot de passe" },
  en: { title: "Welcome back", subtitle: "Sign in to get back to your games.", username: "Username", usernamePlaceholder: "Your username", password: "Password", passwordPlaceholder: "Your password", submit: "Sign in", loading: "Signing in…", noAccount: "New here?", register: "Create an account", error: "Unable to sign in. Check your credentials.", networkError: "Server unavailable. Please try again later.", remember: "Keep me signed in", showPassword: "Show password", hidePassword: "Hide password" },
  de: { title: "Willkommen zurück", subtitle: "Melde dich an, um weiterzuspielen.", username: "Benutzername", usernamePlaceholder: "Dein Benutzername", password: "Passwort", passwordPlaceholder: "Dein Passwort", submit: "Anmelden", loading: "Anmeldung…", noAccount: "Noch kein Konto?", register: "Konto erstellen", error: "Anmeldung fehlgeschlagen. Prüfe deine Zugangsdaten.", networkError: "Server nicht erreichbar. Bitte später erneut versuchen.", remember: "Angemeldet bleiben", showPassword: "Passwort anzeigen", hidePassword: "Passwort verbergen" },
  es: { title: "¡Qué bueno verte de nuevo!", subtitle: "Inicia sesión para volver a tus partidas.", username: "Nombre de usuario", usernamePlaceholder: "Tu nombre de usuario", password: "Contraseña", passwordPlaceholder: "Tu contraseña", submit: "Iniciar sesión", loading: "Iniciando sesión…", noAccount: "¿Aún no tienes cuenta?", register: "Crear cuenta", error: "No se pudo iniciar sesión. Comprueba tus datos.", networkError: "Servidor no disponible. Inténtalo más tarde.", remember: "Mantener la sesión iniciada", showPassword: "Mostrar contraseña", hidePassword: "Ocultar contraseña" }
};
window.LOGIN_LANGUAGE = (() => {
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
  for (const locale of candidates) {
    const code = locale.toLowerCase().split('-')[0];
    if (Object.prototype.hasOwnProperty.call(window.LOGIN_TRANSLATIONS, code)) return code;
  }
  return 'en';
})();
window.LOGIN_T = window.LOGIN_TRANSLATIONS[window.LOGIN_LANGUAGE];
document.documentElement.lang = window.LOGIN_LANGUAGE;
for (const element of document.querySelectorAll('[data-i18n]')) {
  element.textContent = window.LOGIN_T[element.dataset.i18n] || '';
}
for (const element of document.querySelectorAll('[data-i18n-placeholder]')) {
  element.placeholder = window.LOGIN_T[element.dataset.i18nPlaceholder] || '';
}
for (const element of document.querySelectorAll('[data-i18n-aria]')) {
  element.setAttribute('aria-label', window.LOGIN_T[element.dataset.i18nAria] || '');
}