(() => {
  const c = window.hcaSupabase;
  if (!c) return;
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const clean=v=>window.hcaDisplayTeamName(v||'');
  const teamsById=id=>teamCache.find(t=>String(t.id)===String(id));
  let teamCache=[], playerCache=[];
  let txRows=[], newsRows=[];

  async function loadTeamCache(){const {data,error}=await c.from('teams').select('id,name,city,conference,division,logo,primary_color,secondary_color,wins,losses,overtime_losses,points').order('name');if(error)throw error;teamCache=data||[];return teamCache;}
  async function loadPlayerCache(){const {data,error}=await c.from('players').select('id,player_name').order('player_name');if(error)throw error;playerCache=data||[];return playerCache;}
  function teamOptions(selected='', includeBlank=true){return (includeBlank?'<option value="">NONE</option>':'')+teamCache.map(t=>`<option value="${esc(t.id)}" ${String(t.id)===String(selected)?'selected':''}>${esc(clean(t.name))}</option>`).join('');}

  /* ---------------- TEAMS ---------------- */
  async function loadAdminTeams(){
    const body=document.getElementById('admin-teams-body'); if(!body)return;
    body.innerHTML='<tr><td colspan="8" class="admin-table-empty">Loading teams...</td></tr>';
    try{await loadTeamCache();body.innerHTML=teamCache.map(t=>`<tr><td><strong>${esc(clean(t.name))}</strong></td><td>${esc(t.conference||'—')}</td><td>${esc(t.division||'—')}</td><td>${t.wins??0}</td><td>${t.losses??0}</td><td>${t.overtime_losses??0}</td><td><strong>${t.points??0}</strong></td><td><button class="admin-table-action" data-edit-team="${esc(t.id)}">EDIT</button></td></tr>`).join('')||'<tr><td colspan="8" class="admin-table-empty">No teams found.</td></tr>';populateAllTeamSelects();}catch(e){body.innerHTML=`<tr><td colspan="8" class="admin-table-empty">Could not load teams: ${esc(e.message)}</td></tr>`;}}
  function populateAllTeamSelects(){
    ['admin-news-team','admin-user-team','admin-transaction-from','admin-transaction-to'].forEach(id=>{const el=document.getElementById(id);if(el){const cur=el.value;el.innerHTML=teamOptions('',true);el.value=cur;}});
  }
  function updateTeamLogoPreview(url=''){
    const img=document.getElementById('admin-team-logo-preview');
    const empty=document.getElementById('admin-team-logo-preview-empty');
    if(!img||!empty)return;
    if(url){
      img.src=url;
      img.hidden=false;
      empty.hidden=true;
      img.onerror=()=>{img.hidden=true;empty.hidden=false;empty.textContent='LOGO COULD NOT LOAD';};
    }else{
      img.removeAttribute('src');
      img.hidden=true;
      empty.hidden=false;
      empty.textContent='NO LOGO';
    }
  }
  function openTeam(t=null){
    const m=document.getElementById('admin-team-modal');if(!m)return;
    document.getElementById('admin-team-modal-title').textContent=t?'EDIT TEAM':'ADD TEAM';
    document.getElementById('admin-team-id').value=t?.id||'';
    document.getElementById('admin-team-name').value=t?.name||'';
    document.getElementById('admin-team-city').value=t?.city||'';
    document.getElementById('admin-team-conference').value=t?.conference||'';
    document.getElementById('admin-team-division').value=t?.division||'';
    document.getElementById('admin-team-logo').value=t?.logo||'';
    const file=document.getElementById('admin-team-logo-file'); if(file)file.value='';
    updateTeamLogoPreview(t?.logo||'');
    document.getElementById('admin-team-primary').value=t?.primary_color||'';
    document.getElementById('admin-team-secondary').value=t?.secondary_color||'';
    document.getElementById('admin-team-wins').value=t?.wins??0;
    document.getElementById('admin-team-losses').value=t?.losses??0;
    document.getElementById('admin-team-otl').value=t?.overtime_losses??0;
    document.getElementById('admin-team-points').value=t?.points??0;
    document.getElementById('admin-team-form-error').textContent='';
    m.hidden=false;document.body.classList.add('admin-modal-open');
  }
  async function uploadTeamLogo(file,teamId){
    if(!file)return null;
    if(!file.type.startsWith('image/'))throw new Error('Please choose an image file.');
    if(file.size>5*1024*1024)throw new Error('Team logos must be 5 MB or smaller.');
    const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'')||'png';
    const path=`${teamId}/logo-${Date.now()}.${ext}`;
    const {error}=await c.storage.from('team-logos').upload(path,file,{upsert:true,contentType:file.type});
    if(error)throw new Error(`Logo upload failed. Run team_logo_storage_setup.sql first. ${error.message}`);
    const {data}=c.storage.from('team-logos').getPublicUrl(path);
    return data.publicUrl;
  }
  function closeTeam(){const m=document.getElementById('admin-team-modal');if(m)m.hidden=true;document.body.classList.remove('admin-modal-open')}
  async function saveTeam(e){
    e.preventDefault();
    const err=document.getElementById('admin-team-form-error'),id=document.getElementById('admin-team-id').value;
    err.textContent='';
    try{
      const name=document.getElementById('admin-team-name').value.trim();
      if(!name)throw new Error('Team name is required.');
      const teamId=id||crypto.randomUUID().replaceAll('-','').slice(0,24);
      const file=document.getElementById('admin-team-logo-file')?.files?.[0];
      let logo=document.getElementById('admin-team-logo').value.trim()||'';
      if(file)logo=await uploadTeamLogo(file,teamId);
      const payload={
        name,
        city:document.getElementById('admin-team-city').value.trim()||null,
        conference:document.getElementById('admin-team-conference').value.trim()||null,
        division:document.getElementById('admin-team-division').value.trim()||null,
        logo,
        primary_color:document.getElementById('admin-team-primary').value.trim()||'#111111',
        secondary_color:document.getElementById('admin-team-secondary').value.trim()||'#FFFFFF',
        wins:Number(document.getElementById('admin-team-wins').value)||0,
        losses:Number(document.getElementById('admin-team-losses').value)||0,
        overtime_losses:Number(document.getElementById('admin-team-otl').value)||0,
        points:Number(document.getElementById('admin-team-points').value)||0
      };
      const {error}=id
        ?await c.from('teams').update(payload).eq('id',id)
        :await c.from('teams').insert({...payload,id:teamId});
      if(error)throw error;
      closeTeam();
      document.getElementById('admin-team-message').textContent=id?'Team updated.':'Team added.';
      await loadAdminTeams();
    }catch(x){err.textContent=x.message||'Could not save team.'}
  }

  /* ---------------- TRANSACTIONS ---------------- */
  async function loadTransactions(){const body=document.getElementById('admin-transactions-body');if(!body)return;const {data,error}=await c.from('transactions').select('id,season,transaction_date,type,player_id,from_team_id,to_team_id,details,status,players(player_name)').order('transaction_date',{ascending:false});if(error){body.innerHTML='<tr><td colspan="7" class="admin-table-empty">Run the HCA v12 setup SQL to enable transactions.</td></tr>';return;}txRows=data||[];renderTransactions();populateTransactionSelects();}
  function renderTransactions(){const body=document.getElementById('admin-transactions-body'),filter=document.getElementById('admin-transaction-type')?.value||'all';if(!body)return;const rows=txRows.filter(x=>filter==='all'||x.type===filter);document.getElementById('admin-transaction-count').textContent=`SHOWING ${rows.length} OF ${txRows.length} TRANSACTIONS`;body.innerHTML=rows.map(x=>`<tr><td>${esc(x.transaction_date||'—')}</td><td>${esc(x.type||'—')}</td><td>${esc(x.players?.player_name||'—')}</td><td>${esc(clean(teamsById(x.from_team_id)?.name||'—'))}</td><td>${esc(clean(teamsById(x.to_team_id)?.name||'—'))}</td><td>${esc(x.details||'—')}</td><td><button class="admin-table-action" data-edit-transaction="${esc(x.id)}">EDIT</button> <button class="admin-table-action admin-table-danger" data-delete-transaction="${esc(x.id)}">DELETE</button></td></tr>`).join('')||'<tr><td colspan="7" class="admin-table-empty">No transactions found.</td></tr>';}
  function populateTransactionSelects(){const p=document.getElementById('admin-transaction-player');if(p){const cur=p.value;p.innerHTML='<option value="">NONE</option>'+playerCache.map(x=>`<option value="${esc(x.id)}">${esc(x.player_name)}</option>`).join('');p.value=cur;}['admin-transaction-from','admin-transaction-to'].forEach(id=>{const s=document.getElementById(id);if(s){const cur=s.value;s.innerHTML=teamOptions('',true);s.value=cur;}})}
  function openTransaction(x=null){const m=document.getElementById('admin-transaction-modal');if(!m)return;document.getElementById('admin-transaction-id').value=x?.id||'';document.getElementById('admin-transaction-date').value=x?.transaction_date||new Date().toISOString().slice(0,10);document.getElementById('admin-transaction-season').value=x?.season||'Season 16';document.getElementById('admin-transaction-type-edit').value=x?.type||'TRADE';document.getElementById('admin-transaction-player').value=x?.player_id||'';document.getElementById('admin-transaction-from').value=x?.from_team_id||'';document.getElementById('admin-transaction-to').value=x?.to_team_id||'';document.getElementById('admin-transaction-status').value=x?.status||'COMPLETED';document.getElementById('admin-transaction-details').value=x?.details||'';document.getElementById('admin-transaction-form-error').textContent='';m.hidden=false;document.body.classList.add('admin-modal-open')}
  function closeTransaction(){const m=document.getElementById('admin-transaction-modal');if(m)m.hidden=true;document.body.classList.remove('admin-modal-open')}
  async function saveTransaction(e){e.preventDefault();const err=document.getElementById('admin-transaction-form-error');err.textContent='';try{const id=document.getElementById('admin-transaction-id').value;const payload={season:document.getElementById('admin-transaction-season').value.trim()||'Season 16',transaction_date:document.getElementById('admin-transaction-date').value||null,type:document.getElementById('admin-transaction-type-edit').value,player_id:document.getElementById('admin-transaction-player').value||null,from_team_id:document.getElementById('admin-transaction-from').value||null,to_team_id:document.getElementById('admin-transaction-to').value||null,details:document.getElementById('admin-transaction-details').value.trim()||null,status:document.getElementById('admin-transaction-status').value};const {error}=id?await c.from('transactions').update(payload).eq('id',id):await c.from('transactions').insert(payload);if(error)throw error;closeTransaction();await loadTransactions()}catch(x){err.textContent=x.message||'Could not save transaction.'}}
  async function deleteTransaction(id){if(!confirm('Delete this transaction?'))return;const {error}=await c.from('transactions').delete().eq('id',id);if(error){alert(error.message);return}await loadTransactions()}

  /* ---------------- NEWS / FEED ---------------- */
  async function loadNews(){const body=document.getElementById('admin-news-body');if(!body)return;const {data,error}=await c.from('news_posts').select('id,title,post_type,team_id,published,published_at,created_at,teams(name)').order('created_at',{ascending:false});if(error){body.innerHTML='<tr><td colspan="6" class="admin-table-empty">Run the HCA v12 setup SQL to enable the feed.</td></tr>';return}newsRows=data||[];body.innerHTML=newsRows.map(x=>`<tr><td><strong>${esc(x.title)}</strong></td><td>${esc(x.post_type||'NEWS')}</td><td>${esc(clean(x.teams?.name||'League-wide'))}</td><td>${x.published?'PUBLISHED':'DRAFT'}</td><td>${esc(x.published_at?new Date(x.published_at).toLocaleDateString():'—')}</td><td><button class="admin-table-action" data-edit-news="${esc(x.id)}">EDIT</button> <button class="admin-table-action admin-table-danger" data-delete-news="${esc(x.id)}">DELETE</button></td></tr>`).join('')||'<tr><td colspan="6" class="admin-table-empty">No posts yet.</td></tr>';}
  function openNews(x=null){const m=document.getElementById('admin-news-modal');if(!m)return;document.getElementById('admin-news-id').value=x?.id||'';document.getElementById('admin-news-title').value=x?.title||'';document.getElementById('admin-news-type').value=x?.post_type||'NEWS';document.getElementById('admin-news-team').value=x?.team_id||'';document.getElementById('admin-news-published').value=String(x?.published??true);document.getElementById('admin-news-body-input').value=x?.body||'';document.getElementById('admin-news-form-error').textContent='';m.hidden=false;document.body.classList.add('admin-modal-open')}
  function closeNews(){const m=document.getElementById('admin-news-modal');if(m)m.hidden=true;document.body.classList.remove('admin-modal-open')}
  async function saveNews(e){e.preventDefault();const err=document.getElementById('admin-news-form-error');err.textContent='';try{const id=document.getElementById('admin-news-id').value,published=document.getElementById('admin-news-published').value==='true';const payload={title:document.getElementById('admin-news-title').value.trim(),body:document.getElementById('admin-news-body-input').value.trim(),post_type:document.getElementById('admin-news-type').value,team_id:document.getElementById('admin-news-team').value||null,published,published_at:published?new Date().toISOString():null};if(!payload.title||!payload.body)throw new Error('Title and body are required.');const {error}=id?await c.from('news_posts').update(payload).eq('id',id):await c.from('news_posts').insert(payload);if(error)throw error;closeNews();await loadNews()}catch(x){err.textContent=x.message||'Could not save post.'}}
  async function deleteNews(id){if(!confirm('Delete this post?'))return;const {error}=await c.from('news_posts').delete().eq('id',id);if(error){alert(error.message);return}await loadNews()}

  /* ---------------- USERS / GMS ---------------- */
  async function loadUsers(){const body=document.getElementById('admin-users-body');if(!body)return;const {data,error}=await c.from('hca_users').select('id,email,role,team_id,status,user_id,teams(name)').order('email');if(error){body.innerHTML='<tr><td colspan="5" class="admin-table-empty">Run the HCA v12 setup SQL to enable user management.</td></tr>';return}body.innerHTML=(data||[]).map(x=>`<tr><td><strong>${esc(x.email)}</strong></td><td>${esc(x.role)}</td><td>${esc(clean(x.teams?.name||'No team'))}</td><td>${esc(x.status||'PENDING')}</td><td><button class="admin-table-action admin-table-danger" data-delete-user="${esc(x.id)}">REMOVE</button></td></tr>`).join('')||'<tr><td colspan="5" class="admin-table-empty">No GM/editor assignments yet.</td></tr>';}
  function openUser(){const m=document.getElementById('admin-user-modal');if(!m)return;document.getElementById('admin-user-form').reset();document.getElementById('admin-user-form-error').textContent='';document.getElementById('admin-user-team').innerHTML=teamOptions('',true);m.hidden=false;document.body.classList.add('admin-modal-open')}
  function closeUser(){const m=document.getElementById('admin-user-modal');if(m)m.hidden=true;document.body.classList.remove('admin-modal-open')}
  async function saveUser(e){e.preventDefault();const err=document.getElementById('admin-user-form-error');err.textContent='';try{const email=document.getElementById('admin-user-email-input').value.trim().toLowerCase(),role=document.getElementById('admin-user-role').value,team_id=document.getElementById('admin-user-team').value||null;if(!email)throw new Error('Email is required.');const {error}=await c.rpc('admin_upsert_hca_user',{p_email:email,p_role:role,p_team_id:team_id});if(error)throw error;closeUser();await loadUsers()}catch(x){err.textContent=x.message||'Could not add user.'}}
  async function deleteUser(id){if(!confirm('Remove this HCA access assignment?'))return;const {error}=await c.from('hca_users').delete().eq('id',id);if(error){alert(error.message);return}await loadUsers()}

  /* ---------------- PLAYOFF YEARS ---------------- */
  async function loadPlayoffYears(){const s=document.getElementById('admin-bracket-season');if(!s)return;const {data,error}=await c.from('playoff_years').select('season').eq('enabled',true).order('season',{ascending:false});if(error)return;const cur=s.value;const years=data||[];s.innerHTML=years.map(x=>`<option>${esc(x.season)}</option>`).join('')||'<option>Season 16</option>';if(years.some(x=>x.season===cur))s.value=cur;}
  async function addPlayoffYear(){const season=prompt('Enter the playoff season name, e.g. Season 17:','Season 17');if(!season?.trim())return;const value=season.trim();const {error}=await c.from('playoff_years').upsert({season:value,display_name:`${value} Playoffs`,enabled:true},{onConflict:'season'});if(error){alert(error.message);return}const {error:be}=await c.from('playoff_brackets').upsert({season:value,name:`HCA ${value} Playoffs`,bracket_data:{rounds:{r1:Array.from({length:8},()=>({team1_id:'',team2_id:'',score1:null,score2:null})),r2:Array.from({length:4},()=>({team1_id:'',team2_id:'',score1:null,score2:null})),r3:Array.from({length:2},()=>({team1_id:'',team2_id:'',score1:null,score2:null})),r4:[{team1_id:'',team2_id:'',score1:null,score2:null}]}}},{onConflict:'season'});if(be){alert(be.message);return}await loadPlayoffYears();document.getElementById('admin-bracket-season').value=value;document.getElementById('admin-bracket-season').dispatchEvent(new Event('change'))}
  async function deletePlayoffYear(){const s=document.getElementById('admin-bracket-season').value;if(!s||!confirm(`Delete ${s} playoff year and bracket?`))return;await c.from('playoff_brackets').delete().eq('season',s);await c.from('playoff_years').delete().eq('season',s);await loadPlayoffYears();document.getElementById('admin-bracket-season').dispatchEvent(new Event('change'))}

  async function loadSection(name){try{if(name==='teams')await loadAdminTeams();if(name==='transactions'){await loadTeamCache();await loadPlayerCache();await loadTransactions()}if(name==='news'){await loadTeamCache();await loadNews()}if(name==='users'){await loadTeamCache();await loadUsers()}if(name==='playoffs'){await loadPlayoffYears();document.getElementById('admin-bracket-season')?.dispatchEvent(new Event('change'))}}catch(e){console.error('HCA admin enhancement:',e)}}
  document.addEventListener('click',e=>{
    const section=e.target.closest('[data-section]');if(section)void loadSection(section.dataset.section);
    if(e.target.closest('#admin-add-team'))openTeam();
    const et=e.target.closest('[data-edit-team]');if(et)openTeam(teamCache.find(t=>String(t.id)===String(et.dataset.editTeam)));
    if(e.target.closest('[data-close-team-modal]'))closeTeam();
    if(e.target.closest('#admin-add-transaction')){populateTransactionSelects();openTransaction()}
    const ex=e.target.closest('[data-edit-transaction]');if(ex)openTransaction(txRows.find(x=>String(x.id)===String(ex.dataset.editTransaction)));
    if(e.target.closest('[data-delete-transaction]'))void deleteTransaction(e.target.closest('[data-delete-transaction]').dataset.deleteTransaction);
    if(e.target.closest('[data-close-transaction-modal]'))closeTransaction();
    if(e.target.closest('#admin-add-news'))openNews();
    const en=e.target.closest('[data-edit-news]');if(en)openNews(newsRows.find(x=>String(x.id)===String(en.dataset.editNews)));
    if(e.target.closest('[data-delete-news]'))void deleteNews(e.target.closest('[data-delete-news]').dataset.deleteNews);
    if(e.target.closest('[data-close-news-modal]'))closeNews();
    if(e.target.closest('#admin-add-user'))openUser();
    if(e.target.closest('[data-delete-user]'))void deleteUser(e.target.closest('[data-delete-user]').dataset.deleteUser);
    if(e.target.closest('[data-close-user-modal]'))closeUser();
    if(e.target.closest('#admin-add-playoff-year'))void addPlayoffYear();
    if(e.target.closest('#admin-delete-playoff-year'))void deletePlayoffYear();
  });
  document.addEventListener('change',e=>{if(e.target.id==='admin-transaction-type')renderTransactions()});
  document.getElementById('admin-team-form')?.addEventListener('submit',saveTeam);
  document.getElementById('admin-team-logo')?.addEventListener('input',e=>updateTeamLogoPreview(e.target.value.trim()));
  document.getElementById('admin-team-logo-file')?.addEventListener('change',e=>{
    const file=e.target.files?.[0]; if(!file)return;
    updateTeamLogoPreview(URL.createObjectURL(file));
  });
  document.getElementById('admin-transaction-form')?.addEventListener('submit',saveTransaction);
  document.getElementById('admin-news-form')?.addEventListener('submit',saveNews);
  document.getElementById('admin-user-form')?.addEventListener('submit',saveUser);
  document.addEventListener('hca:admin-ready',()=>loadSection('dashboard'));
})();
