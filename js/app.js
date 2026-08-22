// ============================================
// HCA APPLICATION
// ============================================

console.log("HCA application loaded.");
console.log("Supabase client:", hcaSupabase);


// ============================================
// SHARED HELPERS
// ============================================

async function getTableCount(tableName) {
    const { count, error } = await hcaSupabase
        .from(tableName)
        .select("*", { count: "exact", head: true });

    if (error) {
        throw new Error(`${tableName}: ${error.message}`);
    }

    return count ?? 0;
}


// ============================================
// HOMEPAGE
// ============================================

async function loadLeagueStats() {
    if (!document.getElementById("team-count")) return;

    try {
        const [teams, players, games, schedule] = await Promise.all([
            getTableCount("teams"),
            getTableCount("players"),
            getTableCount("games"),
            getTableCount("schedule")
        ]);

        document.getElementById("team-count").textContent = teams;
        document.getElementById("player-count").textContent = players;
        document.getElementById("games-count").textContent = games;
        document.getElementById("scheduled-count").textContent = schedule;

        console.log("League stats loaded:", {
            teams,
            players,
            games,
            schedule
        });
    } catch (error) {
        console.error("Could not load league stats:", error);
    }
}


// ============================================
// PLAYERS
// ============================================

let allPlayers = [];

function positionValue(player) {
    if (Array.isArray(player.position)) {
        return player.position[0] || "";
    }

    if (typeof player.position === "string") {
        return player.position;
    }

    return "";
}

function initials(name) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join("")
        .toUpperCase();
}

function renderPlayers() {
    const grid = document.getElementById("players-grid");
    const count = document.getElementById("players-visible-count");

    if (!grid || !count) return;

    const search = document
        .getElementById("player-search")
        .value
        .trim()
        .toLowerCase();

    const selectedPosition = document.getElementById("player-position").value;

    const filtered = allPlayers.filter(player => {
        const name = (player.player_name || "").toLowerCase();
        const team = (player.team_name || "").toLowerCase();
        const pos = positionValue(player).toUpperCase();

        const matchesSearch =
            !search ||
            name.includes(search) ||
            team.includes(search);

        let matchesPosition = true;

        if (selectedPosition === "F") {
            matchesPosition = ["C", "LW", "RW", "F"].includes(pos);
        } else if (selectedPosition === "D") {
            matchesPosition = pos === "D";
        } else if (selectedPosition === "G") {
            matchesPosition = pos === "G";
        }

        return matchesSearch && matchesPosition;
    });

    count.textContent = filtered.length;

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="players-empty">
                No players match your search.
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(player => {
        const name = player.player_name || "Unknown Player";
        const team = window.hcaDisplayTeamName(player.team_name || "Free Agent");
        const pos = positionValue(player) || "—";
        const rating = player.overall_rating ?? "—";

        return `
            <article class="player-card">
                <div class="player-avatar">${initials(name)}</div>

                <div class="player-meta">
                    <small>${pos}</small>
                    <h3>${escapeHtml(name)}</h3>
                    <p>${escapeHtml(team)}</p>
                </div>

                <div class="player-rating">
                    <strong>${rating}</strong>
                    <small>OVR</small>
                </div>
            </article>
        `;
    }).join("");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function loadPlayers() {
    const grid = document.getElementById("players-grid");

    if (!grid) return;

    try {
        const { data, error } = await hcaSupabase
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

        if (error) {
            throw error;
        }

        allPlayers = data || [];
        renderPlayers();

        console.log(`Loaded ${allPlayers.length} players.`);
    } catch (error) {
        console.error("Could not load players:", error);

        grid.innerHTML = `
            <div class="players-empty">
                We couldn't load the players right now.
            </div>
        `;
    }
}


// ============================================
// PAGE NAVIGATION
// ============================================

function showPage(pageName) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.toggle("active", page.id === pageName);
    });

    document.querySelectorAll(".nav-item").forEach(link => {
        link.classList.toggle(
            "active",
            link.dataset.page === pageName
        );
    });

    if (pageName === "players" && allPlayers.length === 0) {
        loadPlayers();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function goToPage(pageName) {
    history.replaceState(null, "", `#${pageName}`);
    showPage(pageName);
}


// ============================================
// HEADER
// ============================================

async function loadHeader() {
    const headerContainer = document.getElementById("header");

    if (!headerContainer) return;

    try {
        const response = await fetch("components/header.html");

        if (!response.ok) {
            throw new Error(`Header request failed: ${response.status}`);
        }

        headerContainer.innerHTML = await response.text();

        const standalonePage = ["players.html", "standings.html", "stats.html", "team.html"]
            .find(page => location.pathname.endsWith(`/${page}`));

        if (standalonePage) {
            document.querySelectorAll(".nav-item").forEach(link => {
                link.classList.toggle(
                    "active",
                    link.dataset.page === standalonePage.replace(".html", "")
                );
            });

            return;
        }

        document.querySelectorAll(".nav-item").forEach(link => {
            if (!link.href.includes("#")) return;

            link.addEventListener("click", event => {
                event.preventDefault();
                goToPage(link.dataset.page);
            });
        });
    } catch (error) {
        console.error("Could not load header:", error);
    }
}


// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener("input", event => {
    if (event.target.id === "player-search") {
        renderPlayers();
    }
});

document.addEventListener("change", event => {
    if (event.target.id === "player-position") {
        renderPlayers();
    }
});

document.addEventListener("click", event => {
    const button = event.target.closest("[data-go]");

    if (button) {
        goToPage(button.dataset.go);
    }
});


// ============================================
// START
// ============================================

async function initApp() {
    await loadHeader();
    await loadLeagueStats();

    if (["/players.html", "/standings.html", "/stats.html", "/team.html"].some(path => location.pathname.endsWith(path))) return;

    const initialPage = location.hash.slice(1);
    const validPages = ["home", "standings", "stats"];

    showPage(validPages.includes(initialPage) ? initialPage : "home");
}

initApp();
