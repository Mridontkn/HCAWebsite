/* HCA HOMEPAGE HIGHLIGHTS */
(() => {
  const client = window.hcaSupabase || (typeof hcaSupabase !== "undefined" ? hcaSupabase : null);
  if (!client) return;

  const esc = v => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const pos = v => Array.isArray(v) ? v.join(" / ") : String(v || "");
  const goalie = p => /(^|\W)G(\W|$)|GOALIE/i.test(pos(p.position));
  const played = g => String(g.status || "").toLowerCase() !== "scheduled" && Number.isFinite(Number(g.home_score)) && Number.isFinite(Number(g.away_score));

  async function loadHomeHighlights() {
    const leaders = document.getElementById("home-league-leaders");
    const games = document.getElementById("home-recent-games");
    if (!leaders && !games) return;

    try {
      const [{data: players, error: pe}, {data: gameRows, error: ge}] = await Promise.all([
        client.from("players").select("id, player_name, team_name, position, season_stats"),
        client.from("games").select("id, season, week, game_date, home_team_id, away_team_id, home_team_name, away_team_name, home_score, away_score, status, overtime").order("week", {ascending:false})
      ]);
      if (pe) throw pe;
      if (ge) throw ge;

      renderLeaders(players || [], leaders);
      renderRecentGames((gameRows || []).filter(g => g.season === "Season 16"), games);
    } catch (error) {
      console.error("HCA Home: highlights failed:", error);
      if (leaders) leaders.innerHTML = `<div class="home-empty">Could not load league leaders.</div>`;
      if (games) games.innerHTML = `<div class="home-empty">Could not load recent games.</div>`;
    }
  }

  function renderLeaders(players, container) {
    if (!container) return;
    const skaters = players.filter(p => !goalie(p)).map(p => {
      const s = p.season_stats || {};
      return {name:p.player_name || "Unknown", team:window.hcaDisplayTeamName(p.team_name || "Free Agent"), points:num(s.points ?? num(s.goals)+num(s.assists)), goals:num(s.goals), assists:num(s.assists)};
    }).sort((a,b)=>b.points-a.points||b.goals-a.goals||a.name.localeCompare(b.name)).slice(0,5);
    const goalies = players.filter(goalie).map(p => {
      const s=p.season_stats||{};
      const gp=num(s.games_played ?? s.gp), saves=num(s.saves), ga=num(s.goals_against), shots=num(s.shots_against ?? saves+ga);
      return {name:p.player_name||"Unknown", team:window.hcaDisplayTeamName(p.team_name||"Free Agent"), gaa:num(s.gaa), svPct:num(s.save_percentage ?? (shots?saves/shots:0)), saves, gp};
    }).filter(p=>p.gp>0).sort((a,b)=>a.gaa-b.gaa||b.svPct-a.svPct).slice(0,5);

    const skaterLead=skaters[0];
    const goalieLead=goalies[0];
    container.innerHTML = `
      <article class="home-leader-card">
        <div class="home-leader-feature">
          <span class="eyebrow">SKATERS · POINTS</span>
          <strong>${skaterLead ? esc(skaterLead.points) : "—"}</strong>
          <h3>${skaterLead ? esc(skaterLead.name) : "No data"}</h3>
          <p>${skaterLead ? esc(skaterLead.team) : ""}</p>
        </div>
        <div class="home-leader-list">${skaters.map((p,i)=>`<a href="players.html" class="home-leader-row"><span>${i+1}.</span><b>${esc(p.name)}</b><small>${p.points}</small></a>`).join("") || '<div class="home-empty">No skater stats.</div>'}</div>
        <a class="home-all-link" href="stats.html">ALL SKATER LEADERS →</a>
      </article>
      <article class="home-leader-card">
        <div class="home-leader-feature">
          <span class="eyebrow">GOALIES · GAA</span>
          <strong>${goalieLead ? goalieLead.gaa.toFixed(2) : "—"}</strong>
          <h3>${goalieLead ? esc(goalieLead.name) : "No data"}</h3>
          <p>${goalieLead ? esc(goalieLead.team) : ""}</p>
        </div>
        <div class="home-leader-list">${goalies.map((p,i)=>`<a href="stats.html" class="home-leader-row"><span>${i+1}.</span><b>${esc(p.name)}</b><small>${p.gaa.toFixed(2)}</small></a>`).join("") || '<div class="home-empty">No goalie stats.</div>'}</div>
        <a class="home-all-link" href="stats.html">ALL GOALIE LEADERS →</a>
      </article>`;
  }

  function renderRecentGames(rows, container) {
    if (!container) return;
    const list = rows.filter(played).slice(0,8);
    if (!list.length) { container.innerHTML='<div class="home-empty">No completed games yet.</div>'; return; }
    container.innerHTML = list.map(g => {
      const hs=num(g.home_score), as=num(g.away_score), ot=g.overtime===true||g.overtime===1||g.overtime==="true";
      return `<a class="home-game-card" href="game.html?id=${encodeURIComponent(g.id)}"><div class="home-game-week">WEEK ${esc(g.week ?? "—")}</div><div class="home-game-teams"><div><b>${esc(window.hcaDisplayTeamName(g.home_team_name || "Home"))}</b><strong>${hs}</strong></div><div><b>${esc(window.hcaDisplayTeamName(g.away_team_name || "Away"))}</b><strong>${as}</strong></div></div><div class="home-game-meta">${ot ? "FINAL · OT" : "FINAL"}<span>→</span></div></a>`;
    }).join("");
  }

  loadHomeHighlights();
})();
