// Game Platform — connexion compatible avec gp-language.js et LOGIN_T optionnel.
(() => {
  const form = document.getElementById('login-form');
  const password = document.getElementById('password');
  const toggle = document.getElementById('password-toggle');
  const submit = document.getElementById('login-submit');
  const feedback = document.getElementById('login-feedback');
  if (!form || !password || !submit || !feedback) return;

  const translations = {
    fr: {submit:'Se connecter', loading:'Connexion en cours...', error:'Identifiants incorrects ou connexion refusée.', networkError:'Impossible de contacter le serveur.', showPassword:'Afficher le mot de passe', hidePassword:'Masquer le mot de passe'},
    en: {submit:'Log in', loading:'Signing in...', error:'Incorrect credentials or sign-in failed.', networkError:'Unable to contact the server.', showPassword:'Show password', hidePassword:'Hide password'},
    de: {submit:'Anmelden', loading:'Anmeldung läuft...', error:'Falsche Zugangsdaten oder Anmeldung fehlgeschlagen.', networkError:'Server nicht erreichbar.', showPassword:'Passwort anzeigen', hidePassword:'Passwort verbergen'},
    es: {submit:'Iniciar sesión', loading:'Iniciando sesión...', error:'Credenciales incorrectas o error de acceso.', networkError:'No se puede conectar al servidor.', showPassword:'Mostrar contraseña', hidePassword:'Ocultar contraseña'}
  };
  function t() {
    let language = 'fr';
    try { language = localStorage.getItem('gp_language') || document.documentElement.lang || navigator.language.slice(0, 2); } catch (_) {}
    const fallback = translations[language] || translations.fr;
    return {...fallback, ...(window.LOGIN_T && typeof window.LOGIN_T === 'object' ? window.LOGIN_T : {})};
  }
  if (toggle) toggle.addEventListener('click', () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', visible ? t().hidePassword : t().showPassword);
  });

  let busy = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const originalText = submit.textContent;
    submit.disabled = true;
    submit.textContent = t().loading;
    feedback.hidden = true;
    try {
      const username = document.getElementById('username');
      if (!username) throw new Error('Champ username introuvable');
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Accept':'application/json'},
        body: JSON.stringify({username: username.value.trim(), password: password.value})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token || !data.refresh_token || !data.user) {
        feedback.textContent = (typeof data.message === 'string' && data.message) || (typeof data.error === 'string' && data.error) || t().error;
        feedback.hidden = false;
        return;
      }
      const remember = document.getElementById('remember');
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('auth_remember', remember && remember.checked ? 'yes' : 'no');
      sessionStorage.setItem('auth_browser_session', 'active');
      location.replace('/lobby');
    } catch (error) {
      console.error('Erreur de connexion Game Platform :', error);
      feedback.textContent = t().networkError;
      feedback.hidden = false;
    } finally {
      busy = false;
      submit.disabled = false;
      // Le texte reste cohérent avec la langue choisie, même après une erreur.
      submit.textContent = t().submit || originalText;
    }
  });
})();