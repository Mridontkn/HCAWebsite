/* Load the shared HCA header and wire standalone navigation. */
(async () => {
  const target = document.getElementById("header");
  if (!target || target.children.length) return;
  try {
    const response = await fetch("components/header.html", { cache: "no-store" });
    if (!response.ok) throw new Error(`Header request failed: ${response.status}`);
    target.innerHTML = await response.text();
    const page = location.pathname.split('/').pop().replace('.html','') || 'index';
    const mapped = page === 'index' ? 'home' : page;
    document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.page === mapped));
    document.dispatchEvent(new CustomEvent("hca:header-loaded"));
  } catch (error) { console.error("HCA Header: failed to load:", error); }
})();
