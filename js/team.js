(() => {
  const client = window.hcaSupabase || (typeof hcaSupabase !== "undefined" ? hcaSupabase : null);
  if (!client) { console.error("HCA Team: Supabase client was not found."); return; }

  const page = document.getElementById("team-page");
  const errorView = document.getElementById("team-error");
  const params = new URLSearchParams(location.search);
  const teamId = params.get("id");
  const season = "Season 16";
  let team = null, players = [], games = [], allTeams = [], standings = [];

  const esc = v => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const num = v => { const n=Number(v); return Number.isFinite(n)?n:0; };
  const pos = v => Array.isArray(v)?v.join(" / "):String(v||"");
  const isGoalie = p => /(^|\W)G(\W|$)|GOALIE/i.test(pos(p.position));
  const initials = n => String(n||"?").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
  const isPlayed = g => {
    if ((g.status||"").toLowerCase()==="scheduled") return false;
    return Number.isFinite(Number(g.home_score)) && Number.isFinite(Number(g.away_score));
  };
  const overtime = g => g.overtime===true || g.overtime===1 || g.overtime==="true" || g.overtime==="1";

  function showError(){ page.hidden=true; errorView.hidden=false; }

  function hexToRgb(hex){
    const value = String(hex||"").replace("#","").trim();
    if (!/^[0-9a-f]{6}$/i.test(value)) return null;
    return {r:parseInt(value.slice(0,2),16),g:parseInt(value.slice(2,4),16),b:parseInt(value.slice(4,6),16)};
  }

  function readableText(hex){
    const rgb=hexToRgb(hex);
    if(!rgb) return "#fff";
    const lum=(0.299*rgb.r+0.587*rgb.g+0.114*rgb.b)/255;
    return lum>0.62 ? "#080808" : "#fff";
  }

  function theme(){
    const primary=team.primary_color || "#111111";
    const secondary=team.secondary_color || "#ffffff";
    const ink=readableText(primary);
    document.documentElement.style.setProperty("--team-primary", primary);
    document.documentElement.style.setProperty("--team-secondary", secondary);
    document.documentElement.style.setProperty("--header-bg", primary);
    document.documentElement.style.setProperty("--header-accent", secondary);
    document.documentElement.style.setProperty("--header-ink", ink);
  }

  function buildStandings(){
    const map=new Map(allTeams.map(t=>[t.id,{id:t.id,name:t.name||"Unknown",conference:t.conference||"",division:t.division||"",gp:0,w:0,l:0,otl:0,pts:0,gf:0,ga:0}]));
    games.filter(g=>g.season===season && isPlayed(g)).forEach(g=>{
      for(const side of ["home","away"]){
        const id=g[`${side}_team_id`]; const r=map.get(id); if(!r) continue;
        const other=side==="home"?"away":"home";
        const gf=num(g[`${side}_score`]),ga=num(g[`${other}_score`]);
        r.gp++;r.gf+=gf;r.ga+=ga;
        if(gf>ga)r.w++; else if(gf<ga){if(overtime(g))r.otl++;else r.l++;}
      }
    });
    map.forEach(r=>r.pts=r.w*2+r.otl);
    return [...map.values()].map(r=>({...r,diff:r.gf-r.ga})).sort((a,b)=>b.pts-a.pts||b.w-a.w||b.diff-a.diff||a.name.localeCompare(b.name));
  }

  function renderTeam(){
    document.title=`${window.hcaDisplayTeamName(team.name)} — HCA`;
    const base=`team.html?id=${encodeURIComponent(team.id)}`;
    const teamBar=document.querySelector(".header-team-bar");
    const teamHeaderLogo=document.querySelector(".team-header-logo");
    const teamHeaderName=document.querySelector(".team-header-name");
    const teamHeaderIdentity=document.querySelector(".team-header-identity");
    if(teamBar) teamBar.hidden=false;
    if(teamHeaderName) teamHeaderName.textContent=window.hcaDisplayTeamName(team.name||"TEAM");
    if(teamHeaderIdentity) teamHeaderIdentity.href=`${base}#home`;
    if(teamHeaderLogo){
      if(team.logo){ teamHeaderLogo.src=team.logo; teamHeaderLogo.hidden=false; }
      else { teamHeaderLogo.hidden=true; }
    }
    const header=document.querySelector(".site-header");
    if(header) header.classList.add("team-header");
    const logoLink=document.querySelector(".hca-brand");
    if(logoLink) logoLink.href="index.html#home";

    const gamesNav=document.querySelector(".team-games-nav");
    if(gamesNav){ gamesNav.hidden=false; gamesNav.href=`${base}#games`; }
    const leagueGames=document.querySelector(".league-games-nav");
    if(leagueGames) leagueGames.hidden=true;
    document.querySelectorAll(".team-tabs a").forEach(a=>a.href=`${base}#${a.dataset.view}`);
    document.querySelectorAll(".nav-item").forEach(a=>{
      const view=a.dataset.page;
      if(view==="home") a.href=`${base}#home`;
      else if(["standings","stats","players","games"].includes(view)) a.href=`${base}#${view}`;
    });
  }

  function renderSnapshot(){
    const r=standings.find(x=>x.id===team.id)||{gp:0,w:0,l:0,otl:0,pts:0,gf:0,ga:0,diff:0};
    const rank=Math.max(0,standings.findIndex(x=>x.id===team.id)+1);
    document.getElementById("hero-record").textContent=`${r.w}-${r.l}-${r.otl}`;
    document.getElementById("record-sub").textContent=`${r.gp} games played`;
    document.getElementById("team-points").textContent=r.pts;
    document.getElementById("team-diff").textContent=`${r.diff>0?"+":""}${r.diff}`;
    document.getElementById("gfga-sub").textContent=`GF ${r.gf} • GA ${r.ga}`;
    document.getElementById("team-rank").textContent=rank?`#${rank}`:"—";
    document.getElementById("rank-sub").textContent=`${team.conference||""}${team.division?` • ${team.division}`:""}`;
  }

  function teamGames(selectedSeason=season){
    return games.filter(g=>g.season===selectedSeason&&(g.home_team_id===team.id||g.away_team_id===team.id));
  }

  function availableSeasons(){
    return [...new Set(games.map(g=>g.season).filter(Boolean))].sort((a,b)=>{
      const na=parseInt(String(a).match(/\d+/)?.[0]||0,10);
      const nb=parseInt(String(b).match(/\d+/)?.[0]||0,10);
      return nb-na || String(b).localeCompare(String(a));
    });
  }

  function currentGamesSeason(){
    return document.getElementById("team-games-season")?.value || season;
  }

  function formatScheduleDate(game){
    if(game.game_date){
      const d=new Date(game.game_date);
      if(!Number.isNaN(d.getTime())){
        return {month:d.toLocaleDateString(undefined,{month:"short"}).toUpperCase(),day:String(d.getDate()),label:""};
      }
    }
    return {month:`WK`,day:String(game.week ?? "—"),label:"WEEK"};
  }

  function scheduleTime(game){
    const meta=game.metadata || {};
    const raw=meta.game_time || meta.start_time || meta.time || "";
    if(raw) return String(raw);
    if(game.game_date){
      const d=new Date(game.game_date);
      if(!Number.isNaN(d.getTime()) && d.getHours()!==0){
        return d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});
      }
    }
    return "SCHEDULE";
  }

  function teamById(id){
    return allTeams.find(t=>t.id===id) || null;
  }

  function renderSchedule(){
    const track=document.getElementById("team-schedule-track");
    if(!track) return;
    const teamScheduleGames=teamGames();
    const upcoming=teamScheduleGames.filter(g=>!isPlayed(g)).sort((a,b)=>{
      const ad=a.game_date?new Date(a.game_date).getTime():Infinity;
      const bd=b.game_date?new Date(b.game_date).getTime():Infinity;
      if(Number.isFinite(ad)&&Number.isFinite(bd)&&ad!==bd) return ad-bd;
      return num(a.week)-num(b.week);
    });
    const completed=teamScheduleGames.filter(isPlayed).sort((a,b)=>{
      const ad=a.game_date?new Date(a.game_date).getTime():-Infinity;
      const bd=b.game_date?new Date(b.game_date).getTime():-Infinity;
      if(Number.isFinite(ad)&&Number.isFinite(bd)&&ad!==bd) return bd-ad;
      return num(b.week)-num(a.week);
    });
    const list=[...upcoming.slice(0,7),...completed.slice(0,7)].slice(0,12);
    if(!list.length){
      track.innerHTML='<div class="schedule-loading">No games scheduled.</div>';
      return;
    }
    track.innerHTML=list.map(g=>{
      const home=g.home_team_id===team.id;
      const opponentId=home?g.away_team_id:g.home_team_id;
      const opponent=teamById(opponentId);
      const opponentName=window.hcaDisplayTeamName(home?(g.away_team_name||opponent?.name||"Opponent"):(g.home_team_name||opponent?.name||"Opponent"));
      const currentName=window.hcaDisplayTeamName(team.name||"Team");
      const opponentLogo=opponent?.logo||"";
      const date=formatScheduleDate(g);
      const played=isPlayed(g);
      const hs=num(g.home_score), as=num(g.away_score);
      const teamScore=home?hs:as, oppScore=home?as:hs;
      const result=played?(teamScore>oppScore?"W":teamScore<oppScore?"L":"T"):"UPCOMING";
      const cls=played?"is-final":"is-upcoming";
      return `<a class="team-schedule-card ${cls}" href="game.html?id=${encodeURIComponent(g.id)}" aria-label="${esc(currentName)} ${home?"vs":"at"} ${esc(opponentName)}">
        <div class="team-schedule-date"><strong>${esc(date.month)}</strong><span>${esc(date.day)}</span></div>
        <div class="team-schedule-body">
          <span class="team-schedule-time">${esc(scheduleTime(g))}</span>
          <div class="team-schedule-team is-current"><img src="${esc(team.logo||"")}" alt="" onerror="this.style.visibility='hidden'"><b>${esc(currentName)}</b>${played?`<small>${teamScore}</small>`:""}</div>
          <div class="team-schedule-team"><img src="${esc(opponentLogo)}" alt="" onerror="this.style.visibility='hidden'"><b>${esc(opponentName)}</b>${played?`<small>${oppScore}</small>`:""}</div>
        </div>
      </a>`;
    }).join("");
  }

  function wireSchedule(){
    const track=document.getElementById("team-schedule-track");
    const prev=document.querySelector(".schedule-prev");
    const next=document.querySelector(".schedule-next");
    if(!track) return;
    prev?.addEventListener("click",()=>track.scrollBy({left:-Math.max(320, track.clientWidth * 0.72),behavior:"smooth"}));
    next?.addEventListener("click",()=>track.scrollBy({left:Math.max(320, track.clientWidth * 0.72),behavior:"smooth"}));
    document.querySelector(".schedule-calendar")?.addEventListener("click",()=>{ setView("games"); document.getElementById("team-view-games")?.scrollIntoView({behavior:"smooth",block:"start"}); });
  }

  function gameInfo(g){
    const home=g.home_team_id===team.id;
    const opponent=window.hcaDisplayTeamName(home?g.away_team_name:g.home_team_name);
    const teamScore=num(home?g.home_score:g.away_score);
    const oppScore=num(home?g.away_score:g.home_score);
    const played=isPlayed(g);
    const result=played?(teamScore>oppScore?"W":teamScore<oppScore?"L":"T"):"UPCOMING";
    return {home,opponent,teamScore,oppScore,played,result};
  }

  function renderResults(){
    const c=document.getElementById("team-results");
    const tg=teamGames();
    const played=tg.filter(isPlayed).sort((a,b)=>num(b.week)-num(a.week));
    const upcoming=tg.filter(g=>!isPlayed(g)).sort((a,b)=>num(a.week)-num(b.week));
    const list=[...played.slice(0,6),...upcoming.slice(0,3)];
    c.innerHTML=list.length?list.map(g=>{
      const x=gameInfo(g);
      return `<div class="team-row"><div class="team-row-week">WEEK ${esc(g.week??"—")}</div><div><strong>${x.home?"vs":"@"} ${esc(x.opponent)}</strong><small>${x.played?"FINAL":"UPCOMING"}</small></div><b class="result-${x.result.toLowerCase()}">${x.played?`${x.teamScore}–${x.oppScore}`:"—"}</b></div>`;
    }).join(""):'<div class="team-loading">No games recorded for this team.</div>';
  }

  function renderGames(){
    const c=document.getElementById("team-games");
    if(!c) return;
    const selected=currentGamesSeason();
    const list=teamGames(selected).sort((a,b)=>num(a.week)-num(b.week)||(isPlayed(a)?1:-1));
    c.innerHTML=list.length?list.map(g=>{
      const x=gameInfo(g);
      const cls=x.played?(x.result==="W"?"win":x.result==="L"?"loss":"tie"):"upcoming";
      const opponentTeam=teamById(x.home?g.away_team_id:g.home_team_id);
      const opponentLogo=opponentTeam?.logo||"";
      return `<a class="team-game ${cls}" href="game.html?id=${encodeURIComponent(g.id)}">
        <div class="team-game-week"><span>WEEK</span><b>${esc(g.week??"—")}</b></div>
        <div class="team-game-matchup">
          <div class="team-game-mini-team"><img src="${esc(team.logo||"")}" alt=""><strong>${esc(window.hcaDisplayTeamName(team.name))}</strong></div>
          <div class="team-game-mini-team"><img src="${esc(opponentLogo)}" alt=""><strong>${esc(x.opponent)}</strong></div>
        </div>
        <div class="team-game-score">${x.played?`${x.teamScore}–${x.oppScore}`:"—"}<small>${x.played?(g.overtime?`FINAL · OT · ${x.result}`:`FINAL · ${x.result}`):"SCHEDULED"}</small></div>
      </a>`;
    }).join(""):'<div class="team-loading">No games recorded for this team in this season.</div>';
  }

  function populateGameSeasons(){
    const select=document.getElementById("team-games-season");
    if(!select) return;
    const seasons=availableSeasons();
    select.innerHTML=seasons.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join("");
    if(seasons.includes(season)) select.value=season;
    select.addEventListener("change",renderGames);
  }

  function openGame(gameId){
    const game=games.find(g=>String(g.id)===String(gameId));
    const modal=document.getElementById("team-game-modal");
    const detail=document.getElementById("team-game-detail");
    if(!game||!modal||!detail) return;
    const homeRaw=teamById(game.home_team_id)||{name:game.home_team_name||"Home",logo:""};
    const awayRaw=teamById(game.away_team_id)||{name:game.away_team_name||"Away",logo:""};
    const homeTeam={...homeRaw,name:window.hcaDisplayTeamName(homeRaw.name)};
    const awayTeam={...awayRaw,name:window.hcaDisplayTeamName(awayRaw.name)};
    const played=isPlayed(game), hs=num(game.home_score), as=num(game.away_score);
    const status=played?(game.overtime?"FINAL · OVERTIME":"FINAL"):"UPCOMING";
    const stats=Array.isArray(game.metadata?.player_stats)?game.metadata.player_stats:[];
    const statRows=stats.map(st=>{
      const p=players.find(x=>x.id===st.player_id);
      return {name:p?.player_name||st.player_id||"Unknown Player",g:num(st.goals),a:num(st.assists)};
    }).filter(x=>x.g||x.a).sort((a,b)=>b.g-a.g||b.a-a.a);
    const homeGoalie=players.find(p=>p.id===game.metadata?.home_goalie_id);
    const awayGoalie=players.find(p=>p.id===game.metadata?.away_goalie_id);
    const goalieRows=[
      {name:game.metadata?.home_goalie_name||homeGoalie?.player_name, team:homeTeam.name, saves:num(game.metadata?.home_saves),ga:num(game.metadata?.home_goals_against)},
      {name:game.metadata?.away_goalie_name||awayGoalie?.player_name, team:awayTeam.name, saves:num(game.metadata?.away_saves),ga:num(game.metadata?.away_goals_against)}
    ].filter(x=>x.name);
    detail.innerHTML=`
      <div class="sportcast-topline"><span>${esc(game.season||"Season")} · WEEK ${esc(game.week??"—")}</span><b>${esc(status)}</b></div>
      <div class="sportcast-scoreboard">
        <div class="sportcast-team"><img src="${esc(homeTeam.logo||"")}" alt=""><span>${esc(homeTeam.name)}</span><strong>${played?hs:"—"}</strong></div>
        <div class="sportcast-center"><small>${game.game_date?esc(new Date(game.game_date).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})):"SCHEDULE"}</small><em>${game.venue?esc(game.venue):"HCA"}</em><span>${game.overtime?"OT":""}</span></div>
        <div class="sportcast-team"><img src="${esc(awayTeam.logo||"")}" alt=""><span>${esc(awayTeam.name)}</span><strong>${played?as:"—"}</strong></div>
      </div>
      <div class="sportcast-grid">
        <section><div class="sportcast-heading">GAME INFORMATION</div><p><b>Game:</b> ${esc(game.game_type||"Regular Season")}</p><p><b>Status:</b> ${esc(status)}</p><p><b>Week:</b> ${esc(game.week??"—")}</p></section>
        <section><div class="sportcast-heading">GOALTENDING</div>${goalieRows.length?goalieRows.map(x=>`<div class="sportcast-stat-row"><span>${esc(x.team)} · ${esc(x.name)}</span><b>${x.saves} SV</b><small>${x.ga} GA</small></div>`).join(""):"<p>No goalie data recorded.</p>"}</section>
      </div>
      <section class="sportcast-events"><div class="sportcast-heading">PLAYER STAT LINES</div>${statRows.length?statRows.map(x=>`<div class="sportcast-stat-row"><span>${esc(x.name)}</span><b>${x.g} G</b><small>${x.a} A</small></div>`).join(""):"<p>No player scoring data recorded for this game.</p>"}</section>`;
    modal.hidden=false;
    document.body.classList.add("modal-open");
  }

  function closeGame(){
    const modal=document.getElementById("team-game-modal");
    if(modal) modal.hidden=true;
    document.body.classList.remove("modal-open");
  }

  function wireGameDetails(){
    document.addEventListener("click",event=>{
      const card=event.target.closest("[data-game-id]");
      if(card) openGame(card.dataset.gameId);
      if(event.target.closest("[data-close-game]")) closeGame();
    });
    document.addEventListener("keydown",event=>{if(event.key==="Escape") closeGame();});
  }

  function renderLeaders(){
    const c=document.getElementById("team-leaders");
    const sk=players.filter(p=>!isGoalie(p)).map(p=>{const s=p.season_stats||{};return {name:p.player_name||"Unknown",gp:num(s.games_played??s.gp),g:num(s.goals),a:num(s.assists),pts:num(s.points??num(s.goals)+num(s.assists))};}).sort((a,b)=>b.pts-a.pts||b.g-a.g);
    const g=players.filter(isGoalie).map(p=>{const s=p.season_stats||{};return {name:p.player_name||"Unknown",gp:num(s.games_played??s.gp),sv:num(s.saves),gaa:num(s.gaa),svPct:num(s.save_percentage??s.save_pct),so:num(s.shutouts??s.so)};}).sort((a,b)=>b.sv-a.sv);
    const rows=[...sk.slice(0,3).map((x,i)=>({rank:i+1,name:x.name,meta:`${x.g} G • ${x.a} A`,value:x.pts})),...g.slice(0,1).map(x=>({rank:4,name:x.name,meta:`${x.gp} GP • ${x.gaa.toFixed(2)} GAA`,value:x.sv}))];
    c.innerHTML=rows.length?rows.map(x=>`<div class="leader-row"><span>#${x.rank}</span><div><strong>${esc(x.name)}</strong><small>${esc(x.meta)}</small></div><b>${x.value}</b></div>`).join(""):'<div class="team-loading">No player statistics available.</div>';
  }

  function rosterMarkup(list){
    const sorted=[...list].sort((a,b)=>num(b.overall_rating)-num(a.overall_rating)||String(a.player_name).localeCompare(String(b.player_name)));
    return sorted.map(p=>`<a class="team-player" href="/HCAWebsite/players.html"><div class="team-player-avatar">${esc(initials(p.player_name))}</div><div class="team-player-name"><strong>${esc(p.player_name)}</strong><small>${esc(pos(p.position)||"—")} • ${esc(p.handedness||"")}</small></div><b>${p.overall_rating??"—"}</b></a>`).join("");
  }

  function renderRoster(){
    const markup=rosterMarkup(players);
    document.getElementById("team-roster-preview").innerHTML=markup||'<div class="team-loading">No players found.</div>';
    document.getElementById("team-roster-full").innerHTML=markup||'<div class="team-loading">No players found.</div>';
  }

  function renderStandings(){
    const r=standings.find(x=>x.id===team.id)||{w:0,l:0,otl:0};
    const rank=standings.findIndex(x=>x.id===team.id)+1;
    document.getElementById("team-standings-meta").innerHTML=`<div><span>OVERALL RANK</span><strong>#${rank||"—"}</strong></div><div><span>CONFERENCE</span><strong>${esc(team.conference||"—")}</strong></div><div><span>DIVISION</span><strong>${esc(team.division||"—")}</strong></div><div><span>RECORD</span><strong>${r.w}-${r.l}-${r.otl}</strong></div>`;
    document.getElementById("team-standings-body").innerHTML=standings.map((x,i)=>`<tr class="${x.id===team.id?"is-current":""}"><td>${i+1}</td><td><strong>${esc(x.name)}</strong></td><td>${x.gp}</td><td>${x.w}</td><td>${x.l}</td><td>${x.otl}</td><td><b>${x.pts}</b></td><td>${x.gf}</td><td>${x.ga}</td><td>${x.diff>0?"+":""}${x.diff}</td></tr>`).join("");
  }

  function renderStats(){
    const sk=players.filter(p=>!isGoalie(p)).map(p=>{const s=p.season_stats||{};return {name:p.player_name||"Unknown",gp:num(s.games_played??s.gp),g:num(s.goals),a:num(s.assists),pts:num(s.points??num(s.goals)+num(s.assists)),pm:num(s.plus_minus??s.plusMinus)};}).sort((a,b)=>b.pts-a.pts||b.g-a.g);
    const gs=players.filter(isGoalie).map(p=>{const s=p.season_stats||{};return {name:p.player_name||"Unknown",gp:num(s.games_played??s.gp),sv:num(s.saves),svPct:num(s.save_percentage??s.save_pct),gaa:num(s.gaa),so:num(s.shutouts??s.so)};}).sort((a,b)=>b.sv-a.sv);
    document.getElementById("team-skater-stats").innerHTML=sk.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${x.gp}</td><td>${x.g}</td><td>${x.a}</td><td><b>${x.pts}</b></td><td>${x.pm>0?"+":""}${x.pm}</td></tr>`).join("")||'<tr><td colspan="6">No skater stats.</td></tr>';
    document.getElementById("team-goalie-stats").innerHTML=gs.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${x.gp}</td><td>${x.sv}</td><td>${x.svPct?x.svPct.toFixed(3):"—"}</td><td>${x.gaa.toFixed(2)}</td><td>${x.so}</td></tr>`).join("")||'<tr><td colspan="6">No goalie stats.</td></tr>';
  }

  function setView(view){
    const valid=["home","standings","stats","players","games"].includes(view)?view:"home";
    document.querySelectorAll(".team-view").forEach(s=>s.hidden=s.id!==`team-view-${valid}`);
    document.querySelectorAll(".team-tabs a, .nav-item").forEach(a=>{
      if(a.dataset.page) a.classList.toggle("active",a.dataset.page===valid);
      if(a.dataset.view) a.classList.toggle("active",a.dataset.view===valid);
    });
    if(location.hash.replace("#","")!==valid) history.replaceState(null,"",`${location.pathname}${location.search}#${valid}`);
  }

  function wireNav(){
    document.querySelectorAll(".team-tabs a, .nav-item[data-page]").forEach(a=>a.addEventListener("click",e=>{
      const href=a.getAttribute("href")||"";
      const hash=href.split("#")[1];
      const view=a.dataset.view||a.dataset.page;
      if(view && ["home","standings","stats","players","games"].includes(view)){
        e.preventDefault();
        setView(view);
        if(a.closest(".team-tabs")) a.closest(".team-tabs")?.scrollIntoView({behavior:"smooth",block:"start"});
      } else if(hash) {
        e.preventDefault(); setView(hash);
      }
    }));
    window.addEventListener("hashchange",()=>setView(location.hash.replace("#","")||"home"));
  }

  async function loadHeader(){
    const el=document.getElementById("header"); if(!el)return;
    try{
      const r=await fetch("components/header.html");
      if(r.ok)el.innerHTML=await r.text();
    }catch(e){console.error("HCA Team header:",e);}
  }

  async function init(){
    if(!teamId){showError();return;}
    await loadHeader();
    try{
      const [{data:t,error:te},{data:p,error:pe},{data:g,error:ge},{data:ts,error:tse}]=await Promise.all([
        client.from("teams").select("id,name,city,conference,division,logo,primary_color,secondary_color,wins,losses,overtime_losses,points").eq("id",teamId).maybeSingle(),
        client.from("players").select("id,player_name,team_id,team_name,position,handedness,overall_rating,season_stats").eq("team_id",teamId),
        client.from("games").select("id,season,week,game_date,home_team_id,away_team_id,home_team_name,away_team_name,home_score,away_score,status,overtime,shootout,game_type,venue,metadata"),
        client.from("teams").select("id,name,conference,division,logo")
      ]);
      if(te)throw te;if(pe)throw pe;if(ge)throw ge;if(tse)throw tse;if(!t){showError();return;}
      team=t;players=p||[];games=g||[];allTeams=ts||[];standings=buildStandings();theme();renderTeam();renderSchedule();renderResults();populateGameSeasons();renderGames();renderLeaders();renderRoster();renderStandings();renderStats();wireSchedule();wireGameDetails();wireNav();setView(location.hash.replace("#","")||"home");page.hidden=false;
      const requestedGame = new URLSearchParams(location.search).get("game");
      if (requestedGame) { setView("games"); setTimeout(() => openGame(requestedGame), 0); }
      console.log("HCA Team site loaded:",{team:window.hcaDisplayTeamName(team.name),players:players.length,games:games.length,view:location.hash||"#home"});
    }catch(e){console.error("HCA Team: failed to load:",e);showError();}
  }
  init();
})();
