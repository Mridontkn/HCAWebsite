/* HCA shared display helpers */
(() => {
  function displayTeamName(value) {
    let name = String(value ?? "").trim();
    if (!name) return "";

    // Imported HCA data sometimes stores names as "City City Team".
    // Remove only the duplicated leading phrase, preserving the actual city
    // when it is legitimately part of the team's name.
    const words = name.split(/\s+/);
    for (let count = Math.floor(words.length / 2); count >= 1; count--) {
      const first = words.slice(0, count).join(" ");
      const second = words.slice(count, count * 2).join(" ");
      if (first && first.localeCompare(second, undefined, { sensitivity: "accent" }) === 0) {
        return words.slice(count).join(" ");
      }
    }

    return name;
  }

  window.hcaDisplayTeamName = displayTeamName;
})();
