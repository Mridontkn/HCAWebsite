/* HCA PLAYOFF BRACKET ADMIN */
(() => {
  const client = window.hcaSupabase || (typeof hcaSupabase !== "undefined" ? hcaSupabase : null);
  if (!client) return;

  const rounds = [
    {key:"r1", name:"ROUND 1", count:8},
    {key:"r2", name:"ROUND 2", count:4},
    {key:"r3", name:"CONFERENCE FINALS", count:2},
    {key:"r4", name:"FINAL", count:1}
  ];
  let teams=[];
  let bracket=createEmptyBracket();

  const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const emptyGame=()=>({team1_id:"",team2_id:"",score1:null,score2:null});
  function createEmptyBracket(){ return {r1:Array.from({length:8},emptyGame),r2:Array.from({length:4},emptyGame),r3:Array.from({length:2},emptyGame),r4:[emptyGame()]}; }
  const teamName=id=>teams.find(t=>String(t.id)===String(id))?.name||"TBD";
  const message=(text,type="")=>{const el=document.getElementById("admin-bracket-message");if(!el)return;el.textContent=text;el.className=`admin-message ${type}`;};

  async function loadTeams(){
    const {data,error}=await client.from("teams").select("id,name,conference,division,points,wins,losses,overtime_losses").order("name");
    if(error){message(`Could not load teams: ${error.message}`,"error");return;}
    teams=data||[]; renderBracket();
  }

  function teamOptions(selected="", usedId=""){
    return `<option value="">TBD</option>`+teams.map(t=>`<option value="${esc(t.id)}" ${String(t.id)===String(selected)?"selected":""}>${esc(t.name)}</option>`).join("");
  }

  function winner(game){
    const a=Number(game.score1), b=Number(game.score2);
    if(!game.team1_id||!game.team2_id||!Number.isFinite(a)||!Number.isFinite(b)||a===b)return "";
    return a>b?game.team1_id:game.team2_id;
  }

  function renderBracket(){
    const board=document.getElementById("admin-bracket"); if(!board)return;
    const filter=document.getElementById("admin-bracket-round")?.value||"all";
    board.innerHTML=rounds.map(round=>{
      const hidden=filter!=="all"&&filter!==round.key?"filtered":"";
      return `<section class="admin-bracket-round ${hidden}" data-round="${round.key}"><div class="admin-bracket-round-head"><strong>${round.name}</strong><small>${round.count} MATCHUP${round.count>1?"S":""}</small></div>${bracket[round.key].map((game,index)=>renderMatch(round,index,game)).join("")}</section>`;
    }).join("");
  }

  function renderMatch(round,index,game){
    const win=winner(game);
    return `<div class="admin-bracket-match" data-match-round="${round.key}" data-match-index="${index}">
      <div class="admin-bracket-team ${win&&win===game.team1_id?"is-winner":""}"><select data-bracket-team="1">${teamOptions(game.team1_id)}</select><input data-bracket-score="1" type="number" min="0" value="${game.score1??""}" placeholder="—"></div>
      <div class="admin-bracket-team ${win&&win===game.team2_id?"is-winner":""}"><select data-bracket-team="2">${teamOptions(game.team2_id)}</select><input data-bracket-score="2" type="number" min="0" value="${game.score2??""}" placeholder="—"></div>
      <div class="admin-bracket-match-actions"><small>${win?`WINNER: ${esc(teamName(win))}`:"SET SCORE TO ADVANCE"}</small><button class="admin-bracket-advance" type="button" data-advance-match="${round.key}:${index}">ADVANCE</button></div>
    </div>`;
  }

  function syncFromDom(){
    document.querySelectorAll(".admin-bracket-match").forEach(match=>{
      const round=match.dataset.matchRound,index=Number(match.dataset.matchIndex),g=bracket[round][index];
      g.team1_id=match.querySelector('[data-bracket-team="1"]')?.value||"";g.team2_id=match.querySelector('[data-bracket-team="2"]')?.value||"";
      const s1=match.querySelector('[data-bracket-score="1"]')?.value,s2=match.querySelector('[data-bracket-score="2"]')?.value;
      g.score1=s1===""?null:Number(s1);g.score2=s2===""?null:Number(s2);
    });
  }

  function advanceMatch(roundKey,index){
    syncFromDom();
    const r=rounds.findIndex(r=>r.key===roundKey); if(r<0||r>=rounds.length-1)return;
    const win=winner(bracket[roundKey][index]);
    if(!win){message("That matchup needs two teams and a non-tied final score before advancing.","error");return;}
    const next=rounds[r+1].key,nextIndex=Math.floor(index/2),slot=index%2;
    bracket[next][nextIndex][slot===0?"team1_id":"team2_id"]=win;
    renderBracket();
  }

  async function loadSaved(){
    const season=document.getElementById("admin-bracket-season")?.value||"Season 16";
    const status=document.getElementById("admin-bracket-status");
    const {data,error}=await client.from("playoff_brackets").select("id,season,name,bracket_data,updated_at").eq("season",season).maybeSingle();
    if(error){status.textContent="Bracket table not configured.";message(`Run games_admin_setup_v3.sql first. ${error.message}`,"error");return;}
    bracket=data?.bracket_data?.rounds ? data.bracket_data.rounds : createEmptyBracket();
    status.textContent=data?`Saved ${new Date(data.updated_at).toLocaleString()}`:"No saved bracket loaded.";
    renderBracket();
  }

  async function save(){
    syncFromDom();
    const season=document.getElementById("admin-bracket-season")?.value||"Season 16";
    const {data:session}=await client.auth.getSession();
    const userId=session.session?.user?.id||null;
    const payload={season,name:`HCA ${season} Playoffs`,bracket_data:{rounds:bracket},updated_by_id:userId,updated_at:new Date().toISOString()};
    const {error}=await client.from("playoff_brackets").upsert(payload,{onConflict:"season"});
    if(error){message(`Could not save bracket: ${error.message}`,"error");return;}
    message("Playoff bracket saved.","success");await loadSaved();
  }

  async function autoFill(){
    const score=(a,b)=>Number(b.points||0)-Number(a.points||0)||Number(b.wins||0)-Number(a.wins||0)||String(a.name).localeCompare(String(b.name));
    const conferences=[...new Set(teams.map(t=>String(t.conference||"").trim()).filter(Boolean))];
    let east=teams.filter(t=>String(t.conference||"").toLowerCase().includes("east")).sort(score).slice(0,8);
    let west=teams.filter(t=>String(t.conference||"").toLowerCase().includes("west")).sort(score).slice(0,8);
    if(east.length<8||west.length<8){
      const sorted=[...teams].sort(score).slice(0,16);
      east=sorted.slice(0,8); west=sorted.slice(8,16);
    }
    const pair=(list,offset)=>{
      const seedPairs=[[0,7],[3,4],[1,6],[2,5]];
      seedPairs.forEach(([a,b],i)=>{const g=bracket.r1[offset+i];g.team1_id=list[a]?.id||"";g.team2_id=list[b]?.id||"";});
    };
    bracket=createEmptyBracket();
    pair(east,0); pair(west,4);
    renderBracket();message(`Loaded ${east.length} Eastern and ${west.length} Western playoff teams. Review the seeds before saving.`,"success");
  }

  function advanceAllCompleted(){
    syncFromDom();
    let advanced=0;
    rounds.slice(0,-1).forEach((round,roundIndex)=>{
      const next=rounds[roundIndex+1].key;
      bracket[round.key].forEach((game,index)=>{
        const win=winner(game); if(!win)return;
        const nextIndex=Math.floor(index/2),slot=index%2;
        bracket[next][nextIndex][slot===0?"team1_id":"team2_id"]=win;
        advanced++;
      });
    });
    renderBracket();
    message(advanced?`Advanced ${advanced} completed matchup${advanced===1?"":"s"}. Save the bracket when you're ready.`:"No completed matchups were ready to advance.",advanced?"success":"error");
  }

  document.addEventListener("click",e=>{
    const nav=e.target.closest('[data-section="playoffs"]'); if(nav){setTimeout(async()=>{await loadTeams();await loadSaved();},0);return;}
    const adv=e.target.closest("[data-advance-match]");if(adv){const [r,i]=adv.dataset.advanceMatch.split(":");advanceMatch(r,Number(i));return;}
    if(e.target.closest("#admin-bracket-save")){void save();return;}
    if(e.target.closest("#admin-bracket-auto-fill")){void autoFill();return;}
    if(e.target.closest("#admin-bracket-advance-all")){advanceAllCompleted();return;}
  });
  document.addEventListener("change",e=>{if(e.target.id==="admin-bracket-round")renderBracket();if(e.target.closest(".admin-bracket-match"))syncFromDom();if(e.target.id==="admin-bracket-season")void loadSaved();});
  if(document.getElementById("admin-section-playoffs")?.classList.contains("active")){void loadTeams();}
})();
