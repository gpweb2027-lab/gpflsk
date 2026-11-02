
(function () {
  const css = '/static/css/profile.css';
  if (!document.querySelector('link[href="' + css + '"]')) {
    const link = document.createElement('link'); link.rel='stylesheet'; link.href=css; document.head.appendChild(link);
  }
  const modal = document.createElement('div');
  modal.id='full-profile-overlay'; modal.hidden=true;
  modal.innerHTML=`<section class="full-profile-card" role="dialog" aria-modal="true" aria-label="Profil du joueur">
    <button class="full-profile-close" type="button" aria-label="Fermer">×</button>
    <div class="full-profile-banner"></div><div class="full-profile-main">
      <div class="full-profile-avatar"></div><h2 class="full-profile-name"></h2>
      <p class="full-profile-bio"></p><div class="full-profile-meta"></div>
      <div class="full-profile-stats"></div><div class="full-profile-actions"></div>
      <form class="full-profile-edit" hidden>
        <label>Pseudo <input name="username" maxlength="50" minlength="3" required></label>
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
  const selfId = () => { try { return Number(JSON.parse(localStorage.getItem('user') || '{}').id); } catch { return 0; } };
  const countryName = code => { try { return new Intl.DisplayNames(['fr'], {type:'region'}).of(code) || code; } catch { return code; } };
  const flag = code => /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0))) : '';
  const request = async (url, options={}) => {
  const response = await fetch(url, {...options, headers:{Authorization:'Bearer '+token(), ...(options.headers || {})}});
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Erreur réseau');
    return data;
  };
  const clear = el => el.replaceChildren();
  const text = (parent, tag, content) => {const node=document.createElement(tag); node.textContent=content; parent.appendChild(node); return node;};
  async function open(playerId) {
    const id=Number(playerId); if (!Number.isInteger(id) || id<=0) return;
    modal.hidden=false; $('.full-profile-name').textContent='Chargement...';
    try {
      const {profile:v}=await request('/api/users/profile/'+id);
      if (modal.hidden) return;
      $('.full-profile-name').textContent=v.username;
      $('.full-profile-bio').textContent=v.bio || '';
      const banner=$('.full-profile-banner'); banner.style.backgroundImage=v.banner_url ? `url("${encodeURI(v.banner_url)}")` : '';
      const avatar=$('.full-profile-avatar'); clear(avatar);
      if (v.avatar_url) { const img=document.createElement('img'); img.src=v.avatar_url; img.alt=''; avatar.appendChild(img); }
      else avatar.textContent=v.username.slice(0,1).toUpperCase();
      const meta=$('.full-profile-meta'); clear(meta);
      if (v.account_days !== null) text(meta,'span',`Compte créé il y a ${v.account_days} jour(s)`);
      if (v.country_code) {
        let location=flag(v.country_code)+' '+countryName(v.country_code);
        if (v.timezone) { try { location+=' · '+new Intl.DateTimeFormat('fr-FR',{timeZone:v.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date()); } catch {} }
        text(meta,'span',location);
      } else if (v.timezone) {
        try { text(meta,'span',new Intl.DateTimeFormat('fr-FR',{timeZone:v.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date())); } catch {}
      }
      if (v.coins !== undefined) text(meta,'span',`${v.coins} coins`);
      const stats=$('.full-profile-stats'); clear(stats);
      if (v.stats) text(stats,'p',`Président · ${v.stats.played} parties · ${v.stats.wins} victoires · ${v.stats.losses} défaites · ${v.stats.win_rate}% de victoires`);
      const actions=$('.full-profile-actions'); clear(actions);
      const form=$('.full-profile-edit'); form.hidden=!v.is_owner;
      if (v.is_owner) {
        form.elements.username.value=v.username; form.elements.bio.value=v.bio || '';
        form.elements.country_code.value=v.country_code || ''; form.elements.timezone.value=v.timezone || '';
        ['show_location','show_stats','show_coins'].forEach(key=>form.elements[key].checked=!!v.privacy[key]);
        const avatarBtn=document.createElement('button'); avatarBtn.type='button'; avatarBtn.textContent='Modifier mon avatar';
        avatarBtn.onclick=()=>document.getElementById('avatar-modal')?.removeAttribute('hidden');
        // Dashboard's existing avatar modal is controlled by its own handler.
        if (document.getElementById('header-avatar-btn')) avatarBtn.onclick=()=>{modal.hidden=true; window.__profileAvatarEditOnce=true; document.getElementById('header-avatar-btn').click();};
        actions.appendChild(avatarBtn);
         // Déconnexion accessible depuis son propre profil.
        const logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.textContent = '⏻ Se déconnecter';
        logoutBtn.className = 'full-profile-logout';
        logoutBtn.style.cssText = 'background:#9f3045;color:#fff;border:1px solid #d4556a;border-radius:9px;padding:10px 15px;cursor:pointer;';
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
      } else {
        const add=document.createElement('button'); add.type='button'; add.textContent='🤝 Ajouter en ami';
        add.onclick=async()=>{try{await request('/api/users/friends/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiver_id:id})});add.textContent='✓ Demande envoyée';add.disabled=true;}catch(e){alert(e.message);}};
        actions.appendChild(add);
      }
      form.onsubmit=async event=>{
        event.preventDefault(); const feedback=$('.full-profile-feedback'); feedback.textContent='Enregistrement...';
        try {
          const payload={username:form.elements.username.value,bio:form.elements.bio.value,
            country_code:form.elements.country_code.value || null,timezone:form.elements.timezone.value || null};
          ['show_location','show_stats','show_coins'].forEach(k=>payload[k]=form.elements[k].checked);
          await request('/api/users/profile/me',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          const file=form.elements.banner.files[0];
          if(file){const data=new FormData();data.append('banner',file);await request('/api/auth/banner',{method:'POST',body:data});}
          try {const u=JSON.parse(localStorage.getItem('user')||'{}');u.username=payload.username;localStorage.setItem('user',JSON.stringify(u));}catch{}
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