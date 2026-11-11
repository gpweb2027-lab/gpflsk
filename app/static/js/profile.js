
(function () {
  const css = '/static/css/profile.css';
  if (!document.querySelector('link[href="' + css + '"]')) {
    const link = document.createElement('link'); link.rel='stylesheet'; link.href=css; document.head.appendChild(link);
  }
  const modal = document.createElement('div');
  modal.id='full-profile-overlay'; modal.hidden=true;
  modal.innerHTML=`<section class="full-profile-card" role="dialog" aria-modal="true" aria-label="Profil du joueur">
    <header class="full-profile-header"><button class="full-profile-close" type="button" aria-label="Retour">←</button><h2 class="full-profile-header-title">Profil</h2><button class="full-profile-settings" type="button" aria-label="Paramètres" title="Paramètres" hidden>⚙</button></header>
      <div class="full-profile-banner"><button class="full-profile-banner-plus" type="button" aria-label="Modifier la bannière" title="Modifier la bannière" hidden>+</button></div><div class="full-profile-main">
      <div class="full-profile-identity"><div class="full-profile-avatar-wrap"><div class="full-profile-avatar"></div><button class="full-profile-avatar-plus" type="button" aria-label="Modifier la photo de profil" title="Modifier la photo de profil" hidden>+</button></div>
      <div class="full-profile-name-row"><button class="full-profile-name" type="button" title="Modifier mon pseudo"></button><button class="full-profile-pencil" type="button" aria-label="Modifier le pseudo" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg></button></div>
      <button class="full-profile-bio" type="button" title="Modifier mon message personnel"></button></div><div class="full-profile-meta"></div>
      <div class="full-profile-stats"></div><div class="full-profile-actions"></div>
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
      if (modal.querySelector('.full-profile-quick-edit')) return;
      const editor = document.createElement(field === 'bio' ? 'textarea' : 'input');
      editor.className = 'full-profile-inline-input';
      editor.value = initial || '';
      editor.maxLength = field === 'bio' ? 50 : 14;
      if (field === 'pseudo') editor.minLength = 5;
      editor.setAttribute('aria-label', field === 'bio' ? 'Modifier mon message personnel' : 'Modifier mon pseudo');
      const panel = document.createElement('div');
      panel.className = 'full-profile-quick-edit';
      const controls = document.createElement('div');
      controls.className = 'full-profile-quick-actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button'; cancelBtn.textContent = 'Annuler';
      cancelBtn.className = 'full-profile-cancel';
      const okBtn = document.createElement('button');
      okBtn.type = 'button'; okBtn.textContent = 'OK'; okBtn.hidden = true;
      controls.append(cancelBtn, okBtn);
      panel.append(editor, controls);
      node.hidden = true;
      if (field === 'pseudo') $('.full-profile-pencil').hidden = true;
      node.insertAdjacentElement('afterend', panel);
      const changed = () => editor.value.trim() !== (initial || '').trim();
      const valid = () => field === 'bio' || (editor.value.trim().length >= 5 && editor.value.trim().length <= 14);
      const update = () => { okBtn.hidden = !changed() || !valid(); };
      const cancel = () => {
        panel.remove(); node.hidden = false;
        if (field === 'pseudo') $('.full-profile-pencil').hidden = false;
      };
      const save = async () => {
        if (!changed() || !valid()) return;
        okBtn.disabled = true;
        try { await saveQuickField(field, editor.value.trim(), id); }
        catch (e) { okBtn.disabled = false; editor.setCustomValidity(e.message); editor.reportValidity(); editor.setCustomValidity(''); }
      };
      editor.addEventListener('input', update);
      okBtn.onclick = save;
      cancelBtn.onclick = cancel;
      editor.onkeydown = e => {
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        if (e.key === 'Enter' && (field === 'pseudo' || e.ctrlKey)) { e.preventDefault(); save(); }
      };
      editor.focus(); editor.select();
    };
  }
  const text = (parent, tag, content) => {const node=document.createElement(tag); node.textContent=content; parent.appendChild(node); return node;};
  // Règle 3 : relation vérifiée auprès des routes déjà présentes dans dashboard.js.
  async function getFriendRelation(id, profile) {
    const [friendsResult, requestsResult] = await Promise.allSettled([
      request('/api/users/friends'),
      request('/api/users/friends/requests')
    ]);
    if (friendsResult.status === 'fulfilled' &&
        (friendsResult.value.friends || []).some(f => Number(f.id) === id))
      return {status:'friends'};
    if (requestsResult.status === 'fulfilled') {
      const incoming = (requestsResult.value.requests || []).find(r => Number(r.sender_id) === id);
      if (incoming) return {status:'received', requestId:incoming.id};
      // L'API du lobby fournit aussi les demandes envoyées.
      const outgoing = (requestsResult.value.sent_requests || []).find(r =>
        Number(r.receiver_id ?? r.recipient_id ?? r.receiver?.id ?? r.user_id) === id);
      if (outgoing) return {status:'sent'};
    }
    // Un état « envoyée » n'est fiable que si le serveur le fournit.
    const raw = profile.friendship_status || profile.friend_status || profile.friend_request_status;
    if (['pending_sent','sent','outgoing','requested'].includes(raw)) return {status:'sent'};
    if (friendsResult.status === 'rejected' || requestsResult.status === 'rejected')
      return {status:'unknown'};
    return {status:'none'};
  }
  // Styles des décisions d'amitié : priorité sur les règles générales du profil.
  const friendDecisionStyles = document.createElement('style');
  friendDecisionStyles.textContent = `
    #full-profile-overlay .full-profile-actions button.full-profile-reject {
      background:#dc354b!important; background-image:none!important; color:#fff!important;
      border:1px solid #f05265!important; border-radius:10px!important;
      font-weight:700!important; padding:11px 18px!important;
    }
    #full-profile-overlay .full-profile-actions button.full-profile-accept {
      background:#269e65!important; background-image:none!important; color:#fff!important;
      border:1px solid #42bb80!important; border-radius:10px!important;
      font-weight:700!important; padding:11px 18px!important;
    }
    #full-profile-overlay .full-profile-actions button.full-profile-request-sent {
      background:#102b45!important; background-image:none!important; color:#2599f5!important;
      border:1px solid #1a466a!important; border-radius:10px!important;
      font-weight:700!important; padding:11px 22px!important;
      cursor:default!important; opacity:1!important; box-shadow:none!important;
    }
    #full-profile-overlay .full-profile-actions button.full-profile-reject:disabled,
    #full-profile-overlay .full-profile-actions button.full-profile-accept:disabled {opacity:.6!important;}
  `;
  document.head.appendChild(friendDecisionStyles);
  function profileActionButton(label, className, callback) {
    const button=document.createElement('button');
    button.type='button';button.className=className;button.textContent=label;
    button.onclick=callback;return button;
  }
  async function renderFriendActions(id, profile, actions) {
    actions.replaceChildren();
    const relation=await getFriendRelation(id,profile);
    if (modal.hidden || Number(modal.dataset.playerId)!==id) return;
    const notify=e=>{ if(typeof window.showToast==='function')window.showToast(e.message || e);else alert(e.message || e); };
    if (relation.status==='friends') {
      actions.append(profileActionButton('💬 Écrire un message','full-profile-message',async()=>{
        if(typeof window.openPrivateChat!=='function') {notify('Messagerie indisponible sur cette page.');return;}
        modal.hidden=true;
        await window.openPrivateChat({id,pseudo:profile.pseudo,username:profile.username,avatar_url:profile.avatar_url});
      }));
    } else if (relation.status==='received') {
      const respond=async(action)=>{
        [...actions.querySelectorAll('button')].forEach(b=>b.disabled=true);
        try {
          await request(`/api/users/friends/requests/${relation.requestId}/respond`,{
            method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})
          });
          await renderFriendActions(id,profile,actions);
          window.refreshFriendRequests?.();window.loadDashboardFriends?.();
          window.refreshLobbyFriendRequests?.();
          window.dispatchEvent(new Event("gpflsk:friendship-changed"));
        } catch(e) {notify(e);await renderFriendActions(id,profile,actions);}
      };
      actions.append(profileActionButton('✕ Refuser','full-profile-reject',()=>respond('reject')),
                     profileActionButton('✓ Accepter','full-profile-accept',()=>respond('accept')));
    } else if (relation.status==='sent') {
      const button=profileActionButton('✓ Envoyé','full-profile-request-sent',()=>{});
      button.disabled=true;actions.append(button);
    } else if (relation.status==='unknown') {
      const info=document.createElement('span');info.textContent='État de l’amitié indisponible';
      actions.append(info);
    } else {
      const add=profileActionButton('🤝 Ajouter en ami','full-profile-add',async()=>{
        add.disabled=true;
        try {
          await request('/api/users/friends/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiver_id:id})});
          add.textContent='✓ Envoyé';add.className='full-profile-request-sent';
          window.refreshLobbyFriendRequests?.();
          window.dispatchEvent(new Event('gpflsk:friendship-changed'));
        } catch(e) {add.disabled=false;notify(e);}
      });
      actions.append(add);
    }
  }
  async function open(playerId) {
    const id=Number(playerId);
    if (!Number.isInteger(id) || id<=0) return;
    modal.hidden=false;
    modal.dataset.playerId=String(id);
    if (typeof settingsOverlay !== 'undefined') settingsOverlay.hidden=true;
    $('.full-profile-name').textContent='Chargement...';
    try {
      const {profile:v}=await request('/api/users/profile/'+id);
      const displayName = v.pseudo?.trim() || v.username || "Joueur";
      if (modal.hidden || Number(modal.dataset.playerId)!==id) return;
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
      $('.full-profile-pencil').hidden = !isOwner;
      $('.full-profile-pencil').onclick = null;
      $('.full-profile-banner-plus').hidden=!isOwner;
      $('.full-profile-avatar-plus').hidden=!isOwner;
      if(isOwner){
        enableInlineEdit($('.full-profile-name'),'pseudo',v.pseudo || v.username,id);
        enableInlineEdit($('.full-profile-bio'),'bio',v.bio || '',id);
        $('.full-profile-pencil').onclick=()=>$('.full-profile-name').click();
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
      addStat('COINS', (isOwner || showCoins) && v.coins != null ? String(v.coins) : '—');
      const actions=$('.full-profile-actions'); clear(actions);
      if (isOwner) {
        const openAvatarEditor=()=>{
          const header=document.getElementById('header-avatar-btn');
          if(header){modal.hidden=true;window.__profileAvatarEditOnce=true;header.click();}
          else {const avatarModal=document.getElementById('avatar-modal');if(avatarModal)avatarModal.removeAttribute('hidden');else alert('Éditeur d’avatar indisponible sur cette page.');}
        };
        $('.full-profile-avatar-plus').onclick=()=>showMediaPicker('avatar',id);
        $('.full-profile-banner-plus').onclick=()=>showMediaPicker('banner',id);
        const settingsBtn=$('.full-profile-settings');
        settingsBtn.hidden=false;
        settingsBtn.onclick=()=>{showSettingsPage('home');settingsOverlay.hidden=false;};
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
      } else {
        $('.full-profile-settings').hidden=true;
        $('.full-profile-settings').onclick=null;
        $('.full-profile-avatar-plus').onclick=null;$('.full-profile-banner-plus').onclick=null;
        await renderFriendActions(id,v,actions);
      }
    } catch(e) { $('.full-profile-name').textContent=e.message; }
  }
  // Paramètres inspirés de l'interface fournie : navigation locale, sans appels API fictifs.
  const settingsOverlay = document.createElement('div');
  settingsOverlay.id = 'profile-settings-overlay';
  settingsOverlay.hidden = true;
  settingsOverlay.innerHTML = `<section class="profile-settings-panel" role="dialog" aria-modal="true" aria-label="Paramètres">
    <header class="profile-settings-header"><button class="profile-settings-back" type="button" aria-label="Retour">←</button><h2>Paramètres</h2></header>
    <main class="profile-settings-content"></main></section>`;
  document.body.appendChild(settingsOverlay);
  const settingsTitle = settingsOverlay.querySelector('.profile-settings-header h2');
  const settingsContent = settingsOverlay.querySelector('.profile-settings-content');
  let settingsPage = 'home';
  const settingsPref = (key, fallback) => localStorage.getItem('gpflsk-settings-' + key) || fallback;
  const setSettingsPref = (key, value) => localStorage.setItem('gpflsk-settings-' + key, value);
  const settingsStyles = document.createElement('style');
  settingsStyles.textContent = `
    /* Palette identique au profil / lobby : bleu nuit, bleu ardoise et violet. */
    #profile-settings-overlay {position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.76);color:#f3f5ff;display:flex;justify-content:center;align-items:center;padding:12px;box-sizing:border-box}
    #profile-settings-overlay[hidden]{display:none!important}
    #profile-settings-overlay .profile-settings-panel{width:min(100%,650px);height:min(90vh,820px);min-height:0;border:1px solid #33476c;border-radius:18px;background:#101c35;color:#f3f5ff;box-shadow:0 22px 65px #0009;display:flex;flex-direction:column;overflow:hidden}
    #profile-settings-overlay .profile-settings-header{position:relative;flex:none;min-height:78px;background:#152344;border-bottom:1px solid #33476c;display:flex;justify-content:center;align-items:center;padding:12px 62px;box-sizing:border-box}
    #profile-settings-overlay .profile-settings-header h2{font-size:21px;font-weight:700;margin:0;text-align:center;color:#fff}
    #profile-settings-overlay .profile-settings-back{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:46px;height:46px;display:grid;place-items:center;padding:0;border:0!important;background:transparent!important;box-shadow:none!important;font-size:32px;color:#fff!important;cursor:pointer}
    #profile-settings-overlay .profile-settings-content{padding:16px 14px 30px;overflow-y:auto;overflow-x:hidden;flex:1;min-height:0;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(163,181,221,.15) transparent}
    #profile-settings-overlay .profile-settings-content::-webkit-scrollbar{width:4px}
    #profile-settings-overlay .profile-settings-content::-webkit-scrollbar-track{background:transparent}
    #profile-settings-overlay .profile-settings-content::-webkit-scrollbar-thumb{background:rgba(163,181,221,.14);border-radius:10px}
    #profile-settings-overlay .profile-settings-content:hover::-webkit-scrollbar-thumb{background:rgba(163,181,221,.28)}
    #profile-settings-overlay .settings-group{background:#152344;border:1px solid rgba(150,170,220,.12);border-radius:15px;overflow:hidden;margin:0 0 20px}
    #profile-settings-overlay .settings-row{display:flex;align-items:center;gap:16px;width:100%;min-height:74px;box-sizing:border-box;padding:15px 20px;border:0!important;border-bottom:1px solid rgba(150,170,220,.16)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:#f3f5ff!important;text-align:left;font:inherit;font-size:17px;cursor:pointer}
    #profile-settings-overlay .settings-row:last-child{border-bottom:0!important}
    #profile-settings-overlay .settings-row:hover{background:rgba(112,93,216,.10)!important}
    #profile-settings-overlay .settings-row:focus-visible{outline:2px solid #9d87ff;outline-offset:-3px}
    #profile-settings-overlay .settings-icon{width:30px;flex:none;text-align:center;font-size:22px}
    #profile-settings-overlay .settings-label{flex:1}
    #profile-settings-overlay .settings-check{width:29px;height:29px;border-radius:50%;background:#7355df;color:white;display:grid;place-items:center;font-weight:800;font-size:20px;flex:none}
    #profile-settings-overlay .settings-switch{width:57px;height:35px;border-radius:30px;background:#465472;position:relative;flex:none;transition:background .15s}
    #profile-settings-overlay .settings-switch:after{content:'';position:absolute;top:5px;left:5px;width:25px;height:25px;background:#101c35;border-radius:50%;transition:transform .15s}
    #profile-settings-overlay .settings-switch.is-on{background:#7355df}
    #profile-settings-overlay .settings-switch.is-on:after{transform:translateX(22px)}
    #profile-settings-overlay .settings-note{color:#b6c2dc;line-height:1.5;font-size:15px;margin:10px 8px 18px}
    #profile-settings-overlay .settings-info{padding:24px;color:#c3cce1;font-size:16px;line-height:1.55}
    #profile-settings-overlay .settings-warning{background:#1d2b49;border:1px solid #33476c;border-radius:14px;padding:18px;display:flex;gap:14px;margin:0 0 24px;font-size:16px;line-height:1.45}
    #profile-settings-overlay .settings-warning strong{display:block;color:#fff;font-size:18px;margin-bottom:8px}
    #profile-settings-overlay .settings-warning span{color:#d7def1}
    #profile-settings-overlay .settings-danger{color:#ff9aa8}
    @media(max-width:719px){#profile-settings-overlay{padding:0;align-items:stretch}#profile-settings-overlay .profile-settings-panel{height:100%;max-height:none;border:0;border-radius:0}#profile-settings-overlay .profile-settings-header{min-height:76px}}
  `;
  document.head.appendChild(settingsStyles);
  function settingsGroup(rows) {
    const group = document.createElement('div'); group.className = 'settings-group';
    rows.forEach(({label, icon, action, selected, toggle, danger}) => {
      const row = document.createElement('button');row.type='button';row.className='settings-row';
      if (icon) {const glyph=document.createElement('span');glyph.className='settings-icon';glyph.textContent=icon;row.append(glyph);}
      const name=document.createElement('span');name.className='settings-label';name.textContent=label;
      if(danger)name.classList.add('settings-danger');row.append(name);
      if(selected){const check=document.createElement('span');check.className='settings-check';check.textContent='✓';row.append(check);}
      if(toggle!==undefined){const sw=document.createElement('span');sw.className='settings-switch'+(toggle?' is-on':'');sw.setAttribute('aria-hidden','true');row.setAttribute('aria-pressed',String(toggle));row.append(sw);}
      row.onclick=action || (()=>{});group.append(row);
    });return group;
  }
  const settingsPages = {
    home:'Paramètres', account:'Compte', devices:'Appareils', language:'Langue', games:'Jeux',
    notifications:'Notifications', privacy:'Confidentialité et accessibilité', themes:'Thèmes',
    about:'À propos de GPFlsk', support:'Accéder au support', terms:'Conditions de service', levels:'Niveau info'
  };
  function settingsBack(){if(settingsPage==='home'){settingsOverlay.hidden=true;}else{showSettingsPage('home');}}
  settingsOverlay.querySelector('.profile-settings-back').onclick=settingsBack;
  settingsOverlay.addEventListener('click',e=>{if(e.target===settingsOverlay)settingsOverlay.hidden=true;});
  function showSettingsPage(page='home'){
    settingsPage=page;settingsTitle.textContent=settingsPages[page]||'Paramètres';settingsContent.replaceChildren();
    const add=rows=>settingsContent.append(settingsGroup(rows));
    const info=message=>{const p=document.createElement('p');p.className='settings-info';p.textContent=message;settingsContent.append(p);};
    const go=target=>()=>showSettingsPage(target);
    if(page==='home'){
      add([{label:'Compte',icon:'👤',action:go('account')},{label:'Appareils',icon:'▣',action:go('devices')}]);
      add([{label:'Langue',icon:'🌐',action:go('language')},{label:'Jeux',icon:'🎮',action:go('games')},
           {label:'Notifications',icon:'♧',action:go('notifications')},{label:'Confidentialité et accessibilité',icon:'🔒',action:go('privacy')},
           {label:'Thèmes',icon:'◉',action:go('themes')}]);
      add([{label:'À propos de GPFlsk',icon:'ⓘ',action:go('about')},{label:'Accéder au support',icon:'ⓘ',action:go('support')}]);
    } else if(page==='language'){
      const languages=[['auto','Utiliser la langue de l’appareil'],['en','English'],['fr','Français'],['es','Español'],['ar','العربية'],['de','Deutsch'],['ms','Melayu'],['it','Italiano'],['fa','فارسی'],['hi','हिन्दी'],['pt-BR','Português (Brasil)'],['tr','Türkçe']];
      const selected=settingsPref('language','auto');
      add(languages.map(([code,label])=>({label,selected:selected===code,action:()=>{setSettingsPref('language',code);showSettingsPage('language');}})));
      const note=document.createElement('p');note.className='settings-note';note.textContent='Préférence mémorisée sur cet appareil. La traduction de toute l’interface nécessite un système de langues dans le site.';settingsContent.append(note);
    } else if(page==='themes'){
      const selected=settingsPref('theme','dark');
      add([['system','Système par défaut'],['light','Lumière'],['dark','Sombre']].map(([value,label])=>({label,selected:selected===value,action:()=>{
        setSettingsPref('theme',value);applySettingsTheme();showSettingsPage('themes');
      }})));
      const note=document.createElement('p');note.className='settings-note';note.textContent='Le choix est mémorisé. Le thème complet du site doit être raccordé aux styles de ses autres pages.';settingsContent.append(note);
    } else if(page==='games'){
      const on=settingsPref('vibrations','on')==='on';
      add([{label:'Activer les vibrations',toggle:on,action:()=>{setSettingsPref('vibrations',on?'off':'on');showSettingsPage('games');}}]);
      info('La préférence est enregistrée localement. Les jeux devront la consulter avant de déclencher une vibration.');
    } else if(page==='notifications'){
      const warning=document.createElement('div');warning.className='settings-warning';
      const enabled=('Notification' in window)&&Notification.permission==='granted';
      warning.innerHTML='<div style="font-size:26px">⚠️</div><div><strong></strong><span></span></div>';
      warning.querySelector('strong').textContent=enabled?'Notifications autorisées':'Notifications non activées';
      warning.querySelector('span').textContent=enabled?'Le navigateur autorise les notifications.':'Les notifications du navigateur ne sont pas encore autorisées. Leur envoi nécessite aussi une intégration côté application.';
      settingsContent.append(warning);
      const on=settingsPref('level-notifications','on')==='on';
      add([{label:'XP et niveau supérieur',toggle:on,action:()=>{setSettingsPref('level-notifications',on?'off':'on');showSettingsPage('notifications');}}]);
    } else if(page==='account'){
      info('Votre compte est déjà accessible depuis le profil. La synchronisation et la suppression du compte nécessitent des fonctions serveur dédiées.');
      add([{label:'Enregistrer un compte (à connecter)'},{label:'Se connecter à un compte existant (à connecter)'},{label:'Supprimer le compte (indisponible)',danger:true}]);
    } else if(page==='about'){
      add([{label:'Conditions de service',action:go('terms')},{label:'Niveau info',action:go('levels')},{label:'Évaluer GPFlsk (à connecter)'}]);
      info('Version de l’application : non renseignée.');
    } else if(page==='devices') info('La gestion des appareils connectés nécessite un suivi des sessions côté serveur.');
    else if(page==='privacy') info('Les réglages de confidentialité et d’accessibilité seront raccordés aux préférences du compte.');
    else if(page==='support') info('Ajoutez ici votre adresse ou votre page de support officielle.');
    else if(page==='terms') info('Ajoutez ici vos conditions de service.');
    else if(page==='levels') info('Les informations sur les niveaux seront disponibles lorsque cette fonctionnalité sera reliée au jeu.');
  }
  function applySettingsTheme(){
    const theme=settingsPref('theme','dark');
    document.documentElement.dataset.profileThemePreference=theme;
  }
  applySettingsTheme();
  showSettingsPage('home');
  $('.full-profile-close').onclick=()=>modal.hidden=true;
  modal.onclick=e=>{if(e.target===modal) modal.hidden=true;};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!settingsOverlay.hidden)settingsBack();else if(!picker.hidden)closePicker();else modal.hidden=true;}});

  // Galerie locale : les images absentes sont masquées automatiquement.
  // Éditeur local : écran d'accueil à quatre actions, sans galerie préchargée.
  const picker = document.createElement('div');
  picker.id = 'profile-media-picker';
  picker.hidden = true;
  picker.innerHTML = `<div class="profile-picker-panel" role="dialog" aria-modal="true" aria-label="Changer l'image">
    <div class="profile-picker-top"><button type="button" class="profile-picker-back" aria-label="Retour">←</button><h2 class="profile-picker-title">CHANGER L'IMAGE</h2></div>
    <div class="profile-picker-options"></div>
    <div class="profile-picker-collections" hidden></div>
    <div class="profile-picker-grid" hidden></div>
    <p class="profile-picker-status" role="status" aria-live="polite"></p>
    <input type="file" class="profile-picker-file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
    <input type="file" class="profile-picker-camera" accept="image/*" capture="user" hidden>
  </div>`;
  document.body.appendChild(picker);
  const pick = selector => picker.querySelector(selector);
  const closePicker = () => {picker.hidden=true;};
  // La flèche du menu ferme la fenêtre ; celle des galeries revient en arrière.
  let pickerView = 'home';
  let pickerKind = 'avatar';
  pick('.profile-picker-back').onclick = () => {
    // La bannière ouvre directement le catalogue : pas de menu intermédiaire.
    if (pickerKind === 'banner') {
      closePicker();
    } else if (pickerView === 'home') {
      closePicker();
    } else if (pickerView === 'collection-detail') {
      pickerShowCollections?.();
    } else {
      pickerShowHome?.();
    }
  };
  let pickerShowHome = null;
  let pickerShowCollections = null;
  picker.addEventListener('click',e=>{if(e.target===picker)closePicker();});
  const icons = {
    camera:'<rect x="3" y="6" width="18" height="15" rx="3"/><path d="M8 6l1.5-3h5L16 6"/><circle cx="12" cy="13" r="4"/>',
    gallery:'<rect x="3" y="5" width="18" height="16" rx="2"/><circle cx="16" cy="10" r="2"/><path d="m4 18 5-5 4 4 3-3 5 5"/>',
    avatar:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="9" r="3"/><path d="M5.5 19c1-5 12-5 13 0"/>',
    collection:'<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>'
  };
  function iconButton(label, icon, action){
    const b=document.createElement('button');b.type='button';b.className='profile-picker-action';
    b.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[icon]}</svg><span>${label}</span>`;
    b.onclick=action;return b;
  }
  function showMediaPicker(kind,id){
    pickerKind=kind;
    picker.hidden=false;
    pick('.profile-picker-top').hidden=false;
    pickerView='home';
    const options=pick('.profile-picker-options');
    const collectionsPanel=pick('.profile-picker-collections');
    const grid=pick('.profile-picker-grid');
    const status=pick('.profile-picker-status');
    const input=pick('.profile-picker-file');
    const camera=pick('.profile-picker-camera');
    options.replaceChildren();collectionsPanel.replaceChildren();grid.replaceChildren();
    collectionsPanel.hidden=true;grid.hidden=true;status.textContent='';
    const homeTitle = kind==='banner' ? 'CHANGER LA BANNIÈRE' : "CHANGER L'IMAGE";
    const setView = (view, title) => {
      pickerView = view;
      pick('.profile-picker-title').textContent = title;
    };
    const showHome = () => {
      setView('home',homeTitle);
      options.hidden=false;
      collectionsPanel.hidden=true;
      grid.hidden=true;
      grid.replaceChildren();
      status.textContent='';
    };
    pickerShowHome=showHome;
    const tile = (url,label,onClick) => {
      const b=document.createElement('button');b.type='button';b.className='profile-picker-tile';
      const img=document.createElement('img');img.src=url;img.alt=label;img.loading='lazy';
      img.onerror=()=>b.remove();b.append(img);b.onclick=onClick;return b;
    };
    const notifyAvatarUpdated = (url) => {
      if (!url) return;
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.avatar_url = url;
        localStorage.setItem('user', JSON.stringify(user));
      } catch (error) { console.warn('Synchronisation avatar :', error); }
      window.dispatchEvent(new CustomEvent('profile-avatar-updated', {
        detail: { avatar_url: url }
      }));
    };
    const selectImage=async (payload,button) => {
      button.disabled=true;status.textContent='Enregistrement...';
      try {
        const result = await request('/api/users/profile/me/catalogue', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload)
        });
        if (payload.kind === 'avatar') {
          const fallback = payload.collection === 'free'
            ? '/static/images/avatars/' + encodeURIComponent(payload.filename)
            : null;
          notifyAvatarUpdated(result.avatar_url || result.user?.avatar_url || fallback);
        }
        closePicker();
        await open(id);
      } catch(e) { status.textContent=e.message;button.disabled=false; }
    };
    const showFreeAvatars=()=>{
      setView('avatar', 'CHANGER AVATAR');
      options.hidden=true;collectionsPanel.hidden=true;grid.hidden=false;
      collectionsPanel.replaceChildren();grid.replaceChildren();
      // Charger les fichiers numérotés jusqu'au premier trou après les premiers éléments.
      // Le serveur fournit la liste réelle afin de ne pas deviner le nombre de fichiers.
      request('/api/users/profile/avatar-catalogue').then(data=>{
        for(const name of (data.avatars||[])){
          const url='/static/images/avatars/'+encodeURIComponent(name);
          const b=tile(url,name,()=>selectImage({kind:'avatar',collection:'free',filename:name},b));grid.append(b);
        }
        if(!grid.children.length)status.textContent='Aucun avatar trouvé dans static/images/avatars/.';
      }).catch(e=>{status.textContent=e.message;});
    };
    const showPaidCollection=collection=>{
      setView('collection-detail',collection.name);
      collectionsPanel.hidden=true;grid.hidden=false;grid.replaceChildren();
      collectionsPanel.replaceChildren();
      for(const name of collection.files){
        const url='/static/media/avatars/'+encodeURIComponent(collection.id)+'/'+encodeURIComponent(name);
        const b=tile(url,name,()=>selectImage({kind:'avatar',collection:collection.id,filename:name},b));grid.append(b);
      }
    };
    const showCollections=async()=>{
      setView('collections','MA COLLECTION');
      options.hidden=true;collectionsPanel.hidden=false;grid.hidden=true;grid.replaceChildren();
      collectionsPanel.replaceChildren();status.textContent='Chargement des collections...';
      try {
        const data=await request('/api/users/profile/shop');
        status.textContent='';
        const allCollections=(data.collections||[]).filter(c=>c.kind===kind);
        const items=(data.items||[]).filter(i=>i.kind===kind);
        if(!allCollections.length){status.textContent='Catalogue vide : importer les images dans shop_items.';return;}
        let active=0,filter='all',query='';
        const root=document.createElement('div');root.className='profile-collection-browser';
        const toolbar=document.createElement('div');toolbar.className='profile-collection-toolbar';
        const tabs=document.createElement('div');tabs.className='profile-collection-tabs';tabs.setAttribute('role','tablist');
        const tools=document.createElement('div');tools.className='profile-collection-tools';
        const filterBtn=document.createElement('button');filterBtn.type='button';filterBtn.className='profile-collection-tool';filterBtn.textContent='☷';filterBtn.title='Filtrer';
        const searchBtn=document.createElement('button');searchBtn.type='button';searchBtn.className='profile-collection-tool';searchBtn.textContent='⌕';searchBtn.title='Rechercher';
        const search=document.createElement('input');search.type='search';search.placeholder='Rechercher';search.className='profile-collection-search';search.hidden=true;
        tools.append(filterBtn,searchBtn);toolbar.append(tabs,tools);
        const cards=document.createElement('div');cards.className='profile-collection-items';
        const detail=document.createElement('div');detail.className='profile-item-detail';detail.hidden=true;
        detail.innerHTML=`<section class="profile-item-dialog" role="dialog" aria-modal="true" aria-label="Détail de l’article">
          <div class="profile-item-heading"><h3>ACHETER CET ARTICLE</h3><button type="button" class="profile-item-close" aria-label="Fermer">×</button></div>
          <img class="profile-item-large" alt=""><h4 class="profile-item-name"></h4>
          <button type="button" class="profile-item-buy">ACHETER</button>
          <p class="profile-item-message" role="status" aria-live="polite"></p>
        </section>`;
        detail.querySelector('.profile-item-close').onclick=()=>{detail.hidden=true;};
        detail.addEventListener('click',e=>{if(e.target===detail)detail.hidden=true;});
        root.append(toolbar,search,cards);collectionsPanel.append(root,detail);
        const render=()=>{
          tabs.replaceChildren();
          allCollections.forEach((c,i)=>{
            const tab=document.createElement('button');tab.type='button';tab.className='profile-collection-tab'+(i===active?' is-active':'');
            tab.textContent=c.name;tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(i===active));
            tab.onclick=()=>{active=i;query='';search.value='';render();};tabs.append(tab);
          });
          cards.replaceChildren();
          const selected=items.filter(i=>i.collection_id===allCollections[active].id &&
            i.name.toLowerCase().includes(query.toLowerCase()) &&
            (filter==='all'||(filter==='owned'&&i.owned)||(filter==='locked'&&!i.owned)));
          selected.forEach(i=>{
            const card=document.createElement('button');card.type='button';card.className='profile-collection-item';
            const visual=document.createElement('div');visual.className='profile-collection-visual';
            const img=document.createElement('img');img.src=i.image_url;img.alt='';img.loading='lazy';img.onerror=()=>{card.hidden=true;};
            const label=document.createElement('strong');label.textContent=i.name;visual.append(img,label);
            const price=document.createElement('span');price.className='profile-collection-price';price.textContent=i.owned?'✓':`🟡 ${i.price}`;
            card.append(visual,price);cards.append(card);
            card.onclick=()=>{
              detail.hidden=false;detail.querySelector('.profile-item-large').src=i.image_url;
              detail.querySelector('.profile-item-name').textContent=i.name;
              detail.querySelector('.profile-item-heading h3').textContent=i.owned?'UTILISER CET ARTICLE':'ACHETER CET ARTICLE';
              const msg=detail.querySelector('.profile-item-message');msg.textContent='';
              const buy=detail.querySelector('.profile-item-buy');buy.disabled=false;
              buy.textContent=i.owned?'UTILISER':`ACHETER 🟡 ${i.price}`;
              buy.onclick=async()=>{
                buy.disabled=true;
                try {
                  if(!i.owned){
                    const result=await request('/api/users/profile/shop/'+i.id+'/buy',{method:'POST'});
                    i.owned=true;
                    try{const u=JSON.parse(localStorage.getItem('user')||'{}');u.coins=result.coins;localStorage.setItem('user',JSON.stringify(u));}catch{}
                  }
                  // Achat et equipement sont distincts : ici le clic confirme aussi l'utilisation.
                  await request('/api/users/profile/shop/'+i.id+'/equip',{method:'POST'});
                  if(i.kind==='avatar') notifyAvatarUpdated(i.image_url);
                  detail.hidden=true;closePicker();await open(id);
                }catch(e){msg.textContent=e.message;buy.disabled=false;render();}
              };
            };
          });
          if(!selected.length){const empty=document.createElement('p');empty.className='profile-collection-empty';empty.textContent='Aucun article dans cette sélection.';cards.append(empty);}
        };
        filterBtn.onclick=()=>{filter=filter==='all'?'owned':filter==='owned'?'locked':'all';render();};
        searchBtn.onclick=()=>{search.hidden=!search.hidden;if(!search.hidden)search.focus();else{search.value='';query='';render();}};
        search.oninput=()=>{query=search.value.trim();render();};render();
      }catch(e){status.textContent=e.message;}
    };
    pickerShowCollections=showCollections;
    const upload=async file=>{
      if(!file)return;
      status.textContent='Traitement et enregistrement...';
      const form=new FormData();form.append(kind,file);
      try{
        const result=await request(`/api/auth/${kind}`,{method:'POST',body:form});
        if(kind==='avatar'){
          notifyAvatarUpdated(result.avatar_url || result.user?.avatar_url);
        }
        closePicker();await open(id);
      }catch(e){status.textContent=e.message;}
    };
    input.onchange=()=>{upload(input.files[0]);input.value='';};
    camera.onchange=()=>{upload(camera.files[0]);camera.value='';};
    options.hidden=false;
    if(kind==='avatar'){
      options.append(
        iconButton('CAMERA','camera',()=>camera.click()),
        iconButton('GALLERY','gallery',()=>input.click()),
        iconButton('AVATAR','avatar',showFreeAvatars),
        iconButton('COLLECTION','collection',showCollections)
      );
    }else{
      showCollections();
    }

  }

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