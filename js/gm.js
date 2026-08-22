(() => {
  const client=window.hcaSupabase; if(!client)return;
  const login=document.getElementById('gm-login'),app=document.getElementById('gm-app'),form=document.getElementById('gm-login-form'),error=document.getElementById('gm-login-error');
  function showLogin(msg=''){login.hidden=false;app.hidden=true;error.textContent=msg}
  async function loadAccess(user){
    const {data,error:err}=await client.from('hca_users').select('role,team_id,status,teams(name)').eq('user_id',user.id).maybeSingle();
    if(err)throw err;
    if(!data||data.role!=='GM'||data.status!=='ACTIVE')throw new Error('This account is not assigned to a team GM role yet. Ask an HCA admin to add your email and team.');
    document.getElementById('gm-user-email').textContent=`SIGNED IN AS ${user.email} • ${window.hcaDisplayTeamName(data.teams?.name||'TEAM GM')}`;
    const link=document.getElementById('gm-games-link'); if(link)link.href=`team.html?id=${encodeURIComponent(data.team_id)}`;
  }
  async function showApp(user){try{await loadAccess(user);login.hidden=true;app.hidden=false}catch(e){await client.auth.signOut();showLogin(e.message)}}
  async function check(){const {data}=await client.auth.getSession();if(data.session?.user)await showApp(data.session.user);else showLogin()}
  form?.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';const b=form.querySelector('button');b.disabled=true;b.textContent='SIGNING IN...';try{const {data,error:err}=await client.auth.signInWithPassword({email:document.getElementById('gm-email').value.trim(),password:document.getElementById('gm-password').value});if(err)throw err;await showApp(data.user)}catch(err){error.textContent=err.message||'Unable to sign in.'}finally{b.disabled=false;b.textContent='SIGN IN'}});
  document.getElementById('gm-logout')?.addEventListener('click',async()=>{await client.auth.signOut();showLogin()});client.auth.onAuthStateChange((_e,s)=>{if(s?.user)void showApp(s.user);else showLogin()});check();
})();
