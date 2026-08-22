(() => {
 const client=window.hcaSupabase||(typeof hcaSupabase!=="undefined"?hcaSupabase:null); if(!client)return;
 const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
 const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
 const id=new URLSearchParams(location.search).get("id");
 const played=g=>String(g.status||"").toLowerCase()!=="scheduled"&&Number.isFinite(Number(g.home_score))&&Number.isFinite(Number(g.away_score));
 async function init(){
  const page=document.getElementById("gamecast-page"), error=document.getElementById("gamecast-error"), detail=document.getElementById("gamecast-detail");
  if(!id){error.hidden=false;return}
  try{
   const [{data:games,error:ge},{data:players,error:pe},{data:teams,error:te}]=await Promise.all([
    client.from("games").select("id,season,week,game_date,home_team_id,away_team_id,home_team_name,away_team_name,home_score,away_score,status,overtime,shootout,game_type,venue,metadata").eq("id",id).limit(1),
    client.from("players").select("id,player_name,team_id,team_name,position"),
    client.from("teams").select("id,name,logo")
   ]); if(ge)throw ge;if(pe)throw pe;if(te)throw te;
   const g=games?.[0]; if(!g){error.hidden=false;return}
   const tm=new Map((teams||[]).map(t=>[String(t.id),t]));
   const homeRaw=tm.get(String(g.home_team_id))||{name:g.home_team_name||"Home",logo:""};
   const awayRaw=tm.get(String(g.away_team_id))||{name:g.away_team_name||"Away",logo:""};
   const home={...homeRaw,name:window.hcaDisplayTeamName(homeRaw.name)};
   const away={...awayRaw,name:window.hcaDisplayTeamName(awayRaw.name)};
   const ps=players||[], m=g.metadata||{}, fin=played(g), hs=num(g.home_score), as=num(g.away_score);
   const status=fin?(g.overtime?"FINAL · OVERTIME":"FINAL"):"UPCOMING";
   const date=g.game_date?new Date(g.game_date).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"}):"Date TBD";
   const time=g.game_date?new Date(g.game_date).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}):"";
   const stats=Array.isArray(m.player_stats)?m.player_stats:[];
   const rows=stats.map(s=>{const p=ps.find(x=>String(x.id)===String(s.player_id));return{name:p?.player_name||s.player_id||"Unknown Player",team:window.hcaDisplayTeamName(p?.team_name||""),g:num(s.goals),a:num(s.assists)}}).filter(x=>x.g||x.a).sort((a,b)=>b.g-a.g||b.a-a.a);
   const goalies=[{team:home,name:m.home_goalie_name||ps.find(p=>String(p.id)===String(m.home_goalie_id))?.player_name,saves:num(m.home_saves),ga:num(m.home_goals_against),logo:home.logo},{team:away,name:m.away_goalie_name||ps.find(p=>String(p.id)===String(m.away_goalie_id))?.player_name,saves:num(m.away_saves),ga:num(m.away_goals_against),logo:away.logo}].filter(x=>x.name);
   detail.innerHTML=`<div class="gamecast-wrap"><div class="gamecast-top"><span>${esc(g.season||"Season")} · WEEK ${esc(g.week??"—")}</span><b>${esc(status)}</b></div><div class="gamecast-score"><div class="gamecast-side"><img src="${esc(home.logo)}"><span>HOME</span><h1>${esc(home.name)}</h1><strong>${fin?hs:"—"}</strong></div><div class="gamecast-middle"><small>${esc(date)}</small><b>${esc(time)}</b><em>${esc(g.venue||"HCA")}</em><span>${g.overtime?"OT":g.shootout?"SO":""}</span></div><div class="gamecast-side"><img src="${esc(away.logo)}"><span>AWAY</span><h1>${esc(away.name)}</h1><strong>${fin?as:"—"}</strong></div></div><div class="gamecast-body"><section class="gamecast-card"><div class="gc-title">GAME INFORMATION</div><div class="gc-info"><div><span>GAME TYPE</span><b>${esc(g.game_type||"Regular Season")}</b></div><div><span>WEEK</span><b>${esc(g.week??"—")}</b></div><div><span>STATUS</span><b>${esc(status)}</b></div><div><span>VENUE</span><b>${esc(g.venue||"—")}</b></div></div></section><section class="gamecast-card"><div class="gc-title">PLAYER STAT LINES</div>${rows.length?`<div class="gc-table"><div class="gc-row head"><b>PLAYER</b><b>TEAM</b><b>G</b><b>A</b></div>${rows.map(x=>`<div class="gc-row"><strong>${esc(x.name)}</strong><span>${esc(x.team)}</span><b>${x.g}</b><b>${x.a}</b></div>`).join("")}</div>`:`<p class="gc-empty">No player scoring data recorded.</p>`}</section><section class="gamecast-card"><div class="gc-title">GOALTENDING</div>${goalies.length?goalies.map(x=>{const shots=x.saves+x.ga;const sv=shots?(x.saves/shots*100).toFixed(1)+"%":"—";return `<div class="gc-goalie"><div class="gc-goalie-name"><img src="${esc(x.logo)}"><div><strong>${esc(x.name)}</strong><span>${esc(x.team)}</span></div></div><div><span>SAVES</span><b>${x.saves}</b></div><div><span>GA</span><b>${x.ga}</b></div><div><span>SV%</span><b>${sv}</b></div></div>`}).join(""):`<p class="gc-empty">No goalie data recorded.</p>`}</section></div></div>`;
   page.hidden=false;
  }catch(e){console.error("HCA Gamecast failed:",e);error.hidden=false}
 }
 init();
})();
