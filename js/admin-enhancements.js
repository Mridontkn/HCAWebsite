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
  async function saveTransaction(e){
    e.preventDefault();const err=document.getElementById('admin-transaction-form-error');err.textContent='';
    try{
      const id=document.getElementById('admin-transaction-id').value;
      const type=document.getElementById('admin-transaction-type-edit').value;
      const playerId=document.getElementById('admin-transaction-player').value||null;
      const fromTeam=document.getElementById('admin-transaction-from').value||null;
      const toTeam=document.getElementById('admin-transaction-to').value||null;
      const status=document.getElementById('admin-transaction-status').value;
      const apply=document.getElementById('admin-transaction-apply')?.checked;
      const payload={season:document.getElementById('admin-transaction-season').value.trim()||'Season 16',transaction_date:document.getElementById('admin-transaction-date').value||null,type,player_id:playerId,from_team_id:fromTeam,to_team_id:toTeam,details:document.getElementById('admin-transaction-details').value.trim()||null,status};
      const {error}=id?await c.from('transactions').update(payload).eq('id',id):await c.from('transactions').insert(payload);if(error)throw error;
      if(apply&&status==='COMPLETED'&&playerId){
        const target=type==='RELEASE'?null:toTeam;
        const team=target?teamCache.find(t=>String(t.id)===String(target)):null;
        const {error:pe}=await c.from('players').update({team_id:target,team_name:team?.name||null,status:target?'Active':'Free Agent'}).eq('id',playerId);if(pe)throw pe;
      }
      closeTransaction();await loadPlayerCache();await loadTransactions();
    }catch(x){err.textContent=x.message||'Could not save transaction.'}
  }
  async function deleteTransaction(id){if(!confirm('Delete this transaction?'))return;const {error}=await c.from('transactions').delete().eq('id',id);if(error){alert(error.message);return}await loadTransactions()}

  /* ---------------- CONTRACTS + CAP ---------------- */
  let contractRows = [], capSettings = [];
  const seasonNumber = v => Number(String(v || '').match(/\d+/)?.[0] || 16);
  const money = v => new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(Number(v)||0);
  const contractEnd = x => Number(x.start_season || 16) + Math.max(1,Number(x.term_years)||1) - 1;
  const activeContract = (x,n) => x.status === 'ACTIVE' && n >= Number(x.start_season||16) && n <= contractEnd(x);

  async function loadCapSettings(){
    const {data,error}=await c.from('league_settings').select('season,salary_cap,currency').order('season',{ascending:false});
    if(error) throw error;
    capSettings=data||[];
    const select=document.getElementById('admin-contract-season');
    if(select){const cur=select.value;select.innerHTML=capSettings.map(x=>`<option value="${seasonNumber(x.season)}">${esc(x.season)}</option>`).join('')||'<option value="16">SEASON 16</option>';if([...select.options].some(o=>o.value===cur))select.value=cur;}
  }
  function populateContractSelects(){
    const p=document.getElementById('admin-contract-player');
    if(p){const cur=p.value;p.innerHTML='<option value="">SELECT PLAYER</option>'+playerCache.map(x=>`<option value="${esc(x.id)}">${esc(x.player_name)}</option>`).join('');p.value=cur;}
    const t=document.getElementById('admin-contract-team-edit');
    if(t){const cur=t.value;t.innerHTML='<option value="">SELECT TEAM</option>'+teamCache.map(x=>`<option value="${esc(x.id)}">${esc(clean(x.name))}</option>`).join('');t.value=cur;}
    const filter=document.getElementById('admin-contract-team');
    if(filter){const cur=filter.value;filter.innerHTML='<option value="all">ALL TEAMS</option>'+teamCache.map(x=>`<option value="${esc(x.id)}">${esc(clean(x.name))}</option>`).join('');filter.value=cur;}
  }
  async function loadContracts(){
    const body=document.getElementById('admin-contracts-body');if(!body)return;
    body.innerHTML='<tr><td colspan="8" class="admin-table-empty">Loading contracts...</td></tr>';
    const {data,error}=await c.from('player_contracts').select('id,player_id,team_id,season,start_season,term_years,annual_salary,contract_type,status,signed_date,notes,players(player_name),teams(name)').order('annual_salary',{ascending:false});
    if(error){body.innerHTML='<tr><td colspan="8" class="admin-table-empty">Run the contracts/cap setup SQL first.</td></tr>';return;}
    contractRows=data||[];populateContractSelects();renderContracts();renderCapSummary();
  }
  function renderContracts(){
    const body=document.getElementById('admin-contracts-body');if(!body)return;
    const n=Number(document.getElementById('admin-contract-season')?.value||16),team=document.getElementById('admin-contract-team')?.value||'all',status=document.getElementById('admin-contract-status')?.value||'ACTIVE';
    let rows=contractRows.filter(x=>n>=Number(x.start_season||16)&&n<=contractEnd(x));
    if(status!=='ALL')rows=rows.filter(x=>x.status===status);if(team!=='all')rows=rows.filter(x=>String(x.team_id)===String(team));
    document.getElementById('admin-contract-count').textContent=`SHOWING ${rows.length} OF ${contractRows.length} CONTRACTS`;
    body.innerHTML=rows.map(x=>`<tr><td><strong>${esc(x.players?.player_name||'Unknown Player')}</strong></td><td>${esc(clean(x.teams?.name||'Free Agent'))}</td><td><strong>${money(x.annual_salary)}</strong></td><td>${x.term_years} YR</td><td>SEASON ${contractEnd(x)}</td><td>${esc(x.contract_type||'STANDARD')}</td><td>${esc(x.status||'—')}</td><td><button class="admin-table-action" data-edit-contract="${esc(x.id)}">EDIT</button> <button class="admin-table-action admin-table-danger" data-delete-contract="${esc(x.id)}">DELETE</button></td></tr>`).join('')||'<tr><td colspan="8" class="admin-table-empty">No contracts match this filter.</td></tr>';
  }
  function renderCapSummary(){
    const el=document.getElementById('admin-contract-summary');if(!el)return;
    const n=Number(document.getElementById('admin-contract-season')?.value||16),filter=document.getElementById('admin-contract-team')?.value||'all';
    const setting=capSettings.find(x=>seasonNumber(x.season)===n),cap=Number(setting?.salary_cap)||0;
    const list=teamCache.filter(t=>filter==='all'||String(t.id)===String(filter));
    el.innerHTML=list.map(t=>{const payroll=contractRows.filter(x=>String(x.team_id)===String(t.id)&&activeContract(x,n)).reduce((sum,x)=>sum+Number(x.annual_salary||0),0),space=cap-payroll;return `<article><span>${esc(clean(t.name))}</span><strong>${money(payroll)}</strong><small>CAP HIT · ${money(cap)} CAP · <b class="${space<0?'cap-over':''}">${money(space)} ${space<0?'OVER':'SPACE'}</b></small></article>`}).join('');
  }
  function openContract(x=null){
    const m=document.getElementById('admin-contract-modal');if(!m)return;populateContractSelects();
    document.getElementById('admin-contract-id').value=x?.id||'';document.getElementById('admin-contract-modal-title').textContent=x?'EDIT CONTRACT':'ADD CONTRACT';
    document.getElementById('admin-contract-player').value=x?.player_id||'';document.getElementById('admin-contract-team-edit').value=x?.team_id||'';document.getElementById('admin-contract-start-season').value=x?.start_season||16;document.getElementById('admin-contract-term').value=x?.term_years||1;document.getElementById('admin-contract-salary').value=x?.annual_salary||0;document.getElementById('admin-contract-type-edit').value=x?.contract_type||'STANDARD';document.getElementById('admin-contract-status-edit').value=x?.status||'ACTIVE';document.getElementById('admin-contract-signed-date').value=x?.signed_date||'';document.getElementById('admin-contract-notes').value=x?.notes||'';document.getElementById('admin-contract-form-error').textContent='';m.hidden=false;document.body.classList.add('admin-modal-open');
  }
  function closeContract(){const m=document.getElementById('admin-contract-modal');if(m)m.hidden=true;document.body.classList.remove('admin-modal-open');}
  async function saveContract(e){
    e.preventDefault();const err=document.getElementById('admin-contract-form-error');err.textContent='';
    try{
      const id=document.getElementById('admin-contract-id').value,playerId=document.getElementById('admin-contract-player').value,teamId=document.getElementById('admin-contract-team-edit').value,start=Number(document.getElementById('admin-contract-start-season').value),term=Number(document.getElementById('admin-contract-term').value),salary=Number(document.getElementById('admin-contract-salary').value);
      if(!playerId||!teamId)throw new Error('Select a player and team.');if(!Number.isInteger(start)||start<1)throw new Error('Start season must be valid.');if(!Number.isInteger(term)||term<1)throw new Error('Term must be at least 1 year.');if(!Number.isFinite(salary)||salary<0)throw new Error('Salary must be zero or greater.');
      const {data:session}=await c.auth.getSession();const payload={player_id:playerId,team_id:teamId,season:`Season ${start}`,start_season:start,term_years:term,annual_salary:salary,contract_type:document.getElementById('admin-contract-type-edit').value,status:document.getElementById('admin-contract-status-edit').value,signed_date:document.getElementById('admin-contract-signed-date').value||null,notes:document.getElementById('admin-contract-notes').value.trim()||null,created_by_id:session.session?.user?.id||null,updated_at:new Date().toISOString()};
      const {error}=id?await c.from('player_contracts').update(payload).eq('id',id):await c.from('player_contracts').insert(payload);if(error)throw error;
      if(payload.status==='ACTIVE'){const team=teamCache.find(t=>String(t.id)===String(teamId));const {error:pe}=await c.from('players').update({team_id:teamId,team_name:team?.name||null,status:'Active'}).eq('id',playerId);if(pe)throw pe;}
      closeContract();await loadTeamCache();await loadPlayerCache();await loadContracts();
    }catch(x){err.textContent=x.message||'Could not save contract.';}
  }
  async function deleteContract(id){if(!confirm('Delete this contract?'))return;const {error}=await c.from('player_contracts').delete().eq('id',id);if(error){alert(error.message);return}await loadContracts();}
  function openCap(){const m=document.getElementById('admin-cap-modal');if(!m)return;const n=Number(document.getElementById('admin-contract-season')?.value||16),setting=capSettings.find(x=>seasonNumber(x.season)===n);document.getElementById('admin-cap-season-name').value=setting?.season||`Season ${n}`;document.getElementById('admin-cap-value').value=setting?.salary_cap??100000000;document.getElementById('admin-cap-currency').value=setting?.currency||'CAD';document.getElementById('admin-cap-form-error').textContent='';m.hidden=false;document.body.classList.add('admin-modal-open');}
  function closeCap(){const m=document.getElementById('admin-cap-modal');if(m)m.hidden=true;document.body.classList.remove('admin-modal-open');}
  async function saveCap(e){e.preventDefault();const err=document.getElementById('admin-cap-form-error');err.textContent='';try{const season=document.getElementById('admin-cap-season-name').value.trim(),salary=Number(document.getElementById('admin-cap-value').value),currency=document.getElementById('admin-cap-currency').value;if(!season||!Number.isFinite(salary)||salary<0)throw new Error('Enter a valid season and salary cap.');const {error}=await c.from('league_settings').upsert({season,salary_cap:salary,currency,updated_at:new Date().toISOString()},{onConflict:'season'});if(error)throw error;closeCap();await loadCapSettings();document.getElementById('admin-contract-season').value=seasonNumber(season);renderContracts();renderCapSummary();}catch(x){err.textContent=x.message||'Could not save salary cap.';}}

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

  async function loadSection(name){try{if(name==='teams')await loadAdminTeams();if(name==='transactions'){await loadTeamCache();await loadPlayerCache();await loadTransactions()}if(name==='contracts'){await loadTeamCache();await loadPlayerCache();await loadCapSettings();await loadContracts()}if(name==='news'){await loadTeamCache();await loadNews()}if(name==='users'){await loadTeamCache();await loadUsers()}if(name==='playoffs'){await loadPlayoffYears();document.getElementById('admin-bracket-season')?.dispatchEvent(new Event('change'))}}catch(e){console.error('HCA admin enhancement:',e)}}
  document.addEventListener('click',e=>{
    const section=e.target.closest('[data-section]');if(section)void loadSection(section.dataset.section);
    if(e.target.closest('#admin-add-team'))openTeam();
    const et=e.target.closest('[data-edit-team]');if(et)openTeam(teamCache.find(t=>String(t.id)===String(et.dataset.editTeam)));
    if(e.target.closest('[data-close-team-modal]'))closeTeam();
    if(e.target.closest('#admin-add-transaction')){populateTransactionSelects();openTransaction()}
    const ex=e.target.closest('[data-edit-transaction]');if(ex)openTransaction(txRows.find(x=>String(x.id)===String(ex.dataset.editTransaction)));
    if(e.target.closest('[data-delete-transaction]'))void deleteTransaction(e.target.closest('[data-delete-transaction]').dataset.deleteTransaction);
    if(e.target.closest('[data-close-transaction-modal]'))closeTransaction();
    if(e.target.closest('#admin-add-contract'))openContract();
    const ec=e.target.closest('[data-edit-contract]');if(ec)openContract(contractRows.find(x=>String(x.id)===String(ec.dataset.editContract)));
    if(e.target.closest('[data-delete-contract]'))void deleteContract(e.target.closest('[data-delete-contract]').dataset.deleteContract);
    if(e.target.closest('[data-close-contract-modal]'))closeContract();
    if(e.target.closest('#admin-edit-cap'))openCap();
    if(e.target.closest('[data-close-cap-modal]'))closeCap();
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
  document.addEventListener('change',e=>{if(e.target.id==='admin-transaction-type')renderTransactions();if(['admin-contract-season','admin-contract-team','admin-contract-status'].includes(e.target.id)){renderContracts();renderCapSummary();}});
  document.getElementById('admin-team-form')?.addEventListener('submit',saveTeam);
  document.getElementById('admin-team-logo')?.addEventListener('input',e=>updateTeamLogoPreview(e.target.value.trim()));
  document.getElementById('admin-team-logo-file')?.addEventListener('change',e=>{
    const file=e.target.files?.[0]; if(!file)return;
    updateTeamLogoPreview(URL.createObjectURL(file));
  });
  document.getElementById('admin-transaction-form')?.addEventListener('submit',saveTransaction);
  document.getElementById('admin-contract-form')?.addEventListener('submit',saveContract);
  document.getElementById('admin-cap-form')?.addEventListener('submit',saveCap);
  document.getElementById('admin-news-form')?.addEventListener('submit',saveNews);
  document.getElementById('admin-user-form')?.addEventListener('submit',saveUser);
  document.addEventListener('hca:admin-ready',()=>loadSection('dashboard'));
})();
