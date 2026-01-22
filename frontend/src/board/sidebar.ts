export function initShell() {
  const toggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");

  const open = () => {
    if (!sidebar || !backdrop) return;
    sidebar.classList.remove("-translate-x-full");
    backdrop.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
  };

  const close = () => {
    if (!sidebar || !backdrop) return;
    sidebar.classList.add("-translate-x-full");
    backdrop.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
  };

  // default: closed on mobile, open on md+
  const syncForViewport = () => {
    if (!sidebar || !backdrop) return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      sidebar.classList.remove("-translate-x-full");
      backdrop.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
    } else {
      sidebar.classList.add("-translate-x-full");
      backdrop.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
    }
  };

  toggle?.addEventListener("click", () => {
    if (!sidebar || !backdrop) return;
    const isOpen = !sidebar.classList.contains("-translate-x-full");
    isOpen ? close() : open();
  });

  backdrop?.addEventListener("click", close);

  window.addEventListener("resize", syncForViewport);
  syncForViewport();
}
