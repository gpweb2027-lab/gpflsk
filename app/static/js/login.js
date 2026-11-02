// API existante : POST /api/auth/login, sans changement côté Flask.
const loginForm = document.getElementById('login-form');
const loginPassword = document.getElementById('password');
const passwordToggle = document.getElementById('password-toggle');
passwordToggle.addEventListener('click', () => {
  const visible = loginPassword.type === 'password';
  loginPassword.type = visible ? 'text' : 'password';
  passwordToggle.setAttribute('aria-pressed', String(visible));
  passwordToggle.setAttribute('aria-label', visible ? window.LOGIN_T.hidePassword : window.LOGIN_T.showPassword);
});
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = document.getElementById('login-submit');
  const feedback = document.getElementById('login-feedback');
  const t = window.LOGIN_T;
  submit.disabled = true;
  submit.textContent = t.loading;
  feedback.hidden = true;
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({username: document.getElementById('username').value.trim(), password: loginPassword.value})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token || !data.refresh_token || !data.user) {
      feedback.textContent = t.error;
      feedback.hidden = false;
      return;
    }
    const remember = document.getElementById('remember').checked;
    // Compatibilité avec dashboard.js, socket.js et les autres scripts existants.
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('auth_remember', remember ? 'yes' : 'no');
    sessionStorage.setItem('auth_browser_session', 'active');
    location.replace('/lobby');
  } catch (_) {
    feedback.textContent = t.networkError;
    feedback.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = t.submit;
  }
});