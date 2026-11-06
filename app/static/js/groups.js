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
        ic.className='group-entry-icon';ic.textContent='👥';
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
        active=updated;renderHeader()}
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
 $('group-chat-members').textContent=active.members.map(x=> x.pseudo || x.username).join(', ');
 $('group-add-friend').hidden=active.owner_id!==me();
 $('group-delete').hidden=active.owner_id!==me();
 $('group-leave').hidden=active.owner_id===me()
}
window.openFriendGroupChat = id => openChat(Number(id));
async function openChat(id){active=groups.find(g=>g.id===id);if(!active)return;lastId=0;lastDay=null;$('group-chat-messages').replaceChildren();renderHeader();open('group-chat-modal');await loadMessages()}
function renderGroupMessage(m)
{
 const mine=Number(m.sender_id)===me();
 const memberInfo=active?.members?.find(x=>Number(x.id)===Number(m.sender_id));
 const row=document.createElement('div');row.className='group-chat-row '+(mine?'is-mine':'is-received');
 const avatar=document.createElement('span');avatar.className='group-chat-avatar';
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
document.addEventListener('DOMContentLoaded',()=>{if(!$('group-create-open'))return;
 $('group-create-open').onclick=()=>{open('group-create-modal');createPicker()};
 document.querySelectorAll('[data-close-group]').forEach(b=>b.onclick=()=>close(b.dataset.closeGroup));
 document.querySelectorAll('.group-overlay').forEach(overlay=>overlay.addEventListener('click',e=>{if(e.target===overlay)close(overlay.id)}));
 $('group-create-form').onsubmit=async e=>{e.preventDefault();const name=$('group-name').value.trim();const friend_ids=[...document.querySelectorAll('#group-friend-picker input:checked')].map(x=>Number(x.value));try{const d=await apiGroup('','POST',{name,friend_ids});close('group-create-modal');$('group-create-form').reset();await loadGroups();await openChat(d.group.id);notify('Groupe créé !')}catch(err){notify(err.message)}};
 $('group-chat-form').onsubmit=async e=>{e.preventDefault();if(!active)return;const input=$('group-chat-input'),content=input.value.trim();if(!content)return;try{await apiGroup('/'+active.id+'/messages','POST',{content,reply_to_id:window.ChatCommon?.replyId('group')});input.value='';window.ChatCommon?.clearReply('group');await loadMessages()}catch(err){notify(err.message)}};
 $('group-add-friend').onclick=()=>{open('group-add-modal');addPicker()};
 $('group-leave').onclick=async()=>{if(!active||!confirm('Quitter ce groupe ?'))return;try{await apiGroup('/'+active.id+'/leave','POST');active=null;close('group-chat-modal');await loadGroups()}catch(e){notify(e.message)}};
 $('group-delete').onclick=async()=>{if(!active||!confirm('Supprimer ce groupe et tous ses messages définitivement ?'))return;try{await apiGroup('/'+active.id,'DELETE');active=null;close('group-chat-modal');await loadGroups()}catch(e){notify(e.message)}};
 loadGroups();setInterval(()=>{if(!document.hidden){loadGroups();loadMessages()}},4000);
 // Signal Socket.IO facultatif ; le polling assure le fonctionnement même si WebSocket échoue.
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadGroups();loadMessages()}});
});
})();