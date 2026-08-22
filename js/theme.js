(() => {
  const key = "hca-theme";
  const saved = localStorage.getItem(key);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) document.body.classList.add("hca-dark");
  document.documentElement.classList.toggle("hca-dark", document.body.classList.contains("hca-dark"));
  function update(){
    const dark = document.body.classList.toggle("hca-dark");
    document.documentElement.classList.toggle("hca-dark", dark);
    localStorage.setItem(key, dark ? "dark" : "light");
  }
  document.addEventListener("click", e => {
    if (e.target.closest(".theme-toggle")) update();
  });
})();
