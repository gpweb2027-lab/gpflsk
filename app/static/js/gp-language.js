/* Game Platform — traduction front-end. Ajouter ce fichier dans static/js/. */
(() => {
  const supported = ['fr','en','de','es'];
  const dictionaries = {
    fr: {title:'Rejoins l’aventure',subtitle:'Commence gratuitement en quelques secondes.',username:'Nom d’utilisateur',usernameHint:'Ton identifiant pour te connecter.',usernamePH:'Choisis ton nom d’utilisateur',pseudo:'Pseudo',pseudoHint:"C’est le nom que verront les autres joueurs.",pseudoPH:'Choisis ton pseudo public',email:'Adresse e-mail',password:'Mot de passe',passwordPH:'6 caractères minimum',confirm:'Confirme ton mot de passe',confirmPH:'Répète ton mot de passe',strengthHint:'Utilise un mot de passe sécurisé.',weak:'Mot de passe faible',medium:'Mot de passe correct',strong:'Mot de passe fort',submit:'Créer mon compte',already:'Tu as déjà un compte ?',login:'Se connecter',security:'Tes informations sont protégées et ne sont jamais affichées publiquement.',mismatch:'Les mots de passe ne correspondent pas.',creating:'Création du compte...',success:'Compte créé ! Tu peux maintenant te connecter.',serverError:'Erreur de connexion au serveur.',games:'Jeux disponibles',languages:'Apprendre des langues',friends:'Mes amis',requests:'Demandes d’amis',groups:'Groupes d’amis'},
    en: {title:'Join the adventure',subtitle:'Get started for free in seconds.',username:'Username',usernameHint:'Your username for signing in.',usernamePH:'Choose your username',pseudo:'Nickname',pseudoHint:'This is the name other players will see.',pseudoPH:'Choose your public nickname',email:'Email address',password:'Password',passwordPH:'At least 6 characters',confirm:'Confirm your password',confirmPH:'Repeat your password',strengthHint:'Use a secure password.',weak:'Weak password',medium:'Fair password',strong:'Strong password',submit:'Create my account',already:'Already have an account?',login:'Log in',security:'Your information is protected and is never displayed publicly.',mismatch:'Passwords do not match.',creating:'Creating your account...',success:'Account created! You can now log in.',serverError:'Could not connect to the server.',games:'Available games',languages:'Learn languages',friends:'My friends',requests:'Friend requests',groups:'Friend groups'},
    de: {title:'Starte dein Abenteuer',subtitle:'Erstelle in wenigen Sekunden kostenlos dein Konto.',username:'Benutzername',usernameHint:'Dein Benutzername zum Anmelden.',usernamePH:'Wähle deinen Benutzernamen',pseudo:'Spielername',pseudoHint:'Diesen Namen sehen andere Spieler.',pseudoPH:'Wähle deinen öffentlichen Spielernamen',email:'E-Mail-Adresse',password:'Passwort',passwordPH:'Mindestens 6 Zeichen',confirm:'Passwort bestätigen',confirmPH:'Passwort wiederholen',strengthHint:'Verwende ein sicheres Passwort.',weak:'Schwaches Passwort',medium:'Mittleres Passwort',strong:'Starkes Passwort',submit:'Konto erstellen',already:'Du hast bereits ein Konto?',login:'Anmelden',security:'Deine Daten sind geschützt und werden nicht öffentlich angezeigt.',mismatch:'Die Passwörter stimmen nicht überein.',creating:'Konto wird erstellt...',success:'Konto erstellt! Du kannst dich jetzt anmelden.',serverError:'Verbindung zum Server fehlgeschlagen.',games:'Verfügbare Spiele',languages:'Sprachen lernen',friends:'Meine Freunde',requests:'Freundschaftsanfragen',groups:'Freundesgruppen'},
    es: {title:'Únete a la aventura',subtitle:'Crea tu cuenta gratis en unos segundos.',username:'Nombre de usuario',usernameHint:'Tu usuario para iniciar sesión.',usernamePH:'Elige tu nombre de usuario',pseudo:'Apodo',pseudoHint:'Es el nombre que verán los demás jugadores.',pseudoPH:'Elige tu apodo público',email:'Correo electrónico',password:'Contraseña',passwordPH:'Mínimo 6 caracteres',confirm:'Confirma tu contraseña',confirmPH:'Repite tu contraseña',strengthHint:'Usa una contraseña segura.',weak:'Contraseña débil',medium:'Contraseña aceptable',strong:'Contraseña segura',submit:'Crear mi cuenta',already:'¿Ya tienes una cuenta?',login:'Iniciar sesión',security:'Tus datos están protegidos y nunca se muestran públicamente.',mismatch:'Las contraseñas no coinciden.',creating:'Creando cuenta...',success:'¡Cuenta creada! Ya puedes iniciar sesión.',serverError:'Error de conexión con el servidor.',games:'Juegos disponibles',languages:'Aprender idiomas',friends:'Mis amigos',requests:'Solicitudes de amistad',groups:'Grupos de amigos'}
  };
  const browserLanguage = (navigator.languages?.[0] || navigator.language || 'fr').slice(0,2).toLowerCase();
  let saved;
  try { saved = localStorage.getItem('gp_language'); } catch (_) {}
  let language = supported.includes(saved) ? saved : (supported.includes(browserLanguage) ? browserLanguage : 'en');
  window.gpT = key => (dictionaries[language] || dictionaries.fr)[key] || dictionaries.fr[key] || key;
  window.gpLanguage = () => language;
  const label = (selector, key) => { const node=document.querySelector(selector); if(node) node.textContent=window.gpT(key); };
  const placeholder = (selector,key) => { const node=document.querySelector(selector); if(node) node.placeholder=window.gpT(key); };
  function apply() {
    document.documentElement.lang=language;
    if(document.getElementById('login-form')) {
      const loginText = {
        fr: {title:'Connecte-toi',subtitle:'Retrouve ta communauté et continue ton aventure.',username:'Nom d’utilisateur',usernamePlaceholder:'Ton nom d’utilisateur',password:'Mot de passe',passwordPlaceholder:'Ton mot de passe',remember:'Se souvenir de moi',submit:'Se connecter',noAccount:'Pas encore de compte ?',register:'Créer un compte',showPassword:'Afficher le mot de passe',hidePassword:'Masquer le mot de passe'},
        en: {title:'Log in',subtitle:'Reconnect with your community and continue your adventure.',username:'Username',usernamePlaceholder:'Your username',password:'Password',passwordPlaceholder:'Your password',remember:'Remember me',submit:'Log in',noAccount:'No account yet?',register:'Create an account',showPassword:'Show password',hidePassword:'Hide password'},
        de: {title:'Anmelden',subtitle:'Triff deine Community wieder und setze dein Abenteuer fort.',username:'Benutzername',usernamePlaceholder:'Dein Benutzername',password:'Passwort',passwordPlaceholder:'Dein Passwort',remember:'Angemeldet bleiben',submit:'Anmelden',noAccount:'Noch kein Konto?',register:'Konto erstellen',showPassword:'Passwort anzeigen',hidePassword:'Passwort verbergen'},
        es: {title:'Iniciar sesión',subtitle:'Vuelve a tu comunidad y continúa tu aventura.',username:'Nombre de usuario',usernamePlaceholder:'Tu nombre de usuario',password:'Contraseña',passwordPlaceholder:'Tu contraseña',remember:'Recordarme',submit:'Iniciar sesión',noAccount:'¿Todavía no tienes cuenta?',register:'Crear una cuenta',showPassword:'Mostrar contraseña',hidePassword:'Ocultar contraseña'}
      }[language];
      document.querySelectorAll('#login-form [data-i18n], .login-intro [data-i18n], .login-register [data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if(loginText[key]) el.textContent = loginText[key];
      });
      document.querySelectorAll('#login-form [data-i18n-placeholder]').forEach(el => {
        const value = loginText[el.dataset.i18nPlaceholder];
        if(value) el.placeholder = value;
      });
      const toggle = document.getElementById('password-toggle');
      if(toggle) toggle.setAttribute('aria-label', loginText[toggle.getAttribute('aria-pressed') === 'true' ? 'hidePassword' : 'showPassword']);
    }
    if(document.getElementById('register-form')) {
      label('[data-gp-i18n="title"]','title');
      label('.auth-card-heading p','subtitle');
      for(const [id,key] of [['username','username'],['pseudo','pseudo'],['email','email'],['password','password'],['confirm-password','confirm']]) label(`label[for="${id}"]`,key);
      label('#username + small','usernameHint');
      const groups=document.querySelectorAll('.auth-form .form-group');
      if(groups[0]) { const h=groups[0].querySelector('.input-help'); if(h) h.textContent=window.gpT('usernameHint'); }
      if(groups[1]) { const h=groups[1].querySelector('.input-help'); if(h) h.textContent=window.gpT('pseudoHint'); }
      placeholder('#username','usernamePH');placeholder('#pseudo','pseudoPH');placeholder('#password','passwordPH');placeholder('#confirm-password','confirmPH');
      label('#password-strength-text','strengthHint');
      label('#register-submit span:first-child','submit');
      const bottom=document.querySelector('.auth-bottom-link'); if(bottom) { const link=bottom.querySelector('a'); bottom.replaceChildren(document.createTextNode(window.gpT('already')+' ')); if(link) {link.textContent=window.gpT('login');bottom.appendChild(link);} }
      label('.security-message span','security');
    }
    if(document.querySelector('.app-layout')) {
      label('.section-title h2','games');label('.language-title h2','languages');
      for(const [id,key] of [['social-friends-title','friends'],['social-requests-title','requests'],['social-groups-title','groups']]) {
        const h=document.getElementById(id); if(h && h.firstChild?.nodeType===Node.TEXT_NODE) h.firstChild.textContent=window.gpT(key)+' (';
      }
    }
    const selector=document.getElementById('gp-language-select'); if(selector) selector.value=language;
  }
  window.gpSetLanguage = next => {
    if(!supported.includes(next)) return;
    language=next;
    try {localStorage.setItem('gp_language',next);} catch (_) {}
    apply();
    document.dispatchEvent(new CustomEvent('gp-language-changed', {detail:{language}}));
  };
  document.addEventListener('DOMContentLoaded', () => {
    const select=document.createElement('select'); select.id='gp-language-select'; select.setAttribute('aria-label','Language / Langue');
    for(const [code,name] of [['fr','🇫🇷 Français'],['en','🇬🇧 English'],['de','🇩🇪 Deutsch'],['es','🇪🇸 Español']]) {const option=document.createElement('option');option.value=code;option.textContent=name;select.appendChild(option);}
    select.style.cssText='position:fixed;right:16px;bottom:16px;z-index:1000;background:#1d2440;color:white;border:1px solid #646d9a;border-radius:10px;padding:8px 10px;max-width:145px;';
    select.addEventListener('change',e=>window.gpSetLanguage(e.target.value));
    document.body.appendChild(select);
    apply();
  });
})();