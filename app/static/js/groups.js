(()=>{
"use strict";
let groups=[], active=null, lastId=0, lastDay=null, refreshing=false;
const $=id=>document.getElementById(id);
const me=()=>{try{return Number(JSON.parse(localStorage.getItem('user')).id)}catch{return 0}};
const notify=t=>{if(typeof showToast==='function')showToast(t);else alert(t)};
async function apiGroup(path,method='GET',body){
 const r=await fetch('/api/groups'+path,{method,headers:{Authorization:'Bearer '+localStorage.getItem('access_token'),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{throw Error('Réponse inattendue (HTTP '+r.status+')')};if(!r.ok)throw Error(data.error||data.msg||'Erreur HTTP '+r.status);return data;
}
async function friends(){const r=await fetch('/api/users/friends',{headers:{Authorization:'Bearer '+localStorage.getItem('access_token')}});const d=await r.json();if(!r.ok)throw Error(d.error||'Impossible de charger les amis');return d.friends||[]}
function open(id){$(id).hidden=false;}function close(id){$(id).hidden=true;}
async function loadGroups()
 {
  try
   {
    const d=await apiGroup('');
    groups=d.groups||[];
    $('groups-count').textContent=groups.length;
    const list=$('groups-sidebar-list');
    list.replaceChildren();
    if(!groups.length)
      {
       const p=document.createElement('p');
       p.textContent="Tu n'as pas encore de groupe.";
       list.append(p)
      }
    for(const g of groups)
       {
        const b=document.createElement('button');
        b.type='button';b.className='group-entry';
        const ic=document.createElement('span');
        ic.className='group-entry-icon';ic.textContent='👥';if(g.avatar_url){ic.textContent='';const image=document.createElement('img');image.src=g.avatar_url;image.alt='';image.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%';ic.append(image)}
        const info=document.createElement('span');
        const title=document.createElement('strong');
        title.textContent=g.name;
        const sub=document.createElement('small');
        sub.textContent=g.members.length+' membre(s)';
        info.append(title,sub);
        b.append(ic,info);
        b.onclick=()=>openChat(g.id);
        list.append(b)
       }
    if(active)
    {
     const updated=groups.find(g=>g.id===active.id);
     if(updated)
       {
        active=updated;renderHeader();if(currentGroupTab==='online' && !$('group-chat-modal').hidden)renderOnlineMembers();if(currentGroupTab==='online')renderOnlineMembers()}
     else
      {
       active=null;
       close('group-chat-modal')
      }
    }
   }
   catch(e){
    $('groups-sidebar-list').textContent=e.message}}

function renderHeader()
{
 $('group-chat-title').textContent=active.name;
  $('group-chat-members').textContent=active.members.length+' membre(s)';const av=$('group-header-avatar');const fallback=$('group-header-avatar-fallback');if(av){av.hidden=!active.avatar_url;if(active.avatar_url){av.onerror=()=>{av.hidden=true;if(fallback)fallback.hidden=false};av.onload=()=>{av.hidden=false;if(fallback)fallback.hidden=true};av.src=active.avatar_url;}}if(fallback)fallback.hidden=!!active.avatar_url;
 $('group-add-friend').hidden=active.owner_id!==me();
 $('group-delete').hidden=Number(active.owner_id)!==me();if($('group-menu-delete'))$('group-menu-delete').hidden=Number(active.owner_id)!==me();
 $('group-leave').hidden=Number(active.owner_id)===me();if($('group-menu-leave'))$('group-menu-leave').hidden=Number(active.owner_id)===me()
}
window.openFriendGroupChat = id => openChat(Number(id));
async function openChat(id){active=groups.find(g=>g.id===id);if(!active)return;lastId=0;lastDay=null;$('group-chat-messages').replaceChildren();renderHeader();setGroupTab('discussion');open('group-chat-modal');$('group-menu').hidden=true;await loadMessages()}
function renderGroupMessage(m)
{
 const mine=Number(m.sender_id)===me();
 const memberInfo=active?.members?.find(x=>Number(x.id)===Number(m.sender_id));
 const row=document.createElement('div');row.className='group-chat-row '+(mine?'is-mine':'is-received');
 const avatar=document.createElement('button');avatar.type='button';avatar.className='group-chat-avatar';avatar.title='Voir le profil du joueur';
 const avatarUrl=memberInfo?.avatar_url || (mine?(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}').avatar_url}catch{return null}})():null);
 if(avatarUrl)
  {
   const img=document.createElement('img');
   img.src=avatarUrl;
   img.alt='';
   img.onerror=()=>{img.remove();avatar.textContent='👤'};
   avatar.append(img)}else avatar.textContent='👤';
   const content=document.createElement('div');
   content.className='group-chat-content';
   const meta=document.createElement('div');
   meta.className='group-chat-meta';
   const name=document.createElement('strong');
   name.textContent=
       memberInfo?.pseudo || m.pseudo ||
       memberInfo?.username||m.username||'Joueur';
   meta.append(name);
   const playerId=Number(m.sender_id);
   const showProfile=()=>{if(playerId>0&&typeof window.openFullPlayerProfile==='function')window.openFullPlayerProfile(playerId);else notify('Profil indisponible.');};
   avatar.onclick=showProfile;name.setAttribute('role','button');name.tabIndex=0;name.title='Voir le profil';name.onclick=showProfile;name.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showProfile();}};
 if(m.created_at){const date=new Date(m.created_at);if(!Number.isNaN(date.getTime())){const time=document.createElement('time');time.dateTime=m.created_at;time.textContent=date.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});meta.append(time)}}
 const bubble=document.createElement('div');bubble.className='group-chat-bubble';bubble.textContent=m.content||'';
 content.append(meta,bubble);if(mine)row.append(content,avatar);else row.append(avatar,content);
 window.ChatCommon?.decorate(row,'group',m,mine,bubble);return row;
}
async function loadMessages(){if(!active||refreshing||$('group-chat-modal').hidden)return;refreshing=true;const id=active.id;try{const d=await apiGroup('/'+id+'/messages'+(lastId?'?after='+lastId:''));if(!active||active.id!==id)return;const box=$('group-chat-messages');const atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<90;for(const m of d.messages||[]){if(m.id<=lastId)continue;
 const date=m.created_at?new Date(m.created_at):null;
 if(date && !Number.isNaN(date.getTime())){
  const dayKey=`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  if(dayKey!==lastDay){
   const separator=document.createElement('div');separator.className='group-chat-date-separator';
   const label=document.createElement('span');
   label.textContent=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date).toLocaleUpperCase('fr-FR');
   separator.append(label);box.append(separator);
  }
  lastDay=dayKey;
 }
 lastId=m.id;box.append(renderGroupMessage(m))}if(atBottom)box.scrollTop=box.scrollHeight}catch(e){console.warn('Groupe :',e)}finally{refreshing=false}}
 function choiceRow(friend,checkbox){
   const label=document.createElement('label');
   label.className='group-friend-choice';
   const input=document.createElement('input');
   input.type=checkbox?'checkbox':'radio';
   input.name=checkbox?'group-friends':'group-add-friend';
   input.value=friend.id;
   const avatar=document.createElement('span');
   if(friend.avatar_url){
     const img=document.createElement('img');
     img.src=friend.avatar_url;img.alt='';
     avatar.append(img)}
   else avatar.textContent='👤';
   const name=document.createElement('span');
   name.textContent=friend.pseudo || friend.username;
   label.append(input,avatar,name);return label
}
async function createPicker(){const box=$('group-friend-picker');box.textContent='Chargement...';try{const list=await friends();box.replaceChildren();if(!list.length)box.textContent="Tu n'as pas encore d'amis.";list.forEach(f=>box.append(choiceRow(f,true)))}catch(e){box.textContent=e.message}}
async function addPicker(){const box=$('group-add-picker');box.textContent='Chargement...';try{const list=(await friends()).filter(f=>!active.members.some(m=>m.id===f.id));box.replaceChildren();if(!list.length)box.textContent='Tous tes amis sont déjà membres.';for(const f of list){const row=choiceRow(f,false);row.querySelector('input').onchange=async()=>{try{await apiGroup('/'+active.id+'/members','POST',{friend_id:f.id});close('group-add-modal');await loadGroups();notify('Ami ajouté au groupe.')}catch(e){notify(e.message)}};box.append(row)}}catch(e){box.textContent=e.message}}

// Nouvelle interface : les anciennes routes de messages et membres sont conservées.
let currentGroupTab='discussion';
function renderOnlineMembers(){
 const panel=$('group-online-panel');
 if(!panel||!active)return;
 panel.replaceChildren();
 const ownerId=Number(active.owner_id);
 const members=(active.members||[])
  .filter(m=>m.is_online===true)
  .sort((a,b)=>Number(Number(b.id)===ownerId)-Number(Number(a.id)===ownerId));
 if(!members.length){
  const p=document.createElement('p');
  p.className='group-online-empty';
  p.textContent='Aucun membre connecté pour le moment.';
  panel.append(p);
  return;
 }
 for(const member of members){
  const isOwner=Number(member.id)===ownerId;
  const row=document.createElement('button');
  row.type='button';
  row.className='gp-member group-online-member';
  const avatar=document.createElement('span');
  avatar.className='group-online-avatar';
  if(member.avatar_url){
   const img=document.createElement('img');
   img.src=member.avatar_url;
   img.alt='';
   img.onerror=()=>{img.remove();avatar.textContent='👤'};
   avatar.append(img);
  }else avatar.textContent='👤';
  const identity=document.createElement('span');
  identity.className='gp-online-identity';
  const dot=document.createElement('span');
  dot.className='group-online-dot';
  dot.setAttribute('aria-label','En ligne');
  dot.title='En ligne';
  identity.append(dot);
  if(isOwner){
   const crown=document.createElement('span');
   crown.className='gp-online-crown';
   crown.textContent='👑';
   crown.title='Créateur du groupe';
   crown.setAttribute('aria-label','Créateur du groupe');
   identity.append(crown);
  }
  const name=document.createElement('span');
  name.className='gp-online-pseudo';
  name.textContent=member.pseudo||member.username||'Joueur';
  identity.append(name);
  row.append(avatar,identity);
  row.onclick=()=>{if(typeof window.openFullPlayerProfile==='function')window.openFullPlayerProfile(Number(member.id));};
  panel.append(row);
 }
}
 function setGroupTab(tab){
  if(!['discussion','games','online'].includes(tab))tab='discussion';
  currentGroupTab=tab;
  document.querySelectorAll('[data-group-tab]').forEach(b=>{
   const selected=b.dataset.groupTab===tab;
   b.classList.toggle('active',selected);
   b.setAttribute('aria-selected',String(selected));
  });
  const views={discussion:$('group-discussion-panel'),games:$('group-games-panel'),online:$('group-online-panel')};
  for(const [name,panel] of Object.entries(views))if(panel)panel.hidden=name!==tab;
  if(tab==='online')renderOnlineMembers();
 }

function renderDetails(){if(!active)return;
 $('group-details-name').textContent=active.name;
 $('group-details-description').textContent=active.description||'Aucune description.';
 const img=$('group-details-avatar');img.hidden=!active.avatar_url;$('group-details-avatar-placeholder').hidden=!!active.avatar_url;if(active.avatar_url)img.src=active.avatar_url;
 $('group-details-avatar-button').hidden=Number(active.owner_id)!==me();
 const list=$('group-details-members');list.replaceChildren();for(const member of active.members){const row=document.createElement('div');row.className='gp-member';if(member.avatar_url){const image=document.createElement('img');image.src=member.avatar_url;image.alt='';row.append(image)}const name=document.createElement('span');name.textContent=member.pseudo||member.username;row.append(name);const id=Number(member.id);if(id>0){row.tabIndex=0;row.setAttribute('role','button');row.onclick=()=>window.openFullPlayerProfile?.(id);row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.click()}};}list.append(row)}
}
async function showAvatarShop(){
 if(!active){notify('Ouvre d’abord un groupe.');return;}
 open('group-avatar-modal');const grid=$('group-avatar-grid');grid.textContent='Chargement...';$('group-avatar-status').textContent='';try{
 const data=await apiGroupAvatar('/catalog?group_id='+active.id);grid.replaceChildren();$('group-avatar-balance').textContent='Ton solde : '+data.coins+' Coins';
 for(const item of data.items){const button=document.createElement('button');const image=document.createElement('img');image.src=item.image_url;image.alt=item.name;const name=document.createElement('span');name.textContent=item.name;const price=document.createElement('small');price.textContent=item.owned?'Déjà acheté':'100 Coins';button.append(image,name,price);button.onclick=async()=>{if(item.owned){await equipAvatar(item.id);return}if(!confirm('Acheter cet avatar pour 100 Coins ?'))return;button.disabled=true;try{await apiGroupAvatar('/buy','POST',{group_id:active.id,item_id:item.id});await equipAvatar(item.id)}catch(e){notify(e.message);button.disabled=false}};grid.append(button)}
 }catch(e){grid.textContent=e.message}}
async function apiGroupAvatar(path,method='GET',body){const response=await fetch('/api/group-avatars'+path,{method,headers:{Authorization:'Bearer '+localStorage.getItem('access_token'),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'Erreur boutique');return data}
async function equipAvatar(item_id){try{const data=await apiGroupAvatar('/equip','POST',{group_id:active.id,item_id});active.avatar_url=data.avatar_url;active.avatar_item_id=item_id;close('group-avatar-modal');renderHeader();renderDetails();await loadGroups();if(active){renderHeader();renderDetails();}notify('Avatar du groupe mis à jour')}catch(e){notify(e.message)}}

 document.addEventListener('DOMContentLoaded',()=>{if(!$('group-create-open'))return;
 if($('group-create-open')) $('group-create-open').onclick=()=>{open('group-create-modal');createPicker()};
 document.querySelectorAll('[data-close-group]').forEach(b=>b.onclick=()=>close(b.dataset.closeGroup));
 document.querySelectorAll('.group-overlay').forEach(overlay=>overlay.addEventListener('click',e=>{if(e.target===overlay)close(overlay.id)}));
 $('group-create-form').onsubmit=async e=>{e.preventDefault();const name=$('group-name').value.trim();const friend_ids=[...document.querySelectorAll('#group-friend-picker input:checked')].map(x=>Number(x.value));try{const d=await apiGroup('','POST',{name,friend_ids});close('group-create-modal');$('group-create-form').reset();await loadGroups();await openChat(d.group.id);notify('Groupe créé !')}catch(err){notify(err.message)}};
 $('group-chat-form').onsubmit=async e=>{e.preventDefault();if(!active)return;const input=$('group-chat-input'),content=input.value.trim();if(!content)return;try{await apiGroup('/'+active.id+'/messages','POST',{content,reply_to_id:window.ChatCommon?.replyId('group')});input.value='';window.ChatCommon?.clearReply('group');await loadMessages()}catch(err){notify(err.message)}};
 const menu=$('group-menu');
 const hideMenu=()=>{if(menu)menu.hidden=true;$('group-menu-toggle')?.setAttribute('aria-expanded','false')};
 if($('group-back')) $('group-back').onclick=()=>{hideMenu();close('group-chat-modal')};
 $('group-menu-toggle')?.setAttribute('aria-expanded','false');
 if($('group-menu-toggle')) $('group-menu-toggle').onclick=e=>{e.stopPropagation();if(!menu)return;menu.hidden=!menu.hidden;$('group-menu-toggle')?.setAttribute('aria-expanded',String(!menu.hidden))};
 document.addEventListener('click',e=>{if(menu&&!menu.hidden&&!menu.contains(e.target)&&e.target!==$('group-menu-toggle'))hideMenu()});
 if($('group-header-avatar-button')) $('group-header-avatar-button').onclick=()=>{hideMenu();renderDetails();open('group-details-modal')};
 if($('group-details-open')) $('group-details-open').onclick=()=>{hideMenu();renderDetails();open('group-details-modal')};
 if($('group-menu-invite')) $('group-menu-invite').onclick=()=>{hideMenu();if(Number(active?.owner_id)!==me()){notify('Seul le créateur peut ajouter des membres actuellement.');return;}open('group-add-modal');addPicker()};
 if($('group-menu-link')) $('group-menu-link').onclick=()=>{hideMenu();notify('Le lien d’invitation nécessite une route API sécurisée non fournie.')};
 if($('group-menu-silent')) $('group-menu-silent').onclick=()=>{hideMenu();notify('Les préférences de notification nécessitent une route API.')};
 if($('group-menu-leave')) $('group-menu-leave').onclick=()=>{hideMenu();$('group-leave').click()};
 if($('group-menu-delete')) $('group-menu-delete').onclick=()=>{hideMenu();$('group-delete').click()};
 if($('group-details-avatar-button')) $('group-details-avatar-button').addEventListener('click',e=>{e.preventDefault();showAvatarShop()});
 if($('group-president-open')) $('group-president-open').onclick=()=>{window.location.href='/games/president'};
 document.querySelectorAll('[data-group-tab]').forEach(button=>button.onclick=()=>{hideMenu();setGroupTab(button.dataset.groupTab)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu&&!menu.hidden)hideMenu()});
 if($('group-add-friend')) $('group-add-friend').onclick=()=>{open('group-add-modal');addPicker()};
 if($('group-leave')) $('group-leave').onclick=async()=>{if(!active||!confirm('Quitter ce groupe ?'))return;try{await apiGroup('/'+active.id+'/leave','POST');active=null;close('group-chat-modal');await loadGroups()}catch(e){notify(e.message)}};
 if($('group-delete')) $('group-delete').onclick=async()=>{if(!active||!confirm('Supprimer ce groupe et tous ses messages définitivement ?'))return;try{await apiGroup('/'+active.id,'DELETE');active=null;close('group-chat-modal');await loadGroups()}catch(e){notify(e.message)}};
 loadGroups();setInterval(()=>{if(!document.hidden){loadGroups();loadMessages()}},4000);
 // Signal Socket.IO facultatif ; le polling assure le fonctionnement même si WebSocket échoue.
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadGroups();loadMessages()}});
});
})();