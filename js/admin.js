(() => {
  console.log("HCA Admin: script loaded.");

  const client = window.hcaSupabase;

  if (!client) {
    console.error("HCA Admin: Supabase client was not found.");
    return;
  }

  const loginView = document.getElementById("admin-login");
  const appView = document.getElementById("admin-app");
  const loginForm = document.getElementById("admin-login-form");
  const loginError = document.getElementById("admin-login-error");
  const sectionTitle = document.getElementById("admin-section-title");
  const userEmail = document.getElementById("admin-user-email");
  const sessionEmail = document.getElementById("admin-session-email");

  let players = [];
  let teams = [];
  let editingPlayerId = null;
  let games = [];
  let gameGoalEvents = [];

  function showLogin(message = "") {
    loginView.hidden = false;
    appView.hidden = true;
    loginError.textContent = message;
    userEmail.textContent = "ADMIN";
    sessionEmail.textContent = "—";
  }

  function showApp(user) {
    const email = user?.email || "ADMIN";
    loginView.hidden = true;
    appView.hidden = false;
    userEmail.textContent = email;
    sessionEmail.textContent = email;
  }

  function setSection(name) {
    document.querySelectorAll(".admin-section").forEach(section => {
      section.classList.toggle("active", section.id === `admin-section-${name}`);
    });

    document.querySelectorAll(".admin-nav-item").forEach(button => {
      button.classList.toggle("active", button.dataset.section === name);
    });

    const titles = {
      dashboard: "DASHBOARD",
      players: "PLAYERS",
      teams: "TEAMS",
      games: "GAMES",
      playoffs: "PLAYOFFS",
      transactions: "TRANSACTIONS",
      news: "NEWS",
      users: "USERS"
    };

    sectionTitle.textContent = titles[name] || "DASHBOARD";
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (name === "players") {
      loadPlayers();
      loadTeams();
    }

    if (name === "games") {
      (async () => {
        await loadTeams();
        if (!players.length) await loadPlayers();
        await loadGames();
      })();
    }
  }

  async function countRows(table) {
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    return count ?? 0;
  }

  async function loadOverview() {
    const entries = [
      ["teams", "admin-team-count"],
      ["players", "admin-player-count"],
      ["games", "admin-game-count"],
      ["schedule", "admin-schedule-count"]
    ];

    await Promise.all(entries.map(async ([table, elementId]) => {
      const element = document.getElementById(elementId);
      if (!element) return;

      try {
        element.textContent = await countRows(table);
      } catch (error) {
        console.error(`Could not count ${table}:`, error);
        element.textContent = "—";
      }
    }));
  }

  function positionText(position) {
    if (Array.isArray(position)) return position.join(" / ");
    if (position && typeof position === "object") return Object.values(position).join(" / ");
    return position || "—";
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getSeasonStats(player) {
    return player.season_stats && typeof player.season_stats === "object"
      ? player.season_stats
      : {};
  }

  function numberOrZero(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  async function loadTeams() {
    const { data, error } = await client
      .from("teams")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("HCA Admin: failed to load teams:", error);
      return;
    }

    teams = data || [];
    populateTeamSelect();
  }

  function populateTeamSelect(selectedId = "") {
    const select = document.getElementById("admin-player-team");
    if (!select) return;

    select.innerHTML = `<option value="">FREE AGENT / NO TEAM</option>` +
      teams.map(team => `
        <option value="${escapeHTML(team.id)}">${escapeHTML(window.hcaDisplayTeamName(team.name || team.id))}</option>
      `).join("");

    select.value = selectedId || "";
  }

  function filteredPlayers() {
    const search = document.getElementById("admin-player-search")?.value.trim().toLowerCase() || "";
    const status = document.getElementById("admin-player-status")?.value || "all";

    return players.filter(player => {
      const haystack = `${player.player_name || ""} ${player.team_name || ""}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesStatus = status === "all" || String(player.status || "") === status;
      return matchesSearch && matchesStatus;
    });
  }

  function renderPlayers() {
    const body = document.getElementById("admin-players-body");
    const countLabel = document.getElementById("admin-player-count-label");
    if (!body || !countLabel) return;

    const filtered = filteredPlayers();
    countLabel.textContent = `Showing ${filtered.length} of ${players.length} players`;

    if (!filtered.length) {
      body.innerHTML = `<tr><td colspan="7" class="admin-table-empty">No players found.</td></tr>`;
      return;
    }

    body.innerHTML = filtered.map(player => `
      <tr>
        <td><strong>${escapeHTML(player.player_name || "Unknown Player")}</strong></td>
        <td>${escapeHTML(window.hcaDisplayTeamName(player.team_name || "Free Agent"))}</td>
        <td>${escapeHTML(positionText(player.position))}</td>
        <td><strong>${player.overall_rating ?? "—"}</strong></td>
        <td>${player.potential_rating ?? "—"}</td>
        <td><span class="admin-status admin-status-${escapeHTML(String(player.status || "unknown").toLowerCase().replace(/[^a-z]+/g, "-"))}">${escapeHTML(player.status || "—")}</span></td>
        <td><button class="admin-table-action" type="button" data-edit-player="${escapeHTML(player.id)}">EDIT</button></td>
      </tr>
    `).join("");
  }

  async function loadPlayers() {
    const body = document.getElementById("admin-players-body");
    if (!body) return;

    body.innerHTML = `<tr><td colspan="7" class="admin-table-empty">Loading players...</td></tr>`;

    const { data, error } = await client
      .from("players")
      .select(`
        id,
        player_name,
        team_id,
        team_name,
        position,
        handedness,
        overall_rating,
        potential_rating,
        years_left_to_grow,
        status,
        season_stats
      `)
      .order("player_name", { ascending: true });

    if (error) {
      console.error("HCA Admin: failed to load players:", error);
      body.innerHTML = `<tr><td colspan="7" class="admin-table-empty">Could not load players: ${escapeHTML(error.message)}</td></tr>`;
      return;
    }

    players = data || [];
    renderPlayers();
  }

  function showMessage(message, type = "") {
    const el = document.getElementById("admin-player-message");
    if (!el) return;
    el.textContent = message;
    el.className = `admin-message ${type}`.trim();
    if (message) {
      setTimeout(() => {
        if (el.textContent === message) el.textContent = "";
      }, 4500);
    }
  }

  async function openPlayerModal(player = null) {
    const modal = document.getElementById("admin-player-modal");
    const form = document.getElementById("admin-player-form");
    if (!modal || !form) return;

    // Make sure the full team list is loaded before opening the editor.
    if (!teams.length) {
      const select = document.getElementById("admin-player-team");
      if (select) select.innerHTML = `<option value="">LOADING TEAMS...</option>`;
      await loadTeams();
    }

    editingPlayerId = player?.id || null;
    document.getElementById("admin-player-modal-title").textContent = player ? "EDIT PLAYER" : "ADD PLAYER";
    document.getElementById("admin-player-id").value = player?.id || "";
    document.getElementById("admin-player-name").value = player?.player_name || "";
    document.getElementById("admin-player-position").value = positionText(player?.position).replaceAll(" / ", ", ");
    document.getElementById("admin-player-handedness").value = player?.handedness || "";
    document.getElementById("admin-player-overall").value = player?.overall_rating ?? "";
    document.getElementById("admin-player-potential").value = player?.potential_rating ?? "";
    document.getElementById("admin-player-years").value = player?.years_left_to_grow ?? "";
    document.getElementById("admin-player-status-edit").value = player?.status || "Active";

    const stats = getSeasonStats(player || {});
    document.getElementById("admin-stat-gp").value = stats.games_played ?? stats.gp ?? "";
    document.getElementById("admin-stat-goals").value = stats.goals ?? "";
    document.getElementById("admin-stat-assists").value = stats.assists ?? "";
    document.getElementById("admin-stat-points").value = stats.points ?? "";
    document.getElementById("admin-stat-saves").value = stats.saves ?? "";
    document.getElementById("admin-stat-shutouts").value = stats.shutouts ?? "";

    populateTeamSelect(player?.team_id || "");
    document.getElementById("admin-player-form-error").textContent = "";
    modal.hidden = false;
    document.body.classList.add("admin-modal-open");
    setTimeout(() => document.getElementById("admin-player-name")?.focus(), 0);
  }

  function closePlayerModal() {
    const modal = document.getElementById("admin-player-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("admin-modal-open");
    editingPlayerId = null;
  }

  function positionValue(raw) {
    const parts = String(raw || "")
      .split(/[\/,]/)
      .map(value => value.trim().toUpperCase())
      .filter(Boolean);

    return parts;
  }

  async function savePlayer(event) {
    event.preventDefault();

    const formError = document.getElementById("admin-player-form-error");
    const button = document.querySelector(".admin-save-button");
    formError.textContent = "";
    button.disabled = true;
    button.textContent = "SAVING...";

    try {
        const teamId = document.getElementById("admin-player-team").value;
      const team = teams.find(item => String(item.id) === String(teamId));

      if (!teamId || !team) {
        throw new Error("Please select a team before saving the player.");
      }
      const seasonStats = {
        games_played: numberOrZero(document.getElementById("admin-stat-gp").value),
        goals: numberOrZero(document.getElementById("admin-stat-goals").value),
        assists: numberOrZero(document.getElementById("admin-stat-assists").value),
        points: numberOrZero(document.getElementById("admin-stat-points").value),
        saves: numberOrZero(document.getElementById("admin-stat-saves").value),
        shutouts: numberOrZero(document.getElementById("admin-stat-shutouts").value)
      };

      const { data: sessionData } = await client.auth.getSession();
      const currentUserId = sessionData.session?.user?.id || null;
      const now = new Date().toISOString();
      const payload = {
        player_name: document.getElementById("admin-player-name").value.trim(),
        team_id: teamId,
        team_name: team?.name || "Free Agent",
        position: positionValue(document.getElementById("admin-player-position").value),
        handedness: document.getElementById("admin-player-handedness").value.trim() || null,
        overall_rating: numberOrZero(document.getElementById("admin-player-overall").value),
        potential_rating: numberOrZero(document.getElementById("admin-player-potential").value),
        years_left_to_grow: numberOrZero(document.getElementById("admin-player-years").value),
        status: document.getElementById("admin-player-status-edit").value,
        season_stats: seasonStats,
        updated_date: now
      };

      if (!payload.player_name) throw new Error("Player name is required.");

      let result;
      if (editingPlayerId) {
        result = await client
          .from("players")
          .update(payload)
          .eq("id", editingPlayerId)
          .select("id")
          .single();
      } else {
        payload.id = crypto.randomUUID();
        payload.created_date = now;
        payload.created_by_id = currentUserId;
        payload.is_sample = false;
        payload.season_history = [];

        result = await client
          .from("players")
          .insert(payload)
          .select("id")
          .single();
      }

      if (result.error) throw result.error;

      const wasEditing = Boolean(editingPlayerId);
      closePlayerModal();
      showMessage(wasEditing ? "Player updated successfully." : "Player added successfully.", "success");
      await Promise.all([loadPlayers(), loadOverview()]);
    } catch (error) {
      console.error("HCA Admin: player save failed:", error);
      formError.textContent = error.message || "Could not save player.";
    } finally {
      button.disabled = false;
      button.textContent = "SAVE PLAYER";
    }
  }



  /* ------------------------------
     GAME MANAGEMENT
  ------------------------------ */

  function seasonNumber(season) {
    const match = String(season || "").match(/(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function sortSeasons(seasons) {
    return [...new Set(seasons.filter(Boolean))].sort((a, b) => {
      return seasonNumber(b) - seasonNumber(a) || String(b).localeCompare(String(a));
    });
  }

  function getGameMetadata(game) {
    return game?.metadata && typeof game.metadata === "object" ? game.metadata : {};
  }

  function isGameOvertime(game) {
    const metadata = getGameMetadata(game);
    return game?.overtime === true || game?.overtime === "true" || game?.overtime === 1 || game?.overtime === "1" ||
      metadata.overtime === true || metadata.overtime === "true" || metadata.overtime === 1 || metadata.overtime === "1";
  }

  function teamById(id) {
    return teams.find(team => String(team.id) === String(id));
  }

  function teamNameById(id) {
    return teamById(id)?.name || "Unknown Team";
  }

  function playerById(id) {
    return players.find(player => String(player.id) === String(id));
  }

  function gameStatus(game) {
    return game?.status || getGameMetadata(game).status || "Completed";
  }

  function gameScore(game) {
    const metadata = getGameMetadata(game);
    const homeRaw = game?.home_score ?? metadata.home_goals;
    const awayRaw = game?.away_score ?? metadata.away_goals;
    const home = Number(homeRaw);
    const away = Number(awayRaw);
    return `${Number.isFinite(home) ? home : 0} - ${Number.isFinite(away) ? away : 0}`;
  }

  function loadGameSeasonFilters() {
    const select = document.getElementById("admin-game-season");
    const editSelect = document.getElementById("admin-game-season-edit");
    if (!select || !editSelect) return;

    const seasons = sortSeasons(games.map(game => game.season));
    if (!seasons.length) seasons.push("Season 16");

    select.innerHTML = `<option value="all">ALL SEASONS</option>` +
      seasons.map(season => `<option value="${escapeHTML(season)}">${escapeHTML(season).toUpperCase()}</option>`).join("");

    editSelect.innerHTML = seasons.map(season =>
      `<option value="${escapeHTML(season)}">${escapeHTML(season).toUpperCase()}</option>`
    ).join("");

    editSelect.value = seasons[0] || "Season 16";
  }

  function populateGameTeamFilter() {
    const select = document.getElementById("admin-game-team-filter");
    if (!select) return;

    select.innerHTML = `<option value="all">ALL TEAMS</option>` +
      teams.map(team => `<option value="${escapeHTML(team.id)}">${escapeHTML(window.hcaDisplayTeamName(team.name))}</option>`).join("");
  }

  function renderGames() {
    const body = document.getElementById("admin-games-body");
    const countLabel = document.getElementById("admin-game-count-label");
    if (!body || !countLabel) return;

    const season = document.getElementById("admin-game-season")?.value || "all";
    const teamId = document.getElementById("admin-game-team-filter")?.value || "all";

    const filtered = games.filter(game => {
      const seasonMatch = season === "all" || game.season === season;
      const teamMatch = teamId === "all" || String(game.home_team_id) === String(teamId) || String(game.away_team_id) === String(teamId);
      return seasonMatch && teamMatch;
    });

    countLabel.textContent = `Showing ${filtered.length} of ${games.length} games`;

    if (!filtered.length) {
      body.innerHTML = `<tr><td colspan="7" class="admin-table-empty">No games found.</td></tr>`;
      return;
    }

    // Group games by season + week so the schedule is easy to scan.
    // When a specific season is selected, the season label is omitted from
    // the group heading because the season is already represented by the filter.
    const sortedGames = [...filtered].sort((a, b) => {
      const seasonCompare = String(a.season || "").localeCompare(String(b.season || ""), undefined, { numeric: true });
      if (seasonCompare !== 0) return seasonCompare;
      const weekA = a.week == null ? Number.MAX_SAFE_INTEGER : Number(a.week);
      const weekB = b.week == null ? Number.MAX_SAFE_INTEGER : Number(b.week);
      if (weekA !== weekB) return weekA - weekB;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    const groups = new Map();
    sortedGames.forEach(game => {
      const seasonLabel = game.season || "Unknown Season";
      const weekLabel = game.week == null ? "Unassigned Week" : `Week ${game.week}`;
      const key = `${seasonLabel}::${weekLabel}`;
      if (!groups.has(key)) {
        groups.set(key, { season: seasonLabel, week: weekLabel, games: [] });
      }
      groups.get(key).games.push(game);
    });

    body.innerHTML = [...groups.values()].map(group => {
      const groupTitle = season === "all"
        ? `${escapeHTML(group.season)} · ${escapeHTML(group.week)}`
        : escapeHTML(group.week);

      const rows = group.games.map(game => {
        const status = gameStatus(game);
        const statusClass = String(status).toLowerCase().replace(/[^a-z]+/g, "-");
        return `
          <tr>
            <td><strong>${escapeHTML(game.season || "—")}</strong></td>
            <td>${escapeHTML(window.hcaDisplayTeamName(teamNameById(game.home_team_id)))}</td>
            <td><strong>${escapeHTML(gameScore(game))}</strong></td>
            <td>${escapeHTML(window.hcaDisplayTeamName(teamNameById(game.away_team_id)))}</td>
            <td><span class="admin-status admin-status-${escapeHTML(statusClass)}">${escapeHTML(status)}</span></td>
            <td>${isGameOvertime(game) ? "YES" : "—"}</td>
            <td><button type="button" class="admin-table-action admin-delete-game" data-delete-game="${escapeHTML(game.id)}">DELETE</button></td>
          </tr>
        `;
      }).join("");

      return `
        <tr class="admin-game-week-row">
          <td colspan="6">
            <div class="admin-game-week-header">
              <span>${groupTitle}</span>
              <small>${group.games.length} ${group.games.length === 1 ? "GAME" : "GAMES"}</small>
            </div>
          </td>
        </tr>
        ${rows}
      `;
    }).join("");
  }

  async function loadGames() {
    const body = document.getElementById("admin-games-body");
    if (!body) return;

    body.innerHTML = `<tr><td colspan="7" class="admin-table-empty">Loading games...</td></tr>`;

    const { data, error } = await client
      .from("games")
      .select(`
        id,
        season,
        week,
        game_date,
        home_team_id,
        away_team_id,
        home_team_name,
        away_team_name,
        home_score,
        away_score,
        status,
        overtime,
        shootout,
        game_type,
        venue,
        metadata
      `)
      .order("week", { ascending: false });

    if (error) {
      console.error("HCA Admin: failed to load games:", error);
      body.innerHTML = `<tr><td colspan="7" class="admin-table-empty">Could not load games: ${escapeHTML(error.message)}</td></tr>`;
      return;
    }

    games = data || [];
    loadGameSeasonFilters();
    populateGameTeamFilter();
    renderGames();
  }

  function playersForTeam(teamId) {
    if (!teamId) return [];
    return players.filter(player => String(player.team_id) === String(teamId));
  }

  function gameRosterPlayers() {
    const homeId = document.getElementById("admin-game-home-team")?.value;
    const awayId = document.getElementById("admin-game-away-team")?.value;
    const ids = new Set([String(homeId || ""), String(awayId || "")]);
    return players.filter(player => ids.has(String(player.team_id)));
  }

  function playerOptions(list, placeholder, selected = "") {
    return `<option value="">${escapeHTML(placeholder)}</option>` +
      list.map(player => `<option value="${escapeHTML(player.id)}" ${String(player.id) === String(selected) ? "selected" : ""}>${escapeHTML(player.player_name)}</option>`).join("");
  }

  function populateGameTeamSelects() {
    const home = document.getElementById("admin-game-home-team");
    const away = document.getElementById("admin-game-away-team");
    const goalTeam = document.getElementById("admin-game-goal-team");
    if (!home || !away || !goalTeam) return;

    const options = teams.map(team => `<option value="${escapeHTML(team.id)}">${escapeHTML(window.hcaDisplayTeamName(team.name))}</option>`).join("");
    home.innerHTML = `<option value="">SELECT HOME TEAM</option>${options}`;
    away.innerHTML = `<option value="">SELECT AWAY TEAM</option>${options}`;
    goalTeam.innerHTML = `<option value="">SELECT SCORING TEAM</option>` +
      teams.map(team => `<option value="${escapeHTML(team.id)}">${escapeHTML(window.hcaDisplayTeamName(team.name))}</option>`).join("");
  }

  function populateGoalieSelects() {
    const homeTeam = document.getElementById("admin-game-home-team")?.value;
    const awayTeam = document.getElementById("admin-game-away-team")?.value;
    const home = document.getElementById("admin-game-home-goalie");
    const away = document.getElementById("admin-game-away-goalie");
    if (!home || !away) return;

    home.innerHTML = playerOptions(playersForTeam(homeTeam).filter(player => positionText(player.position).toUpperCase().includes("G")), "NONE");
    away.innerHTML = playerOptions(playersForTeam(awayTeam).filter(player => positionText(player.position).toUpperCase().includes("G")), "NONE");
  }

  function populateGoalPlayerSelects() {
    const teamId = document.getElementById("admin-game-goal-team")?.value;
    const roster = playersForTeam(teamId);
    const scorer = document.getElementById("admin-game-scorer");
    const assistOne = document.getElementById("admin-game-assist-one");
    const assistTwo = document.getElementById("admin-game-assist-two");
    if (!scorer || !assistOne || !assistTwo) return;

    const options = playerOptions(roster, "SELECT SCORER");
    scorer.innerHTML = options;
    assistOne.innerHTML = playerOptions(roster, "ASSIST 1 (OPTIONAL)");
    assistTwo.innerHTML = playerOptions(roster, "ASSIST 2 (OPTIONAL)");
  }

  function renderGoalEvents() {
    const list = document.getElementById("admin-game-goal-list");
    if (!list) return;

    if (!gameGoalEvents.length) {
      list.innerHTML = `<div class="admin-event-empty">No goal events added yet.</div>`;
      return;
    }

    list.innerHTML = gameGoalEvents.map((event, index) => {
      const scorer = playerById(event.scorerId)?.player_name || "Unknown Player";
      const assists = event.assistIds.map(id => playerById(id)?.player_name).filter(Boolean);
      const team = teamNameById(event.teamId);
      return `
        <div class="admin-event-row">
          <div><strong>${index + 1}. ${escapeHTML(scorer)}</strong><span>${escapeHTML(team)}${assists.length ? ` · assists: ${escapeHTML(assists.join(", "))}` : ""}</span></div>
          <button type="button" class="admin-table-action" data-remove-goal="${index}">REMOVE</button>
        </div>
      `;
    }).join("");
  }

  function addGoalEvent() {
    const teamId = document.getElementById("admin-game-goal-team")?.value;
    const scorerId = document.getElementById("admin-game-scorer")?.value;
    const assistOne = document.getElementById("admin-game-assist-one")?.value;
    const assistTwo = document.getElementById("admin-game-assist-two")?.value;
    const error = document.getElementById("admin-game-form-error");

    if (!teamId || !scorerId) {
      error.textContent = "Select a scoring team and scorer before adding the goal.";
      return;
    }

    const assistIds = [assistOne, assistTwo].filter(Boolean);
    if (new Set([scorerId, ...assistIds]).size !== 1 + assistIds.length) {
      error.textContent = "The scorer and assists must be different players.";
      return;
    }

    gameGoalEvents.push({ teamId, scorerId, assistIds });

    const homeTeamId = document.getElementById("admin-game-home-team").value;
    const homeGoals = gameGoalEvents.filter(event => String(event.teamId) === String(homeTeamId)).length;
    const awayGoals = gameGoalEvents.length - homeGoals;
    document.getElementById("admin-game-home-goals").value = homeGoals;
    document.getElementById("admin-game-away-goals").value = awayGoals;

    error.textContent = "";
    renderGoalEvents();
    document.getElementById("admin-game-scorer").value = "";
    document.getElementById("admin-game-assist-one").value = "";
    document.getElementById("admin-game-assist-two").value = "";
  }

  function manualPlayerRow(playerId = "", goals = 0, assists = 0, plusMinus = 0) {
    const roster = gameRosterPlayers();
    const row = document.createElement("div");
    row.className = "admin-manual-row";
    row.innerHTML = `
      <select class="admin-manual-player">${playerOptions(roster, "SELECT PLAYER", playerId)}</select>
      <input class="admin-manual-goals" type="number" min="0" value="${numberOrZero(goals)}" aria-label="Goals">
      <input class="admin-manual-assists" type="number" min="0" value="${numberOrZero(assists)}" aria-label="Assists">
      <input class="admin-manual-plus-minus" type="number" value="${numberOrZero(plusMinus)}" aria-label="Plus minus">
      <button type="button" class="admin-table-action" data-remove-manual>REMOVE</button>
    `;
    return row;
  }

  function renderManualStats() {
    const list = document.getElementById("admin-game-manual-list");
    if (!list) return;
    if (!list.children.length) {
      list.appendChild(manualPlayerRow());
    }
  }

  function collectManualStats() {
    const rows = [...document.querySelectorAll("#admin-game-manual-list .admin-manual-row")];
    const seen = new Set();
    return rows.map(row => {
      const playerId = row.querySelector(".admin-manual-player")?.value;
      if (!playerId) return null;
      if (seen.has(playerId)) throw new Error("A player can only appear once in manual stats.");
      seen.add(playerId);
      return {
        player_id: playerId,
        goals: numberOrZero(row.querySelector(".admin-manual-goals")?.value),
        assists: numberOrZero(row.querySelector(".admin-manual-assists")?.value),
        plus_minus: numberOrZero(row.querySelector(".admin-manual-plus-minus")?.value)
      };
    }).filter(Boolean);
  }

  function collectGoalStats() {
    const byPlayer = new Map();
    gameGoalEvents.forEach(event => {
      const scorer = byPlayer.get(event.scorerId) || { player_id: event.scorerId, goals: 0, assists: 0, plus_minus: 0 };
      scorer.goals += 1;
      byPlayer.set(event.scorerId, scorer);
      event.assistIds.forEach(assistId => {
        const assist = byPlayer.get(assistId) || { player_id: assistId, goals: 0, assists: 0, plus_minus: 0 };
        assist.assists += 1;
        byPlayer.set(assistId, assist);
      });
    });
    return [...byPlayer.values()];
  }

  function resetGameModal() {
    gameGoalEvents = [];
    document.getElementById("admin-game-form")?.reset();
    document.getElementById("admin-game-home-goals").value = 0;
    document.getElementById("admin-game-away-goals").value = 0;
    document.getElementById("admin-game-home-saves").value = 0;
    document.getElementById("admin-game-away-saves").value = 0;
    document.getElementById("admin-game-home-goalie-saves").value = 0;
    document.getElementById("admin-game-away-goalie-saves").value = 0;
    document.getElementById("admin-game-home-goalie-gaa").value = "";
    document.getElementById("admin-game-away-goalie-gaa").value = "";
    document.getElementById("admin-game-home-empty-net").value = 0;
    document.getElementById("admin-game-away-empty-net").value = 0;
    document.getElementById("admin-game-status").value = "Completed";
    document.getElementById("admin-game-form-error").textContent = "";
    document.getElementById("admin-game-goal-list").innerHTML = `<div class="admin-event-empty">No goal events added yet.</div>`;
    document.getElementById("admin-game-manual-list").innerHTML = "";
    document.getElementById("admin-game-goals-mode").hidden = false;
    document.getElementById("admin-game-manual-mode").hidden = true;
    document.querySelectorAll("[data-game-mode]").forEach(button => button.classList.toggle("active", button.dataset.gameMode === "goals"));
  }

  async function openGameModal() {
    const modal = document.getElementById("admin-game-modal");
    if (!modal) return;

    if (!teams.length) await loadTeams();
    if (!players.length) await loadPlayers();

    resetGameModal();
    loadGameSeasonFilters();
    populateGameTeamSelects();
    populateGoalieSelects();
    populateGoalPlayerSelects();
    renderManualStats();
    modal.hidden = false;
    document.body.classList.add("admin-modal-open");
  }

  function closeGameModal() {
    const modal = document.getElementById("admin-game-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("admin-modal-open");
    gameGoalEvents = [];
  }

  function gamePlayerStatDelta(game, direction = 1) {
    const metadata = getGameMetadata(game);
    const stats = Array.isArray(metadata.player_stats) ? metadata.player_stats : [];
    return stats.map(stat => ({
      player_id: stat.player_id || stat.id,
      games_played: direction,
      goals: direction * numberOrZero(stat.goals),
      assists: direction * numberOrZero(stat.assists),
      points: direction * (numberOrZero(stat.goals) + numberOrZero(stat.assists))
    })).filter(stat => stat.player_id);
  }

  function gameGoalieStatDelta(game, direction = 1) {
    const metadata = getGameMetadata(game);
    const goalieStats = Array.isArray(metadata.goalie_stats) ? metadata.goalie_stats : [];
    return goalieStats.map(stat => ({
      player_id: stat.player_id,
      games_played: direction,
      saves: direction * numberOrZero(stat.saves),
      goals_against: direction * numberOrZero(stat.goals_against),
      shots_against: direction * numberOrZero(stat.shots_against),
      shutouts: direction * (stat.shutout ? 1 : 0),
      gaa_sum: direction * numberOrZero(stat.gaa)
    })).filter(stat => stat.player_id);
  }

  async function applyGameStats(game, direction = 1) {
    const deltas = new Map();
    [...gamePlayerStatDelta(game, direction), ...gameGoalieStatDelta(game, direction)].forEach(delta => {
      const existing = deltas.get(delta.player_id) || { player_id: delta.player_id };
      Object.keys(delta).forEach(key => {
        if (key !== "player_id") existing[key] = numberOrZero(existing[key]) + numberOrZero(delta[key]);
      });
      deltas.set(delta.player_id, existing);
    });

    if (!deltas.size) return;

    const ids = [...deltas.keys()];
    const { data: currentPlayers, error: fetchError } = await client
      .from("players")
      .select("id, season_stats")
      .in("id", ids);
    if (fetchError) throw fetchError;

    for (const player of currentPlayers || []) {
      const delta = deltas.get(player.id);
      if (!delta) continue;
      const stats = { ...(player.season_stats || {}) };
      const isGoalie = Object.prototype.hasOwnProperty.call(delta, "saves") || Object.prototype.hasOwnProperty.call(delta, "goals_against");

      stats.games_played = Math.max(0, numberOrZero(stats.games_played ?? stats.gp) + numberOrZero(delta.games_played));
      stats.gp = stats.games_played;

      if (isGoalie) {
        stats.saves = Math.max(0, numberOrZero(stats.saves) + numberOrZero(delta.saves));
        stats.goals_against = Math.max(0, numberOrZero(stats.goals_against) + numberOrZero(delta.goals_against));
        stats.shots_against = Math.max(0, numberOrZero(stats.shots_against) + numberOrZero(delta.shots_against));
        stats.shutouts = Math.max(0, numberOrZero(stats.shutouts) + numberOrZero(delta.shutouts));
        const previousGames = Math.max(0, numberOrZero(stats.games_played) - numberOrZero(delta.games_played));
        const previousGaaSum = Object.prototype.hasOwnProperty.call(stats, "gaa_sum")
          ? numberOrZero(stats.gaa_sum)
          : (Object.prototype.hasOwnProperty.call(stats, "gaa") && numberOrZero(stats.gaa) > 0
              ? numberOrZero(stats.gaa) * previousGames
              : numberOrZero(stats.goals_against) - numberOrZero(delta.goals_against));
        const newGaaSum = Math.max(0, previousGaaSum + numberOrZero(delta.gaa_sum));
        stats.gaa_sum = newGaaSum;
        stats.gaa = stats.games_played > 0 ? Number((newGaaSum / stats.games_played).toFixed(2)) : 0;
        stats.save_percentage = stats.shots_against > 0 ? Number((stats.saves / stats.shots_against).toFixed(3)) : 0;
        // A goalie can also receive an assist, but goals/points remain player stats.
        if (Object.prototype.hasOwnProperty.call(delta, "goals")) {
          stats.goals = Math.max(0, numberOrZero(stats.goals) + numberOrZero(delta.goals));
          stats.assists = Math.max(0, numberOrZero(stats.assists) + numberOrZero(delta.assists));
          stats.points = Math.max(0, numberOrZero(stats.points) + numberOrZero(delta.points));
        }
      } else {
        stats.goals = Math.max(0, numberOrZero(stats.goals) + numberOrZero(delta.goals));
        stats.assists = Math.max(0, numberOrZero(stats.assists) + numberOrZero(delta.assists));
        stats.points = Math.max(0, numberOrZero(stats.points) + numberOrZero(delta.points));
      }

      const { error: updateError } = await client
        .from("players")
        .update({ season_stats: stats, updated_date: new Date().toISOString() })
        .eq("id", player.id);
      if (updateError) throw updateError;
    }
  }

  async function saveGame(event) {
    event.preventDefault();
    const formError = document.getElementById("admin-game-form-error");
    const button = document.querySelector("#admin-game-form .admin-save-button");
    formError.textContent = "";
    button.disabled = true;
    button.textContent = "SAVING...";

    try {
      const season = document.getElementById("admin-game-season-edit").value;
      const homeTeamId = document.getElementById("admin-game-home-team").value;
      const awayTeamId = document.getElementById("admin-game-away-team").value;
      const status = document.getElementById("admin-game-status").value;
      const overtime = document.getElementById("admin-game-overtime").checked;
      const homeGoals = numberOrZero(document.getElementById("admin-game-home-goals").value);
      const awayGoals = numberOrZero(document.getElementById("admin-game-away-goals").value);
      const homeSaves = numberOrZero(document.getElementById("admin-game-home-saves").value);
      const awaySaves = numberOrZero(document.getElementById("admin-game-away-saves").value);
      const homeGoalieId = document.getElementById("admin-game-home-goalie").value || "";
      const awayGoalieId = document.getElementById("admin-game-away-goalie").value || "";
      const homeGoalieSaves = numberOrZero(document.getElementById("admin-game-home-goalie-saves").value);
      const awayGoalieSaves = numberOrZero(document.getElementById("admin-game-away-goalie-saves").value);
      const homeGoalieGaaRaw = document.getElementById("admin-game-home-goalie-gaa").value;
      const awayGoalieGaaRaw = document.getElementById("admin-game-away-goalie-gaa").value;
      const homeEmptyNet = numberOrZero(document.getElementById("admin-game-home-empty-net").value);
      const awayEmptyNet = numberOrZero(document.getElementById("admin-game-away-empty-net").value);

      if (!season || !homeTeamId || !awayTeamId) throw new Error("Season, home team, and away team are required.");
      if (String(homeTeamId) === String(awayTeamId)) throw new Error("Home and away teams must be different.");
      if (status === "Completed" && homeGoals === 0 && awayGoals === 0 && gameGoalEvents.length === 0) {
        // 0-0 is allowed, but this explicit branch prevents accidental empty completed games only when no stats were entered.
      }

      const manualMode = !document.getElementById("admin-game-manual-mode").hidden;
      const playerStats = manualMode ? collectManualStats() : collectGoalStats();

      if (!manualMode && playerStats.length) {
        const totalGoals = playerStats.reduce((sum, stat) => sum + stat.goals, 0);
        if (totalGoals !== homeGoals + awayGoals) {
          throw new Error(`Goal events produce ${totalGoals} total goals, but the score is ${homeGoals + awayGoals}.`);
        }
      }

      if (homeEmptyNet > homeGoals || awayEmptyNet > awayGoals) {
        throw new Error("Empty-net goals cannot exceed the team's total goals.");
      }

      const homeGoalieGA = Math.max(0, homeGoals - homeEmptyNet);
      const awayGoalieGA = Math.max(0, awayGoals - awayEmptyNet);
      const homeGoalieGaa = homeGoalieGaaRaw === "" ? homeGoalieGA : numberOrZero(homeGoalieGaaRaw);
      const awayGoalieGaa = awayGoalieGaaRaw === "" ? awayGoalieGA : numberOrZero(awayGoalieGaaRaw);
      const goalieStats = [];
      if (homeGoalieId) goalieStats.push({
        player_id: homeGoalieId,
        saves: homeGoalieSaves,
        goals_against: homeGoalieGA,
        shots_against: homeGoalieSaves + homeGoalieGA,
        gaa: homeGoalieGaa,
        shutout: homeGoalieGA === 0
      });
      if (awayGoalieId) goalieStats.push({
        player_id: awayGoalieId,
        saves: awayGoalieSaves,
        goals_against: awayGoalieGA,
        shots_against: awayGoalieSaves + awayGoalieGA,
        gaa: awayGoalieGaa,
        shutout: awayGoalieGA === 0
      });

      if (homeGoalieId && awayGoalieId && homeGoalieId === awayGoalieId) {
        throw new Error("Home and away goalies must be different players.");
      }

      const metadata = {
        status,
        home_goals: homeGoals,
        away_goals: awayGoals,
        home_saves: homeSaves,
        away_saves: awaySaves,
        home_goalie_id: homeGoalieId,
        away_goalie_id: awayGoalieId,
        home_goalie_saves: homeGoalieSaves,
        away_goalie_saves: awayGoalieSaves,
        home_goalie_ga: homeGoalieGA,
        away_goalie_ga: awayGoalieGA,
        home_goalie_gaa: homeGoalieGaa,
        away_goalie_gaa: awayGoalieGaa,
        home_empty_net_goals: homeEmptyNet,
        away_empty_net_goals: awayEmptyNet,
        goalie_stats: goalieStats,
        overtime,
        week: document.getElementById("admin-game-week").value ? numberOrZero(document.getElementById("admin-game-week").value) : null,
        player_stats: playerStats,
        entry_mode: manualMode ? "manual" : "goal_events"
      };

      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user?.id || null;
      const now = new Date().toISOString();

      const homeTeam = teamById(homeTeamId);
      const awayTeam = teamById(awayTeamId);
      const weekValue = document.getElementById("admin-game-week").value;

      const payload = {
        id: crypto.randomUUID(),
        season,
        week: weekValue ? numberOrZero(weekValue) : null,
        game_date: null,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_team_name: window.hcaDisplayTeamName(homeTeam?.name || ""),
        away_team_name: window.hcaDisplayTeamName(awayTeam?.name || ""),
        home_score: homeGoals,
        away_score: awayGoals,
        status: status === "Scheduled" ? "Scheduled" : "Completed",
        overtime,
        shootout: null,
        game_type: null,
        venue: null,
        metadata: {
          ...metadata,
          created_date: now,
          updated_date: now,
          created_by_id: userId,
          logged_by_id: userId,
          is_sample: false
        }
      };

      const { data: insertedGame, error } = await client.from("games").insert(payload).select("*").single();
      if (error) throw error;
      try {
        await applyGameStats(insertedGame, 1);
      } catch (statsError) {
        await client.from("games").delete().eq("id", insertedGame.id);
        throw new Error(`Game was rolled back because player/goalie stats could not be updated: ${statsError.message}`);
      }

      closeGameModal();
      showMessage("Game added successfully.", "success");
      await Promise.all([loadGames(), loadOverview()]);
    } catch (error) {
      console.error("HCA Admin: game save failed:", error);
      formError.textContent = error.message || "Could not save game.";
    } finally {
      button.disabled = false;
      button.textContent = "SAVE GAME";
    }
  }

  async function deleteGame(gameId) {
    const game = games.find(item => String(item.id) === String(gameId));
    if (!game) return;
    const matchup = `${window.hcaDisplayTeamName(game.home_team_name || teamNameById(game.home_team_id))} ${gameScore(game)} ${window.hcaDisplayTeamName(game.away_team_name || teamNameById(game.away_team_id))}`;
    if (!window.confirm(`Delete this game?\n\n${matchup}\n\nThis will also reverse the player and goalie stats recorded for the game.`)) return;

    let statsReversed = false;
    try {
      await applyGameStats(game, -1);
      statsReversed = true;
      const { error } = await client.from("games").delete().eq("id", gameId);
      if (error) throw error;
      showMessage("Game deleted successfully.", "success");
      await Promise.all([loadGames(), loadPlayers(), loadOverview()]);
    } catch (error) {
      if (statsReversed) {
        try { await applyGameStats(game, 1); } catch (rollbackError) { console.error("HCA Admin: game delete rollback failed:", rollbackError); }
      }
      console.error("HCA Admin: game delete failed:", error);
      const msg = document.getElementById("admin-game-message");
      if (msg) { msg.textContent = error.message || "Could not delete game."; msg.className = "admin-message error"; }
    }
  }

  async function checkSession() {
    showLogin();

    const { data, error } = await client.auth.getSession();

    if (error) {
      console.error("HCA Admin: session check failed:", error);
      showLogin("Could not check your session.");
      return;
    }

    if (!data.session?.user) {
      showLogin();
      return;
    }

    showApp(data.session.user);
    await loadOverview();

    // If the Players section is the initial/active section, load it immediately.
    if (document.getElementById("admin-section-players")?.classList.contains("active")) {
      await Promise.all([loadPlayers(), loadTeams()]);
    }
    if (document.getElementById("admin-section-games")?.classList.contains("active")) {
      await loadTeams();
      await loadPlayers();
      await loadGames();
    }
  }

  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    loginError.textContent = "";

    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;
    const button = loginForm.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "SIGNING IN...";

    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showApp(data.user);
      await loadOverview();

      if (document.getElementById("admin-section-players")?.classList.contains("active")) {
        await Promise.all([loadPlayers(), loadTeams()]);
      }
      if (document.getElementById("admin-section-games")?.classList.contains("active")) {
        await loadTeams();
        await loadPlayers();
        await loadGames();
      }
    } catch (error) {
      console.error("HCA Admin: login failed:", error);
      showLogin(error.message || "Unable to sign in.");
    } finally {
      button.disabled = false;
      button.textContent = "SIGN IN";
    }
  });

  async function logout() {
    const { error } = await client.auth.signOut();
    if (error) {
      console.error("HCA Admin: logout failed:", error);
      return;
    }
    showLogin();
  }

  document.addEventListener("input", event => {
    if (event.target.id === "admin-player-search") renderPlayers();
  });

  document.addEventListener("change", event => {
    if (event.target.id === "admin-player-status") renderPlayers();
  });

  document.addEventListener("change", event => {
    if (event.target.id === "admin-game-season" || event.target.id === "admin-game-team-filter") {
      renderGames();
    }

    if (event.target.id === "admin-game-goal-team") {
      populateGoalPlayerSelects();
    }

    if (event.target.id === "admin-game-home-team" || event.target.id === "admin-game-away-team") {
      populateGoalieSelects();
      populateGoalPlayerSelects();
      document.querySelectorAll("#admin-game-manual-list .admin-manual-row").forEach(row => {
        const current = row.querySelector(".admin-manual-player")?.value || "";
        row.querySelector(".admin-manual-player").innerHTML = playerOptions(gameRosterPlayers(), "SELECT PLAYER", current);
      });
    }
  });

  document.addEventListener("click", event => {
    const sectionButton = event.target.closest("[data-section]");
    if (sectionButton) setSection(sectionButton.dataset.section);

    if (event.target.closest("#admin-logout") || event.target.closest("#admin-logout-secondary")) {
      logout();
      return;
    }

    if (event.target.closest("#admin-add-player")) {
      void openPlayerModal();
      return;
    }

    if (event.target.closest("#admin-add-game")) {
      void openGameModal();
      return;
    }

    if (event.target.closest("#admin-add-goal")) {
      addGoalEvent();
      return;
    }

    const removeGoal = event.target.closest("[data-remove-goal]");
    if (removeGoal) {
      gameGoalEvents.splice(Number(removeGoal.dataset.removeGoal), 1);
      renderGoalEvents();
      const homeTeamId = document.getElementById("admin-game-home-team")?.value;
      const homeGoals = gameGoalEvents.filter(item => String(item.teamId) === String(homeTeamId)).length;
      document.getElementById("admin-game-home-goals").value = homeGoals;
      document.getElementById("admin-game-away-goals").value = gameGoalEvents.length - homeGoals;
      return;
    }

    if (event.target.closest("#admin-add-manual-player")) {
      document.getElementById("admin-game-manual-list")?.appendChild(manualPlayerRow());
      return;
    }

    if (event.target.closest("[data-remove-manual]")) {
      event.target.closest(".admin-manual-row")?.remove();
      return;
    }

    const modeButton = event.target.closest("[data-game-mode]");
    if (modeButton) {
      const mode = modeButton.dataset.gameMode;
      document.querySelectorAll("[data-game-mode]").forEach(button => button.classList.toggle("active", button === modeButton));
      document.getElementById("admin-game-goals-mode").hidden = mode !== "goals";
      document.getElementById("admin-game-manual-mode").hidden = mode !== "manual";
      if (mode === "manual") renderManualStats();
      return;
    }

    if (event.target.closest("[data-close-game-modal]")) {
      closeGameModal();
      return;
    }

    const deleteGameButton = event.target.closest("[data-delete-game]");
    if (deleteGameButton) {
      void deleteGame(deleteGameButton.dataset.deleteGame);
      return;
    }

    const editButton = event.target.closest("[data-edit-player]");
    if (editButton) {
      const player = players.find(item => String(item.id) === String(editButton.dataset.editPlayer));
      if (player) void openPlayerModal(player);
      return;
    }

    if (event.target.closest("[data-close-player-modal]")) {
      closePlayerModal();
    }
  });

  document.getElementById("admin-player-form")?.addEventListener("submit", savePlayer);
  document.getElementById("admin-game-form")?.addEventListener("submit", saveGame);

  client.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      showApp(session.user);
      loadOverview();
    } else {
      showLogin();
    }
  });

  checkSession();
})();
