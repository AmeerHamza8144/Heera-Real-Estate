(function initializeSiteNavigation() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const navigation = header.querySelector(".main-nav");
  const menuToggle = header.querySelector(".menu-toggle");
  const projectsToggle = header.querySelector(".projects-toggle");
  const projectsMenu = header.querySelector("#projectsMenu");

  const fallbackProjects = [
    "Harbor Point Residences",
    "Aster Heights",
    "Parkside Villas",
    "Cedar Square",
    "Bayview Residences",
    "The Arc at Central",
    "Orchard House"
  ].map((title, index) => ({ project_id: index + 1, title }));

  function closeMobileMenu() {
    navigation?.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Open menu");
    document.body.classList.remove("menu-open");
  }

  function closeProjectsMenu() {
    projectsMenu?.classList.remove("open");
    projectsToggle?.setAttribute("aria-expanded", "false");
  }

  function renderNavigationProjects(projects) {
    if (!projectsMenu) return;
    const links = projects.slice(0, 7).map((project) => {
      const link = document.createElement("a");
      link.href = `project.html?id=${Number(project.project_id)}`;
      link.textContent = String(project.title || "Project");
      return link;
    });
    projectsMenu.replaceChildren(...links);
  }

  async function loadNavigationProjects() {
    if (!projectsMenu) return;
    try {
      const response = await fetch("api.php?action=projects", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Projects unavailable");
      const projects = await response.json();
      renderNavigationProjects(Array.isArray(projects) && projects.length ? projects : fallbackProjects);
    } catch {
      renderNavigationProjects(fallbackProjects);
    }
  }

  menuToggle?.addEventListener("click", () => {
    const isOpen = navigation?.classList.toggle("open") || false;
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    document.body.classList.toggle("menu-open", isOpen);
    if (!isOpen) closeProjectsMenu();
  });

  projectsToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = projectsMenu?.classList.toggle("open") || false;
    projectsToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navigation?.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeMobileMenu();
      closeProjectsMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".projects-nav")) closeProjectsMenu();
    if (!event.target.closest(".site-header")) closeMobileMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileMenu();
      closeProjectsMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1050) closeMobileMenu();
  });

  const pageName = window.location.pathname.split("/").pop() || "index.html";
  if (pageName === "index.html" || pageName === "") {
    header.querySelector('[data-page="home"]')?.classList.add("is-active");
  }

  loadNavigationProjects();
})();