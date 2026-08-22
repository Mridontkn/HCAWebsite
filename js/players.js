/*
  HCA PLAYERS
  Requires:
    1. Supabase CDN loaded before this file
    2. Your existing supabase client OR hcaSupabase
*/

(() => {
  // Use the existing client if one already exists.
  // This avoids redeclaring "supabase".
  const client =
    window.hcaSupabase ||
    (typeof hcaSupabase !== "undefined" ? hcaSupabase : null);

  if (!client) {
    console.error(
      "HCA Players: Supabase client was not found. " +
      "Load your existing supabase.js before players.js."
    );
    return;
  }

  let players = [];

  function getPosition(player) {
    if (Array.isArray(player.position)) {
      return player.position.join(" / ");
    }

    return player.position || "—";
  }

  function positionMatches(player, filter) {
    if (filter === "all") return true;

    const position = getPosition(player).toUpperCase();

    if (filter === "F") {
      return ["C", "LW", "RW", "F"].some(p => position.includes(p));
    }

    if (filter === "D") {
      return position.includes("D");
    }

    if (filter === "G") {
      return position.includes("G");
    }

    return true;
  }

  function initials(name) {
    return String(name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word[0])
      .join("")
      .toUpperCase();
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function render() {
    const grid = document.getElementById("hca-player-grid");
    const count = document.getElementById("hca-player-count");
    const searchInput = document.getElementById("hca-player-search");
    const positionSelect = document.getElementById("hca-player-position");

    if (!grid || !count || !searchInput || !positionSelect) return;

    const search = searchInput.value.trim().toLowerCase();
    const position = positionSelect.value;

    const filtered = players.filter(player => {
      const name = String(player.player_name || "").toLowerCase();
      const team = String(player.team_name || "").toLowerCase();

      return (
        (!search || name.includes(search) || team.includes(search)) &&
        positionMatches(player, position)
      );
    });

    count.textContent = `Showing ${filtered.length} of ${players.length} players`;

    if (!filtered.length) {
      grid.innerHTML =
        '<div class="hca-player-message">No players found.</div>';
      return;
    }

    grid.innerHTML = filtered.map(player => `
      <article class="hca-player-card">
        <div class="hca-player-avatar">
          ${escapeHTML(initials(player.player_name))}
        </div>

        <div>
          <div class="hca-player-position">
            ${escapeHTML(getPosition(player))}
          </div>

          <h3 class="hca-player-name">
            ${escapeHTML(player.player_name || "Unknown Player")}
          </h3>

          <p class="hca-player-team">
            ${escapeHTML(window.hcaDisplayTeamName(player.team_name || "Free Agent"))}
          </p>
        </div>

        <div class="hca-player-rating">
          <strong>${player.overall_rating ?? "—"}</strong>
          <small>OVR</small>
        </div>
      </article>
    `).join("");
  }

  async function loadPlayers() {
    const grid = document.getElementById("hca-player-grid");

    if (!grid) return;

    try {
      const { data, error } = await client
        .from("players")
        .select(`
          id,
          player_name,
          team_id,
          team_name,
          position,
          overall_rating,
          status
        `)
        .order("player_name", { ascending: true });

      if (error) throw error;

      players = data || [];
      const params = new URLSearchParams(location.search);
      const initialSearch = params.get("search");
      if (initialSearch && searchInput) searchInput.value = initialSearch;
      render();

      console.log(`HCA Players: loaded ${players.length} players.`);
    } catch (error) {
      console.error("HCA Players: failed to load players:", error);

      grid.innerHTML =
        '<div class="hca-player-message">Could not load players.</div>';
    }
  }

  document.addEventListener("input", event => {
    if (event.target.id === "hca-player-search") {
      render();
    }
  });

  document.addEventListener("change", event => {
    if (event.target.id === "hca-player-position") {
      render();
    }
  });

  // Only run when the Players section actually exists.
  if (document.getElementById("hca-player-grid")) {
    loadPlayers();
  }
})();
