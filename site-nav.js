(function initializeSiteNavigation() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const navigation = header.querySelector(".main-nav");
  const menuToggle = header.querySelector(".menu-toggle");
  const projectsToggle = header.querySelector(".projects-toggle");
  const projectsMenu = header.querySelector("#projectsMenu");
  const headerActions = header.querySelector(".header-actions");
  const loginControl = headerActions?.querySelector(".login-button");
  let accountProfile = null;
  let profileToggle = null;
  let profileMenu = null;

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
    projectsMenu?.querySelectorAll(".project-menu-group.open").forEach((group) => group.classList.remove("open"));
    projectsMenu?.querySelectorAll(".project-group-toggle").forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
  }

  function closeProfileMenu() {
    accountProfile?.classList.remove("open");
    profileToggle?.setAttribute("aria-expanded", "false");
  }

  function showSignedOutHeader() {
    if (loginControl) loginControl.hidden = false;
    if (accountProfile) accountProfile.hidden = true;
    closeProfileMenu();
  }

  function showSignedInHeader(session) {
    if (!accountProfile || !session?.authenticated) return showSignedOutHeader();
    const user = session.user || {};
    const name = String(user.name || user.email || user.phone || "My account").trim();
    const firstName = name.split(/\s+/)[0] || "Profile";
    const initial = firstName.charAt(0).toUpperCase() || "U";
    accountProfile.querySelector(".profile-initial").textContent = initial;
    accountProfile.querySelector(".profile-button-name").textContent = firstName;
    accountProfile.querySelector(".profile-menu-name").textContent = name;
    accountProfile.querySelector(".profile-menu-role").textContent = session.role === "admin" ? "Administrator" : "Client account";
    const dashboardLink = accountProfile.querySelector(".profile-dashboard-link");
    dashboardLink.hidden = session.role !== "admin";
    if (loginControl) loginControl.hidden = true;
    accountProfile.hidden = false;
  }

  async function refreshAccountState() {
    if (!headerActions || !accountProfile) return;
    header.classList.add("account-state-loading");
    try {
      const response = await fetch("api.php?action=account_session", { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Account session unavailable");
      showSignedInHeader(await response.json());
    } catch {
      showSignedOutHeader();
    } finally {
      header.classList.remove("account-state-loading");
    }
  }

  function initializeAccountProfile() {
    if (!headerActions || !loginControl) return;
    accountProfile = document.createElement("div");
    accountProfile.className = "header-profile";
    accountProfile.hidden = true;
    accountProfile.innerHTML = `<button class="profile-toggle" type="button" aria-expanded="false" aria-haspopup="menu"><span class="profile-initial" aria-hidden="true">U</span><span class="profile-button-name">Profile</span><span class="profile-chevron" aria-hidden="true">⌄</span></button><div class="profile-menu" role="menu"><div class="profile-menu-identity"><strong class="profile-menu-name">My account</strong><small class="profile-menu-role">Client account</small></div><a class="profile-dashboard-link" href="admin.html" role="menuitem" hidden>Open dashboard</a><a href="client-form.html" role="menuitem">Client Form</a><button class="profile-logout" type="button" role="menuitem">Log out</button></div>`;
    headerActions.appendChild(accountProfile);
    profileToggle = accountProfile.querySelector(".profile-toggle");
    profileMenu = accountProfile.querySelector(".profile-menu");
    profileToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = accountProfile.classList.toggle("open");
      profileToggle.setAttribute("aria-expanded", String(open));
    });
    accountProfile.querySelector(".profile-logout").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Logging out…";
      try {
        await fetch("api.php?action=logout", { method: "POST", credentials: "same-origin", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: "{}" });
      } finally {
        localStorage.removeItem("havenlyAdminSession");
        localStorage.removeItem("heeraClientSession");
        showSignedOutHeader();
        button.disabled = false;
        button.textContent = "Log out";
        window.dispatchEvent(new CustomEvent("heera:auth-changed", { detail: { authenticated: false } }));
        if ((window.location.pathname.split("/").pop() || "") === "client-form.html") window.location.href = "index.html";
      }
    });
    refreshAccountState();
  }

  function renderNavigationProjects(projects) {
    if (!projectsMenu) return;
    const grouped = new Map();
    projects.forEach((project) => {
      const title = String(project.title || "Project").trim() || "Project";
      const key = title.toLocaleLowerCase();
      if (!grouped.has(key)) grouped.set(key, { title, projects: [] });
      grouped.get(key).projects.push(project);
    });
    const items = [...grouped.values()].slice(0, 7).map((group) => {
      const planned = group.projects.filter((project) => String(project.plan_name || "").trim());
      if (!planned.length && group.projects.length === 1) {
        const link = document.createElement("a");
        link.href = `project.html?id=${Number(group.projects[0].project_id)}`;
        link.textContent = group.title;
        return link;
      }
      const wrapper = document.createElement("div");
      wrapper.className = "project-menu-group";
      const toggle = document.createElement("button");
      toggle.className = "project-group-toggle";
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = `<span>${escapeNavigationText(group.title)}</span><b>›</b>`;
      const submenu = document.createElement("div");
      submenu.className = "project-submenu";
      group.projects.forEach((project) => {
        const link = document.createElement("a");
        link.href = `project.html?id=${Number(project.project_id)}`;
        link.textContent = String(project.plan_name || "Project overview").trim();
        submenu.appendChild(link);
      });
      wrapper.append(toggle, submenu);
      return wrapper;
    });
    projectsMenu.replaceChildren(...items);
  }

  function escapeNavigationText(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
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
    const groupToggle = event.target.closest(".project-group-toggle");
    if (groupToggle) {
      event.stopPropagation();
      const group = groupToggle.closest(".project-menu-group");
      const isOpen = group?.classList.toggle("open") || false;
      groupToggle.setAttribute("aria-expanded", String(isOpen));
      return;
    }
    if (event.target.closest("a")) {
      closeMobileMenu();
      closeProjectsMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".projects-nav")) closeProjectsMenu();
    if (!event.target.closest(".header-profile")) closeProfileMenu();
    if (!event.target.closest(".site-header")) closeMobileMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileMenu();
      closeProjectsMenu();
      closeProfileMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1050) closeMobileMenu();
  });

  const pageName = window.location.pathname.split("/").pop() || "index.html";
  if (pageName === "index.html" || pageName === "") {
    header.querySelector('[data-page="home"]')?.classList.add("is-active");
  }

  window.addEventListener("heera:auth-changed", refreshAccountState);
  initializeAccountProfile();
  loadNavigationProjects();
})();
