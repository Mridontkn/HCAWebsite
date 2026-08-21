/*
  HCA STANDINGS
  Uses COMPLETED Season 16 games ONLY.
*/

(() => {

  const client =
    window.hcaSupabase ||
    (typeof hcaSupabase !== "undefined" ? hcaSupabase : null);

  if (!client) {
    console.error("HCA Standings: Supabase client was not found.");
    return;
  }

  let teams = [];
  let standings = [];

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createTeamRecord(team) {

    return {
      id: team.id,
      name: team.name || team.team_name || "Unknown Team",

      conference: team.conference || "",
      division: team.division || "",

      gp: 0,
      w: 0,
      l: 0,
      otl: 0,

      pts: 0,

      gf: 0,
      ga: 0
    };

  }

  function calculateStandings(games) {

    const records = new Map();

    // Create a blank record for every team
    teams.forEach(team => {
      records.set(
        team.id,
        createTeamRecord(team)
      );
    });

    /*
      IMPORTANT:

      Only Season 16
      AND
      only games that have actually been played.
    */

    const season16Games = games.filter(game => {

      // Season 16 only
      if (game.season !== "Season 16") {
        return false;
      }

      /*
        Scheduled games should NOT count.

        The imported HCA data stores status
        inside metadata.
      */
      const status = game.metadata?.status;

      if (status === "Scheduled") {
        return false;
      }

      /*
        Some imported games may not have a status.

        If there is no status but the score is
        0-0, treat it as unplayed.
      */
      const homeScore = Number(
        game.metadata?.home_goals
      );

      const awayScore = Number(
        game.metadata?.away_goals
      );

      if (
        !Number.isFinite(homeScore) ||
        !Number.isFinite(awayScore)
      ) {
        return false;
      }

      if (
        status !== "Completed" &&
        homeScore === 0 &&
        awayScore === 0
      ) {
        return false;
      }

      return true;

    });

    console.log(
      "Season 16 completed games:",
      season16Games.length
    );

    // Calculate standings
    season16Games.forEach(game => {

      if (
        !game.home_team_id ||
        !game.away_team_id
      ) {
        return;
      }

      const home = records.get(
        game.home_team_id
      );

      const away = records.get(
        game.away_team_id
      );

      if (!home || !away) {
        return;
      }

      const homeScore = Number(
        game.metadata?.home_goals
      );

      const awayScore = Number(
        game.metadata?.away_goals
      );

      if (
        !Number.isFinite(homeScore) ||
        !Number.isFinite(awayScore)
      ) {
        return;
      }

      /*
        Games Played
      */

      home.gp++;
      away.gp++;

      /*
        Goals
      */

      home.gf += homeScore;
      home.ga += awayScore;

      away.gf += awayScore;
      away.ga += homeScore;

      /*
        Overtime

        This is stored in the imported JSON
        as metadata.overtime.
      */

const overtime =
    game.overtime === true ||
    game.overtime === "true" ||
    game.overtime === 1 ||
    game.overtime === "1" ||
    game.metadata?.overtime === true ||
    game.metadata?.overtime === "true" ||
    game.metadata?.overtime === 1 ||
    game.metadata?.overtime === "1";

      /*
        Home wins
      */

      if (homeScore > awayScore) {

        home.w++;
        home.pts += 2;

        if (overtime) {

          away.otl++;
          away.pts += 1;

        } else {

          away.l++;

        }

      }

      /*
        Away wins
      */

      else if (awayScore > homeScore) {

        away.w++;
        away.pts += 2;

        if (overtime) {

          home.otl++;
          home.pts += 1;

        } else {

          home.l++;

        }

      }

    });

    /*
      Calculate goal differential
      and sort standings.
    */

    return Array.from(records.values())

      .map(team => ({
        ...team,
        diff: team.gf - team.ga
      }))

      .sort((a, b) =>

        // Points
        b.pts - a.pts ||

        // Wins
        b.w - a.w ||

        // Goal differential
        b.diff - a.diff ||

        // Goals for
        b.gf - a.gf ||

        // Alphabetical
        a.name.localeCompare(b.name)

      );

  }

  function renderStandings() {

    const body =
      document.getElementById(
        "hca-standings-body"
      );

    const status =
      document.getElementById(
        "hca-standings-status"
      );

    const filter =
      document.getElementById(
        "hca-standings-filter"
      );

    if (
      !body ||
      !status ||
      !filter
    ) {
      return;
    }

    const selected =
      filter.value;

    const filtered =
      standings.filter(team => {

        return (
          selected === "all" ||
          team.conference === selected
        );

      });

    status.textContent =
      `Showing ${filtered.length} teams • Season 16`;

    if (!filtered.length) {

      body.innerHTML = `
        <tr>
          <td
            colspan="10"
            class="hca-standings-empty"
          >
            No teams found.
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML =
      filtered.map((team, index) => `

        <tr>

          <td>
            ${index + 1}
          </td>

          <td class="hca-standings-team">
            ${escapeHTML(team.name)}
          </td>

          <td>
            ${team.gp}
          </td>

          <td>
            ${team.w}
          </td>

          <td>
            ${team.l}
          </td>

          <td>
            ${team.otl}
          </td>

          <td class="hca-standings-points">
            ${team.pts}
          </td>

          <td>
            ${team.gf}
          </td>

          <td>
            ${team.ga}
          </td>

          <td class="${
            team.diff > 0
              ? "hca-standings-diff-positive"
              : team.diff < 0
                ? "hca-standings-diff-negative"
                : ""
          }">

            ${team.diff > 0 ? "+" : ""}
            ${team.diff}

          </td>

        </tr>

      `).join("");

  }

  async function loadStandings() {

    const body =
      document.getElementById(
        "hca-standings-body"
      );

    if (!body) {
      return;
    }

    try {

      /*
        Get teams
      */

      const teamsResponse =
        await client
          .from("teams")
          .select(
            "id, name, conference, division"
          );

      /*
        Get games
      */

      const gamesResponse =
        await client
          .from("games")
.select(`
    id,
    season,
    home_team_id,
    away_team_id,
    metadata,
    overtime
`)

      if (teamsResponse.error) {
        throw teamsResponse.error;
      }

      if (gamesResponse.error) {
        throw gamesResponse.error;
      }

      teams =
        teamsResponse.data || [];

      const games =
        gamesResponse.data || [];

      /*
        Calculate Season 16
      */

      standings =
        calculateStandings(games);

      /*
        Render
      */

      renderStandings();

      /*
        Debug information
      */

      const season1Games =
        games.filter(
          g => g.season === "Season 1"
        );

      const season15Games =
        games.filter(
          g => g.season === "Season 15"
        );

      const season16Games =
        games.filter(
          g => g.season === "Season 16"
        );

      const completedSeason16 =
        season16Games.filter(game => {

          const status =
            game.metadata?.status;

          const home =
            Number(
              game.metadata?.home_goals
            );

          const away =
            Number(
              game.metadata?.away_goals
            );

          if (status === "Scheduled") {
            return false;
          }

          if (
            status !== "Completed" &&
            home === 0 &&
            away === 0
          ) {
            return false;
          }

          return true;

        });

      console.log(
        "HCA Standings loaded:",
        {
          season1Games:
            season1Games.length,

          season15Games:
            season15Games.length,

          season16Games:
            season16Games.length,

          completedSeason16Games:
            completedSeason16.length,

          teams:
            standings.length
        }
      );

    }

    catch (error) {

      console.error(
        "HCA Standings: failed to load:",
        error
      );

      body.innerHTML = `
        <tr>

          <td
            colspan="10"
            class="hca-standings-empty"
          >

            Could not load standings.

          </td>

        </tr>
      `;

    }

  }

  /*
    Conference filter
  */

  document.addEventListener(
    "change",
    event => {

      if (
        event.target.id ===
        "hca-standings-filter"
      ) {

        renderStandings();

      }

    }
  );

  /*
    Start
  */

  if (
    document.getElementById(
      "hca-standings-body"
    )
  ) {

    loadStandings();

  }

})();