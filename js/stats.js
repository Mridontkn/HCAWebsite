/* HCA STATS */
(() => {
  const client = window.hcaSupabase || (typeof hcaSupabase !== "undefined" ? hcaSupabase : null);
  if (!client) { console.error("HCA Stats: Supabase client was not found."); return; }

  let playerStats = [];
  let goalieStats = [];
  let currentView = "players";
  let currentSort = "points";

  function escapeHTML(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function posText(v) { if (Array.isArray(v)) return v.join(" / "); if (v && typeof v === "object") return Object.values(v).join(" / "); return String(v || ""); }
  function isGoalie(player) { return posText(player.position).toUpperCase().split(/[\s/,]+/).includes("G"); }

  function calculatePlayerStats(players) {
    return players.filter(p => !isGoalie(p)).map(p => {
      const s = p.season_stats || {};
      return { id:p.id, name:p.player_name || "Unknown Player", team:window.hcaDisplayTeamName(p.team_name || "Free Agent"), gp:num(s.games_played ?? s.gp), goals:num(s.goals), assists:num(s.assists), points:num(s.points ?? (num(s.goals)+num(s.assists))), plusMinus:num(s.plus_minus ?? s.plusMinus) };
    });
  }

  function calculateGoalieStats(players) {
    return players.filter(isGoalie).map(p => {
      const s = p.season_stats || {};
      const gp=num(s.games_played ?? s.gp), saves=num(s.saves), ga=num(s.goals_against), shots=num(s.shots_against ?? (saves+ga));
      return { id:p.id, name:p.player_name || "Unknown Goalie", team:window.hcaDisplayTeamName(p.team_name || "Free Agent"), gp, gaa:num(s.gaa), saves, shots, svPct:num(s.save_percentage ?? (shots ? saves/shots : 0)), shutouts:num(s.shutouts), assists:num(s.assists), points:num(s.points) };
    });
  }

  function sortCurrent() {
    const list = currentView === "goalies" ? [...goalieStats] : [...playerStats];
    if (currentView === "goalies") {
      if (currentSort === "gaa") return list.sort((a,b)=>(a.gp? a.gaa:999)-(b.gp?b.gaa:999) || b.svPct-a.svPct || a.name.localeCompare(b.name));
      if (currentSort === "svPct") return list.sort((a,b)=>b.svPct-a.svPct || b.gp-a.gp || a.name.localeCompare(b.name));
      if (currentSort === "saves") return list.sort((a,b)=>b.saves-a.saves || b.gp-a.gp || a.name.localeCompare(b.name));
      if (currentSort === "shutouts") return list.sort((a,b)=>b.shutouts-a.shutouts || b.gp-a.gp || a.name.localeCompare(b.name));
      return list.sort((a,b)=>b.gp-a.gp || b.saves-a.saves || a.name.localeCompare(b.name));
    }
    if (currentSort === "goals") return list.sort((a,b)=>b.goals-a.goals || b.points-a.points || a.name.localeCompare(b.name));
    if (currentSort === "assists") return list.sort((a,b)=>b.assists-a.assists || b.points-a.points || a.name.localeCompare(b.name));
    if (currentSort === "plusMinus") return list.sort((a,b)=>b.plusMinus-a.plusMinus || b.points-a.points || a.name.localeCompare(b.name));
    return list.sort((a,b)=>b.points-a.points || b.goals-a.goals || b.assists-a.assists || a.name.localeCompare(b.name));
  }

  function renderLeaders(sorted) {
    const c=document.getElementById("hca-stats-leaders"); if(!c) return;
    const top=sorted.slice(0,3);
    if(!top.length){c.innerHTML='<div class="hca-stats-leader">No stats available.</div>';return;}
    let label="POINTS LEADER";
    if(currentView==='goalies') label=currentSort==='gaa'?'GAA LEADER':currentSort==='svPct'?'SAVE % LEADER':currentSort==='saves'?'SAVES LEADER':currentSort==='shutouts'?'SHUTOUTS LEADER':'GOALIE LEADER';
    else label=currentSort==='goals'?'GOALS LEADER':currentSort==='assists'?'ASSISTS LEADER':currentSort==='plusMinus'?'+/- LEADER':'POINTS LEADER';
    const value=p=>currentView==='goalies' ? (currentSort==='gaa'?p.gaa.toFixed(2):currentSort==='svPct'?(p.svPct*100).toFixed(1)+'%':currentSort==='saves'?p.saves:currentSort==='shutouts'?p.shutouts:p.gp) : (currentSort==='goals'?p.goals:currentSort==='assists'?p.assists:currentSort==='plusMinus'?p.plusMinus:p.points);
    c.innerHTML=top.map((p,i)=>`<article class="hca-stats-leader"><small>${i===0?escapeHTML(label):`#${i+1}`}</small><strong>${escapeHTML(value(p))}</strong><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.team)}</p></article>`).join("");
  }

  function renderTable() {
    const body=document.getElementById("hca-stats-body"), status=document.getElementById("hca-stats-status"); if(!body||!status)return;
    const sorted=sortCurrent(); renderLeaders(sorted);
    const head=document.getElementById('hca-stats-head-row');
    if(head) head.innerHTML = currentView==='goalies' ? '<th>#</th><th>GOALIE</th><th>TEAM</th><th>GP</th><th>GAA</th><th>SV%</th><th>SV</th><th>SO</th>' : '<th>#</th><th>PLAYER</th><th>TEAM</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>+/-</th>';
    status.textContent=`Season 16 • ${sorted.length} ${currentView==='goalies'?'goalies':'players'} with statistics`;
    if(!sorted.length){body.innerHTML=`<tr><td colspan="${currentView==='goalies'?7:8}" class="hca-stats-empty">No ${currentView==='goalies'?'goalie':'player'} statistics found.</td></tr>`;return;}
    if(currentView==='goalies'){
      body.innerHTML=sorted.map((p,i)=>`<tr><td>${i+1}</td><td class="hca-stats-player">${escapeHTML(p.name)}</td><td class="hca-stats-team">${escapeHTML(p.team)}</td><td>${p.gp}</td><td>${p.gaa.toFixed(2)}</td><td>${(p.svPct*100).toFixed(1)}%</td><td>${p.saves}</td><td>${p.shutouts}</td></tr>`).join("");
    } else {
      body.innerHTML=sorted.map((p,i)=>`<tr><td>${i+1}</td><td class="hca-stats-player">${escapeHTML(p.name)}</td><td class="hca-stats-team">${escapeHTML(p.team)}</td><td>${p.gp}</td><td>${p.goals}</td><td>${p.assists}</td><td class="hca-stats-points">${p.points}</td><td class="${p.plusMinus>0?'hca-stats-positive':p.plusMinus<0?'hca-stats-negative':''}">${p.plusMinus>0?'+':''}${p.plusMinus}</td></tr>`).join("");
    }
  }

  function updateSortOptions(){
    const select=document.getElementById('hca-stats-sort'); if(!select)return;
    if(currentView==='goalies') select.innerHTML='<option value="gaa">GAA</option><option value="svPct">Save %</option><option value="saves">Saves</option><option value="shutouts">Shutouts</option><option value="gp">Games Played</option>';
    else select.innerHTML='<option value="points">Points</option><option value="goals">Goals</option><option value="assists">Assists</option><option value="plusMinus">Plus / Minus</option>';
    currentSort=currentView==='goalies'?'gaa':'points';
  }

  async function loadStats(){
    try{
      const [{data:players,error:pe},{data:games,error:ge}]=await Promise.all([
        client.from('players').select('id, player_name, team_id, team_name, position, season_stats'),
        client.from('games').select('id, season, metadata')
      ]);
      if(pe)throw pe; if(ge)throw ge;
      playerStats=calculatePlayerStats(players||[]); goalieStats=calculateGoalieStats(players||[]); renderTable();
      console.log('HCA Stats loaded:',{players:(players||[]).length,goalies:goalieStats.length,games:(games||[]).length});
    }catch(error){console.error('HCA Stats: failed to load:',error);const body=document.getElementById('hca-stats-body');if(body)body.innerHTML=`<tr><td colspan="8" class="hca-stats-empty">Could not load statistics.</td></tr>`;}
  }

  document.addEventListener('change',e=>{if(e.target.id==='hca-stats-view'){currentView=e.target.value;updateSortOptions();renderTable();} if(e.target.id==='hca-stats-sort'){currentSort=e.target.value;renderTable();}});
  updateSortOptions();
  if(document.getElementById('hca-stats-body'))loadStats();
})();
