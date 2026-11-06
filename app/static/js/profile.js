
(function () {
  const css = '/static/css/profile.css';
  if (!document.querySelector('link[href="' + css + '"]')) {
    const link = document.createElement('link'); link.rel='stylesheet'; link.href=css; document.head.appendChild(link);
  }
  const modal = document.createElement('div');
  modal.id='full-profile-overlay'; modal.hidden=true;
  modal.innerHTML=`<section class="full-profile-card" role="dialog" aria-modal="true" aria-label="Profil du joueur">
    <button class="full-profile-close" type="button" aria-label="Fermer">×</button>
      <div class="full-profile-banner"><button class="full-profile-banner-plus" type="button" aria-label="Modifier la bannière" title="Modifier la bannière" hidden>+</button></div><div class="full-profile-main">
      <div class="full-profile-identity"><div class="full-profile-avatar-wrap"><div class="full-profile-avatar"></div><button class="full-profile-avatar-plus" type="button" aria-label="Modifier la photo de profil" title="Modifier la photo de profil" hidden>+</button></div>
      <button class="full-profile-name" type="button" title="Modifier mon pseudo"></button>
      <button class="full-profile-bio" type="button" title="Modifier mon message personnel"></button></div><div class="full-profile-meta"></div>
      <div class="full-profile-stats"></div><div class="full-profile-actions"></div>
      <form class="full-profile-edit" hidden>
        <label>Pseudo <input name="pseudo" maxlength="50" minlength="3" required></label>
        <label>Message personnel <textarea name="bio" maxlength="300"></textarea></label>
        <label>Pays (code ISO, ex. FR) <input name="country_code" maxlength="2" pattern="[a-zA-Z]{2}"></label>
        <label>Fuseau horaire <input name="timezone" maxlength="64" placeholder="Europe/Paris"></label>
        <label><input type="checkbox" name="show_location"> Afficher mon drapeau, pays et heure locale</label>
        <label><input type="checkbox" name="show_stats"> Afficher mes statistiques</label>
        <label><input type="checkbox" name="show_coins"> Afficher mes coins</label>
        <label>Bannière <input type="file" name="banner" accept="image/png,image/jpeg,image/webp"></label>
        <button type="submit">Enregistrer</button><span class="full-profile-feedback" role="status"></span>
      </form>
    </div></section>`;
  document.body.appendChild(modal);
  const $ = selector => modal.querySelector(selector);
  const token = () => localStorage.getItem('access_token');
  const selfId = () => {
    try {
      return Number(JSON.parse(localStorage.getItem('user') || '{}').id); } catch { return 0; } };
  const countryName = code => { try { return new Intl.DisplayNames(['fr'], {type:'region'}).of(code) || code; } catch { return code; } };
  const flag = code => /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0))) : '';
  const request = async (url, options={}) => {
  const response = await fetch(url, {...options, headers:{Authorization:'Bearer '+token(), ...(options.headers || {})}});
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch {
    throw Error(`Le serveur a renvoyé une page non JSON (HTTP ${response.status}) pour ${url}. Vérifie la route Flask et les journaux du serveur.`);
  }
  if (!response.ok) throw Error(data.error || data.message || `Erreur HTTP ${response.status} sur ${url}`);
      return data;
  };
    const clear = el => el.replaceChildren();
   const saveQuickField = async (field, value, id) => {
    await request('/api/users/profile/me', {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({[field]:value})});
    if (field === 'pseudo') {
      try { const u=JSON.parse(localStorage.getItem('user')||'{}'); u.pseudo=value; localStorage.setItem('user',JSON.stringify(u)); } catch {}
    }
    await open(id);
  };
  function enableInlineEdit(node, field, initial, id) {
    node.onclick = () => {
       const editor = document.createElement(field === 'bio' ? 'textarea' : 'input');
      editor.className = 'full-profile-inline-input';
      editor.value = initial || '';
      editor.maxLength = field === 'bio' ? 300 : 50;
      editor.setAttribute('aria-label', field === 'bio' ? 'Modifier mon message personnel' : 'Modifier mon pseudo');
      const panel = document.createElement('div');
      panel.className = 'full-profile-quick-edit';
      const controls = document.createElement('div');
      controls.className = 'full-profile-quick-actions';
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button'; saveBtn.textContent = 'Enregistrer';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button'; cancelBtn.textContent = 'Annuler';
      cancelBtn.className = 'full-profile-cancel';
      controls.append(saveBtn, cancelBtn);
      panel.append(editor, controls);
      node.hidden = true;
      node.insertAdjacentElement('afterend', panel);
      const cancel = () => { panel.remove(); node.hidden = false; };
      const save = async () => {
        const value = editor.value.trim();
        if (field === 'pseudo' && (value.length < 3 || value.length > 50)) {
          alert('Pseudo : 3 à 50 caractères'); editor.focus(); return;
        }
        saveBtn.disabled = true;
        try { await saveQuickField(field, value, id); }
        catch (e) { saveBtn.disabled = false; alert(e.message); editor.focus(); }
      };
      saveBtn.onclick = save;
      cancelBtn.onclick = cancel;
      editor.onkeydown = e => {
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        if (e.key === 'Enter' && (field === 'pseudo' || e.ctrlKey)) {
          e.preventDefault(); save();
        }
      };
      editor.focus();
      editor.select();
    };
  }
  const text = (parent, tag, content) => {const node=document.createElement(tag); node.textContent=content; parent.appendChild(node); return node;};
  async function open(playerId) {
    const id=Number(playerId);
    if (!Number.isInteger(id) || id<=0) return;
    modal.hidden=false;
    $('.full-profile-name').textContent='Chargement...';
    try {
      const {profile:v}=await request('/api/users/profile/'+id);
      const displayName = v.pseudo?.trim() || v.username || "Joueur";
      if (modal.hidden) return;
      $('.full-profile-name').textContent=displayName;
      $('.full-profile-bio').textContent=v.bio || 'Ajouter un message personnel…';
      const isOwner = Boolean(v.is_owner || id === selfId());
      modal.querySelectorAll('.full-profile-quick-edit').forEach(el => el.remove());
      $('.full-profile-name').hidden = false;
      $('.full-profile-bio').hidden = false;
      $('.full-profile-name').disabled=!isOwner;
      $('.full-profile-bio').disabled=!isOwner;
      $('.full-profile-name').onclick=null;
      $('.full-profile-bio').onclick=null;
      $('.full-profile-banner-plus').hidden=!isOwner;
      $('.full-profile-avatar-plus').hidden=!isOwner;
      if(isOwner){
        enableInlineEdit($('.full-profile-name'),'pseudo',v.pseudo || v.username,id);
        enableInlineEdit($('.full-profile-bio'),'bio',v.bio || '',id);
      }
      const banner=$('.full-profile-banner'); banner.style.backgroundImage=v.banner_url ? `url("${encodeURI(v.banner_url)}")` : '';
      const avatar=$('.full-profile-avatar'); clear(avatar);
      if (v.avatar_url) { const img=document.createElement('img'); img.src=v.avatar_url; img.alt=''; avatar.appendChild(img); }
      else avatar.textContent=displayName.slice(0,1).toUpperCase();
       // Bandeau de statistiques : trois chiffres, sans les anciennes lignes de texte.
      const meta=$('.full-profile-meta'); clear(meta);
      const stats=$('.full-profile-stats'); clear(stats);
      stats.classList.add('full-profile-stats-grid');
      const addStat=(label,value)=>{
        const item=document.createElement('div'); item.className='full-profile-stat-item';
        text(item,'span',label).className='full-profile-stat-label';
        text(item,'strong',value).className='full-profile-stat-value';
        stats.appendChild(item);
      };
      const privacy=v.privacy || {};
      const showStats=privacy.show_stats !== false;
      const showCoins=privacy.show_coins !== false;
      addStat('VICTOIRES',showStats && v.stats?.wins != null ? String(v.stats.wins) : '—');
      addStat('ÂGE DU COMPTE',v.account_days != null ? `${v.account_days} j` : '—');
      addStat('COINS',showCoins && v.coins != null ? String(v.coins) : '—');
      const actions=$('.full-profile-actions'); clear(actions);
       const form=$('.full-profile-edit'); form.hidden=!isOwner;
      if (isOwner) {
        form.elements.pseudo.value=v.pseudo || "";
        form.elements.bio.value=v.bio || '';
        form.elements.country_code.value=v.country_code || ''; form.elements.timezone.value=v.timezone || '';
        ['show_location','show_stats','show_coins'].forEach(key=>form.elements[key].checked=!!v.privacy?.[key]);
        const openAvatarEditor=()=>{
          const header=document.getElementById('header-avatar-btn');
          if(header){modal.hidden=true;window.__profileAvatarEditOnce=true;header.click();}
          else {const avatarModal=document.getElementById('avatar-modal');if(avatarModal)avatarModal.removeAttribute('hidden');else alert('Éditeur d’avatar indisponible sur cette page.');}
        };
        $('.full-profile-avatar-plus').onclick=openAvatarEditor;
        $('.full-profile-banner-plus').onclick=()=>form.elements.banner.click();
        form.elements.banner.onchange=async()=>{
          const file=form.elements.banner.files[0];if(!file)return;
          const data=new FormData();data.append('banner',file);
          try{await request('/api/auth/banner',{method:'POST',body:data});await open(id);}catch(e){alert('Impossible de modifier la bannière : '+e.message);}finally{form.elements.banner.value='';}
        };
        const settingsBtn=document.createElement('button');
        settingsBtn.type='button';settingsBtn.className='full-profile-settings';
        settingsBtn.textContent='⚙ Paramètres';
        settingsBtn.onclick=()=>{form.hidden=!form.hidden;settingsBtn.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)form.scrollIntoView({behavior:'smooth',block:'nearest'});};
        settingsBtn.setAttribute('aria-expanded','false');
        actions.appendChild(settingsBtn);
         // Déconnexion accessible depuis son propre profil.
        const logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.textContent = '⏻ Se déconnecter';
        logoutBtn.className = 'full-profile-logout';
        logoutBtn.addEventListener('click', () => {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          localStorage.removeItem('auth_remember');
          sessionStorage.removeItem('auth_browser_session');
          sessionStorage.removeItem('profile-tz-sent');
          window.location.replace('/login');
        });
        actions.appendChild(logoutBtn);
      form.hidden=true;
      } else {
        $('.full-profile-avatar-plus').onclick=null;$('.full-profile-banner-plus').onclick=null;
        const add=document.createElement('button'); add.type='button'; add.textContent='🤝 Ajouter en ami';
        add.onclick=async()=>{try{await request('/api/users/friends/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiver_id:id})});add.textContent='✓ Demande envoyée';add.disabled=true;}catch(e){alert(e.message);}};
        actions.appendChild(add);
      }
      form.onsubmit=async event=>{
        event.preventDefault(); const feedback=$('.full-profile-feedback'); feedback.textContent='Enregistrement...';
        try {
          const payload={
            pseudo:form.elements.pseudo.value.trim(),bio:form.elements.bio.value,
            country_code:form.elements.country_code.value || null,timezone:form.elements.timezone.value || null};
          ['show_location','show_stats','show_coins'].forEach(k=>payload[k]=form.elements[k].checked);
          await request('/api/users/profile/me',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          // La bannière est enregistrée directement depuis son bouton +.
          try {
            const u=JSON.parse(localStorage.getItem('user')||'{}');
            u.pseudo = payload.pseudo;
            localStorage.setItem('user',JSON.stringify(u));
          }catch{}
          feedback.textContent='Profil enregistré'; await open(id);
        }catch(e){feedback.textContent=e.message;}
      };
    } catch(e) { $('.full-profile-name').textContent=e.message; }
  }
  $('.full-profile-close').onclick=()=>modal.hidden=true;
  modal.onclick=e=>{if(e.target===modal) modal.hidden=true;};
  document.addEventListener('keydown',e=>{if(e.key==='Escape') modal.hidden=true;});
  window.openFullPlayerProfile=open;
  // Capture timezone from browser on the first authenticated visit (no location permission required).
  if(token() && selfId()) {
    const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
    if(tz && !sessionStorage.getItem('profile-tz-sent')) {
      request('/api/users/profile/'+selfId()).then(({profile})=>{
        if(!profile.timezone) return request('/api/users/profile/me',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({timezone:tz})});
      }).then(()=>sessionStorage.setItem('profile-tz-sent','1')).catch(()=>{});
    }
  }
})();