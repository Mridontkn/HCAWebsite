/* HCA GLOBAL SEARCH + ACCOUNT MENU */
(() => {
  let initialized = false;
  let timer = null;
  let requestId = 0;

  const esc = v => String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const norm = v => String(v ?? "").trim().toLowerCase();

  function getClient() {
    return window.hcaSupabase || (typeof hcaSupabase !== "undefined" ? hcaSupabase : null);
  }

  function init() {
    if (initialized) return true;

    const searchPanel = document.getElementById("hca-search-panel");
    const accountPanel = document.getElementById("hca-account-panel");
    const input = document.getElementById("hca-global-search");
    const results = document.getElementById("hca-search-results");

    if (!searchPanel || !accountPanel || !input || !results) return false;

    initialized = true;

    const closeSearch = () => {
      searchPanel.hidden = true;
      document.querySelectorAll(".search-trigger").forEach(b => b.setAttribute("aria-expanded", "false"));
    };

    const closeAccount = () => {
      accountPanel.hidden = true;
      document.querySelectorAll(".account-trigger").forEach(b => b.setAttribute("aria-expanded", "false"));
    };

    const openSearch = button => {
      closeAccount();
      searchPanel.hidden = false;
      button?.setAttribute("aria-expanded", "true");
      results.innerHTML = '<p class="search-hint">Search teams, players, or games.</p>';
      setTimeout(() => input.focus(), 0);
    };

    document.addEventListener("click", event => {
      const searchBtn = event.target.closest(".search-trigger");
      const accountBtn = event.target.closest(".account-trigger");

      if (searchBtn) {
        event.preventDefault();
        openSearch(searchBtn);
        return;
      }

      if (accountBtn) {
        event.preventDefault();
        closeSearch();
        const open = accountPanel.hidden;
        accountPanel.hidden = !open;
        accountBtn.setAttribute("aria-expanded", String(open));
        return;
      }

      if (event.target.closest(".hca-search-close")) {
        closeSearch();
        return;
      }

      if (event.target.closest(".hca-search-result")) {
        // Let the anchor navigate normally, but remove the overlay immediately.
        closeSearch();
        return;
      }

      if (event.target.closest(".hca-account-option")) {
        closeAccount();
        return;
      }

      if (!searchPanel.hidden && !event.target.closest(".hca-search-inner") && !event.target.closest(".search-trigger")) {
        closeSearch();
      }

      if (!accountPanel.hidden && !event.target.closest(".hca-account-card") && !event.target.closest(".account-trigger")) {
        closeAccount();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeSearch();
        closeAccount();
      }
    });

    input.addEventListener("input", () => {
      clearTimeout(timer);
      const value = input.value;
      timer = setTimeout(() => performSearch(value), 250);
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        clearTimeout(timer);
        performSearch(input.value);
      }
    });

    return true;
  }

  async function performSearch(query) {
    const results = document.getElementById("hca-search-results");
    const client = getClient();
    if (!results || !client) return;

    const q = norm(query);
    if (!q) {
      results.innerHTML = '<p class="search-hint">Search teams, players, or games.</p>';
      return;
    }

    const thisRequest = ++requestId;
    results.innerHTML = '<p class="search-status">SEARCHING HCA...</p>';

    try {
      // Run simple, independent queries. This avoids PostgREST .or() syntax
      // issues and lets one searchable table fail without breaking the others.
      const [teamsRes, playersRes, gamesRes] = await Promise.all([
        client.from("teams")
          .select("id,name,city,conference,division,logo")
          .or(`name.ilike.%${q}%,city.ilike.%${q}%`)
          .limit(8),

        client.from("players")
          .select("id,player_name,team_id,team_name,position,overall_rating")
          .or(`player_name.ilike.%${q}%,team_name.ilike.%${q}%`)
          .limit(10),

        client.from("games")
          .select("id,season,week,home_team_id,away_team_id,home_team_name,away_team_name,home_score,away_score,status,overtime")
          .or(`home_team_name.ilike.%${q}%,away_team_name.ilike.%${q}%`)
          .limit(10)
      ]);

      if (thisRequest !== requestId) return;

      const errors = [teamsRes, playersRes, gamesRes].filter(r => r.error);
      if (errors.length === 3) throw errors[0].error;

      const items = [];

      if (!teamsRes.error) {
        (teamsRes.data || []).forEach(t => items.push({
          type: "TEAM",
          title: window.hcaDisplayTeamName(t.name),
          meta: [t.city, t.conference, t.division].filter(Boolean).join(" • "),
          href: `team.html?id=${encodeURIComponent(t.id)}`
        }));
      }

      if (!playersRes.error) {
        (playersRes.data || []).forEach(p => items.push({
          type: "PLAYER",
          title: p.player_name,
          meta: `${window.hcaDisplayTeamName(p.team_name || "Free Agent")}${p.overall_rating != null ? ` • OVR ${p.overall_rating}` : ""}`,
          href: `players.html?search=${encodeURIComponent(p.player_name || "")}`
        }));
      }

      if (!gamesRes.error) {
        (gamesRes.data || []).forEach(g => {
          const homeScore = Number(g.home_score);
          const awayScore = Number(g.away_score);
          const hasScore = Number.isFinite(homeScore) && Number.isFinite(awayScore);
          const teamId = g.home_team_id;
          items.push({
            type: "GAME",
            title: `${window.hcaDisplayTeamName(g.home_team_name || "Home")} vs ${window.hcaDisplayTeamName(g.away_team_name || "Away")}`,
            meta: `${g.season || "Season"} • Week ${g.week ?? "—"}${hasScore ? ` • ${homeScore}–${awayScore}` : " • Scheduled"}`,
            href: `game.html?id=${encodeURIComponent(g.id)}`
          });
        });
      }

      if (!items.length) {
        results.innerHTML = `<p class="search-empty">NO RESULTS FOR “${esc(query)}”</p>`;
        return;
      }

      results.innerHTML = items.slice(0, 24).map(item => `
        <a class="hca-search-result" href="${esc(item.href)}">
          <span class="hca-search-type">${esc(item.type)}</span>
          <div>
            <strong>${esc(item.title)}</strong>
            <small>${esc(item.meta || "")}</small>
          </div>
          <span class="hca-search-arrow">→</span>
        </a>
      `).join("");
    } catch (error) {
      console.error("HCA Search failed:", error);
      results.innerHTML = `<p class="search-error">SEARCH ERROR: ${esc(error?.message || "Unable to search HCA.")}</p>`;
    }
  }

  // Header is loaded asynchronously on every public page. Try immediately,
  // then retry briefly while the component is being fetched.
  const tryInit = () => init();
  if (!tryInit()) {
    let attempts = 0;
    const retry = setInterval(() => {
      attempts++;
      if (tryInit() || attempts >= 80) clearInterval(retry);
    }, 50);
  }

  const observer = new MutationObserver(() => {
    if (init()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
