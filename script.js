let properties = [
  {
    id: 1,
    status: "For sale",
    type: "House",
    address: "4236 Mornington Road",
    city: "Pacific Heights, San Francisco",
    price: 1850000,
    beds: 4,
    baths: 3,
    area: "2,820 sqft",
    image: "https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=900&q=85"
  },
  {
    id: 2,
    status: "For sale",
    type: "Apartment",
    address: "22 Wythe Avenue, Apt. 5B",
    city: "Williamsburg, Brooklyn",
    price: 975000,
    beds: 2,
    baths: 2,
    area: "1,240 sqft",
    image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85"
  },
  {
    id: 3,
    status: "For sale",
    type: "Villa",
    address: "818 Meadow Lane",
    city: "South Congress, Austin",
    price: 1245000,
    beds: 3,
    baths: 2.5,
    area: "2,460 sqft",
    image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85"
  },
  {
    id: 4,
    status: "For rent",
    type: "Apartment",
    address: "87 West 12th Street",
    city: "West Village, New York",
    price: 4800,
    priceLabel: "$4,800/mo",
    beds: 1,
    baths: 1,
    area: "760 sqft",
    image: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=85"
  },
  {
    id: 5,
    status: "For sale",
    type: "House",
    address: "1105 Oakwood Drive",
    city: "Silver Lake, Los Angeles",
    price: 1495000,
    beds: 3,
    baths: 2,
    area: "1,960 sqft",
    image: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=900&q=85"
  },
  {
    id: 6,
    status: "For sale",
    type: "House",
    address: "14 Pelican Point",
    city: "Coconut Grove, Miami",
    price: 2100000,
    beds: 4,
    baths: 4,
    area: "3,115 sqft",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=85"
  }
];

async function loadProperties() {
  try {
    const response = await fetch("api.php?action=properties", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not load listings");
    const data = await response.json();
    if (Array.isArray(data)) {
      properties = data.map((property) => ({
        id: Number(property.property_id),
        status: property.listing_type === "rent" ? "For rent" : "For sale",
        listingType: property.listing_type,
        type: property.property_type,
        address: property.title || property.address_line1,
        city: [property.city, property.state_region].filter(Boolean).join(", "),
        price: Number(property.price),
        priceLabel: property.listing_type === "rent" ? `$${Number(property.price).toLocaleString()}/mo` : undefined,
        beds: property.bedrooms,
        baths: property.bathrooms,
        area: property.area_sqft ? `${Number(property.area_sqft).toLocaleString()} sqft` : "—",
        image: property.image_url || "https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=900&q=85",
        photoCount: Number(property.image_count || 1),
        videoUrl: property.video_url,
        externalUrl: property.external_url
        ,
        sizeLabel: property.size_label || "",
        propertyFacing: property.property_facing || "",
        pricePkr: property.price_pkr ? Number(property.price_pkr) : null,
        pricePerMarla: property.price_per_marla ? Number(property.price_per_marla) : null
      }));
    }
  } catch (error) {
    // The page remains usable with sample listings until the PHP/MySQL API is configured.
  }
  renderProperties();
}

let savedIds = JSON.parse(localStorage.getItem("havenlySaved") || "[]");
let listingMode = "all";

async function apiRequest(action, data = null) {
  const options = { method: data ? "POST" : "GET", headers: { Accept: "application/json" } };
  if (data) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }
  const response = await fetch(`api.php?action=${encodeURIComponent(action)}`, options);
  const result = await response.json().catch(() => ({ error: "The server returned an invalid response." }));
  if (!response.ok) throw new Error(result.error || "Something went wrong.");
  return result;
}

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const safeUrl = (value) => {
  const url = String(value || "").trim();
  if (url.startsWith("uploads/")) return url;
  try { return ["http:", "https:"].includes(new URL(url).protocol) ? url : ""; } catch { return ""; }
};

const fallbackProjects = [
  "Harbor Point Residences", "Aster Heights", "Parkside Villas", "Cedar Square", "Bayview Residences", "The Arc at Central", "Orchard House"
].map((title, index) => ({ project_id: index + 1, title }));

function renderProjectMenu(projects) {
  const menu = document.querySelector("#projectsMenu");
  menu.innerHTML = projects.slice(0, 7).map((project) => `<a href="project.html?id=${Number(project.project_id)}">${escapeHtml(project.title)}</a>`).join("");
}

async function loadProjects() {
  try {
    const response = await fetch("api.php?action=projects", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not load projects");
    const projects = await response.json();
    renderProjectMenu(Array.isArray(projects) && projects.length ? projects : fallbackProjects);
  } catch (error) {
    renderProjectMenu(fallbackProjects);
  }
}

let homeGalleryItems = [];
let homeGalleryIndex = 0;
let homeGalleryTimer = null;

function showHomeGallerySlide(index) {
  const gallery = document.querySelector("#homeGallery");
  if (!homeGalleryItems.length || !gallery) return;
  homeGalleryIndex = (index + homeGalleryItems.length) % homeGalleryItems.length;
  const track = gallery.querySelector(".gallery-slider-track");
  if (track) track.style.transform = `translateX(-${homeGalleryIndex * 100}%)`;
  gallery.querySelectorAll(".gallery-dot").forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === homeGalleryIndex);
  });
}

function stopHomeGalleryAutoplay() {
  if (homeGalleryTimer) {
    clearInterval(homeGalleryTimer);
    homeGalleryTimer = null;
  }
}

function startHomeGalleryAutoplay() {
  stopHomeGalleryAutoplay();
  if (homeGalleryItems.length < 2) return;
  homeGalleryTimer = setInterval(() => {
    showHomeGallerySlide(homeGalleryIndex + 1);
  }, 5000);
}

function renderHomeGallery(items) {
  const gallery = document.querySelector("#homeGallery");
  homeGalleryItems = Array.isArray(items) ? items.filter((item) => safeUrl(item.image_url)) : [];
  if (!gallery) return;
  stopHomeGalleryAutoplay();
  if (!homeGalleryItems.length) {
    gallery.innerHTML = '<p class="home-gallery-empty">New images from our work will appear here soon.</p>';
    return;
  }
  const slides = homeGalleryItems.map((item) => {
    const image = safeUrl(item.image_url);
    return `<div class="gallery-slide"><figure class="gallery-tile"><img src="${image}" alt="${escapeHtml(item.caption || "Havenly gallery image")}" loading="lazy" />${item.caption ? `<span>${escapeHtml(item.caption)}</span>` : ""}</figure></div>`;
  }).join("");
  const dots = homeGalleryItems.length > 1 ? `<div class="gallery-dots">${homeGalleryItems.map((_, index) => `<button type="button" class="gallery-dot${index === 0 ? " active" : ""}" data-index="${index}" aria-label="Go to slide ${index + 1}"></button>`).join("")}</div>` : "";
  const controls = homeGalleryItems.length > 1 ? `
    <button type="button" class="gallery-control gallery-prev" aria-label="Previous image">‹</button>
    <button type="button" class="gallery-control gallery-next" aria-label="Next image">›</button>
  ` : "";
  gallery.innerHTML = `
    <div class="home-gallery-slider">
      <div class="gallery-slider-track">${slides}</div>
      ${controls}
    </div>
    ${dots}
  `;
  if (homeGalleryItems.length > 1) {
    const prevButton = gallery.querySelector(".gallery-prev");
    const nextButton = gallery.querySelector(".gallery-next");
    prevButton?.addEventListener("click", () => {
      showHomeGallerySlide(homeGalleryIndex - 1);
      startHomeGalleryAutoplay();
    });
    nextButton?.addEventListener("click", () => {
      showHomeGallerySlide(homeGalleryIndex + 1);
      startHomeGalleryAutoplay();
    });
    gallery.querySelectorAll(".gallery-dot").forEach((dot) => {
      dot.addEventListener("click", (event) => {
        const target = event.currentTarget;
        const index = Number(target.dataset.index);
        showHomeGallerySlide(index);
        startHomeGalleryAutoplay();
      });
    });
    showHomeGallerySlide(0);
    startHomeGalleryAutoplay();
  }
}

async function loadHomeGallery() {
  try {
    const response = await fetch("api.php?action=home_gallery", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not load gallery");
    const items = await response.json();
    renderHomeGallery(Array.isArray(items) ? items : []);
  } catch (error) {
    renderHomeGallery([]);
  }
}

function renderAgents(items) {
  const grid = document.querySelector("#agentsGrid");
  if (!items || !items.length) {
    grid.innerHTML = '<p class="home-gallery-empty">Our agents will appear here soon.</p>';
    return;
  }
  grid.innerHTML = items.map((agent) => {
    const photo = safeUrl(agent.photo_url) || "uploads/default-agent.png";
    const contactLinks = [];
    if (agent.email) {
      contactLinks.push(`<a class="agent-contact-link" href="mailto:${encodeURIComponent(agent.email)}">Email</a>`);
    }
    if (agent.phone) {
      contactLinks.push(`<a class="agent-contact-link" href="tel:${encodeURIComponent(agent.phone)}">Call</a>`);
      const whatsappNumber = String(agent.phone).replace(/\D/g, "");
      if (whatsappNumber) {
        contactLinks.push(`<a class="agent-contact-link whatsapp" href="https://wa.me/${whatsappNumber}" target="_blank" rel="noopener">WhatsApp</a>`);
      }
    }
    return `<article class="agent-card">
      <div class="agent-photo"><img src="${photo}" alt="${escapeHtml(agent.name)}" loading="lazy" /></div>
      <div class="agent-info">
        <strong>${escapeHtml(agent.name)}</strong>
        <small>${escapeHtml(agent.title || "Agent")}</small>
        <p>${escapeHtml(agent.bio || "")}</p>
        ${contactLinks.length ? `<div class="agent-contact-list">${contactLinks.join("")}</div>` : ""}
      </div>
    </article>`;
  }).join("");
}

// Front-page popup ads (one or many, rotated as a carousel)
let frontPopups = [];
let frontPopupIndex = 0;
let frontPopupTimer = null;

function showFrontPopupByIndex(index) {
  const existing = document.querySelector('#frontPopup');
  if (!existing) return;
  const popup = frontPopups[index];
  if (!popup) return;
  frontPopupIndex = index;
  const panel = existing.querySelector('.front-popup-panel');
  const img = panel.querySelector('.popup-image');
  const headline = panel.querySelector('.popup-headline');
  const body = panel.querySelector('.popup-body');
  const action = panel.querySelector('.popup-action');
  img.src = safeUrl(popup.image_url) || popup.image_url;
  headline.textContent = popup.headline || '';
  body.innerHTML = popup.html_content || '';
  if (popup.link_url) {
    action.href = popup.link_url;
    action.hidden = false;
  } else {
    action.hidden = true;
  }
// update dots
  const dots = existing.querySelectorAll('.popup-dot');
  dots.forEach((dot, i) => dot.classList.toggle('active', i === frontPopupIndex));
  // update counter
  const counter = existing.querySelector('#popupCounter');
  if (counter) counter.textContent = `${frontPopupIndex + 1} / ${frontPopups.length}`;
  // restart auto-advance
  restartPopupTimer();
}

function renderPopupDots() {
  const existing = document.querySelector('#frontPopup');
  if (!existing) return;
  const dotsWrap = existing.querySelector('.popup-dots');
  if (!dotsWrap) return;
  dotsWrap.innerHTML = frontPopups.map((_, i) => `<button type="button" class="popup-dot" data-index="${i}" aria-label="Go to ad ${i + 1}"></button>`).join('');
}

function restartPopupTimer() {
  if (frontPopupTimer) clearInterval(frontPopupTimer);
  if (frontPopups.length < 2) return;
  frontPopupTimer = setInterval(() => {
    const next = (frontPopupIndex + 1) % frontPopups.length;
    showFrontPopupByIndex(next);
  }, 5000);
}

function openFrontPopup() {
  const existing = document.querySelector('#frontPopup');
  if (!existing) return;
  existing.hidden = false;
  requestAnimationFrame(() => existing.classList.add('open'));
}

function closeFrontPopup() {
  const existing = document.querySelector('#frontPopup');
  if (!existing) return;
  existing.classList.remove('open');
  setTimeout(() => { if (!existing.classList.contains('open')) existing.hidden = true; }, 220);
  if (frontPopupTimer) { clearInterval(frontPopupTimer); frontPopupTimer = null; }
}

async function loadHomePopupFront() {
  try {
    const response = await fetch('api.php?action=home_popups', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const data = await response.json();
    const popups = Array.isArray(data) ? data : (data && data.popups) ? data.popups : [];
    // only keep popups that have an image so they render nicely
    const candidates = popups.filter((p) => p && (p.image_url || p.html_content));
    if (!candidates.length) return;
    frontPopups = candidates;
    frontPopupIndex = 0;
    renderPopupDots();
    showFrontPopupByIndex(0);
    openFrontPopup();
  } catch (e) { /* ignore */ }
}

document.addEventListener('DOMContentLoaded', () => {
  loadHomePopupFront();
  // Index login popup handlers (admin login on main page)
  const openLoginBtn = document.querySelector('#openIndexLogin');
  const loginPopup = document.querySelector('#loginPopup');
  const closeLoginPopup = document.querySelector('#closeLoginPopup');
  const loginPopupBackdrop = document.querySelector('#loginPopupBackdrop');
  const loginForm = document.querySelector('#indexLoginForm');
  const loginError = document.querySelector('#indexLoginError');
  if (openLoginBtn && loginPopup) {
    openLoginBtn.addEventListener('click', () => {
      loginPopup.hidden = false;
      requestAnimationFrame(() => loginPopup.classList.add('open'));
    });
  }
  if (closeLoginPopup && loginPopup) {
    closeLoginPopup.addEventListener('click', () => {
      loginPopup.classList.remove('open');
      setTimeout(() => { if (!loginPopup.classList.contains('open')) loginPopup.hidden = true; }, 220);
    });
  }
  if (loginPopupBackdrop && loginPopup) {
    loginPopupBackdrop.addEventListener('click', () => {
      loginPopup.classList.remove('open');
      setTimeout(() => { if (!loginPopup.classList.contains('open')) loginPopup.hidden = true; }, 220);
    });
  }
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loginError) loginError.textContent = '';
      const email = (loginForm.elements.email && loginForm.elements.email.value || '').trim();
      const password = (loginForm.elements.password && loginForm.elements.password.value) || '';
      try {
        const res = await fetch('api.php?action=login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          if (loginError) loginError.textContent = (json && json.error) || 'Login failed';
          return;
        }
        // on success navigate to admin dashboard
        window.location.href = 'admin.html';
      } catch (err) {
        if (loginError) loginError.textContent = err.message || 'Network error';
      }
    });
  }
  const closeBtn = document.querySelector('#closeFrontPopup');
  const front = document.querySelector('#frontPopup');
  const markPopupSeen = () => {
    try {
      const current = frontPopups[frontPopupIndex];
      if (current && current.popup_id) {
        let seen = [];
        const raw = localStorage.getItem('homePopupSeenList');
        if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) seen = parsed; }
        if (!seen.includes(String(current.popup_id))) seen.push(String(current.popup_id));
        localStorage.setItem('homePopupSeenList', JSON.stringify(seen));
      }
    } catch (e) { /* ignore */ }
  };
  if (closeBtn && front) closeBtn.addEventListener('click', () => { markPopupSeen(); closeFrontPopup(); });
  const backdrop = front ? front.querySelector('.front-popup-backdrop') : null;
  if (backdrop && front) backdrop.addEventListener('click', () => { markPopupSeen(); closeFrontPopup(); });
  // carousel controls
  const prevBtn = front ? front.querySelector('.popup-prev') : null;
  const nextBtn = front ? front.querySelector('.popup-next') : null;
  if (prevBtn) prevBtn.addEventListener('click', () => { if (frontPopups.length < 2) return; showFrontPopupByIndex((frontPopupIndex - 1 + frontPopups.length) % frontPopups.length); });
  if (nextBtn) nextBtn.addEventListener('click', () => { if (frontPopups.length < 2) return; showFrontPopupByIndex((frontPopupIndex + 1) % frontPopups.length); });
  // dots
  const dotsWrap = front ? front.querySelector('.popup-dots') : null;
  if (dotsWrap) dotsWrap.addEventListener('click', (event) => {
    const dot = event.target.closest('.popup-dot');
    if (dot) showFrontPopupByIndex(Number(dot.dataset.index));
  });
});

async function loadAgents() {
  try {
    const response = await fetch("api.php?action=agents", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not load agents");
    const items = await response.json();
    renderAgents(Array.isArray(items) ? items : []);
  } catch (error) {
    renderAgents([]);
  }
}

const elements = {
  grid: document.querySelector("#propertyGrid"),
  savedCount: document.querySelector("#savedCount"),
  savedList: document.querySelector("#savedList"),
  drawer: document.querySelector("#savedDrawer"),
  backdrop: document.querySelector("#backdrop"),
  resultsMessage: document.querySelector("#resultsMessage"),
  type: document.querySelector("#typeFilter"),
  location: document.querySelector("#locationFilter"),
  price: document.querySelector("#priceFilter")
};

window.addEventListener("agents:updated", () => {
  loadAgents();
});

const popupElements = {
  trigger: document.querySelector("#openIndexLogin"),
  modal: document.querySelector("#loginPopup"),
  backdrop: document.querySelector("#loginPopupBackdrop"),
  close: document.querySelector("#closeLoginPopup"),
  form: document.querySelector("#indexLoginForm"),
  error: document.querySelector("#indexLoginError")
};

function openLoginPopup() {
  if (!popupElements.modal) return;
  popupElements.error.textContent = "";
  popupElements.modal.hidden = false;
  requestAnimationFrame(() => popupElements.modal.classList.add("open"));
  popupElements.form.elements.email.focus();
}

function closeLoginPopup() {
  if (!popupElements.modal) return;
  popupElements.modal.classList.remove("open");
  setTimeout(() => {
    if (!popupElements.modal.classList.contains("open")) {
      popupElements.modal.hidden = true;
    }
  }, 220);
}

const formatPrice = (property) => property.priceLabel || new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0
}).format(property.price);

function renderProperties(list = properties) {
  if (!list.length) {
    elements.grid.innerHTML = `<div class="no-results"><h3>No homes found</h3><p>Try changing your search filters to see more properties.</p></div>`;
    elements.resultsMessage.textContent = "No matching homes";
    return;
  }
  elements.resultsMessage.textContent = list.length === properties.length ? "" : `${list.length} matching home${list.length === 1 ? "" : "s"}`;
  elements.grid.innerHTML = list.map((property) => {
    const image = safeUrl(property.image) || "https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=900&q=85";
    const videoUrl = safeUrl(property.videoUrl);
    const externalUrl = safeUrl(property.externalUrl);
    const mediaLinks = [
      property.photoCount > 1 ? `<span>▣ ${property.photoCount} photos</span>` : "",
      videoUrl ? `<a href="${videoUrl}" target="_blank" rel="noopener">▶ Video tour</a>` : "",
      externalUrl ? `<a href="${externalUrl}" target="_blank" rel="noopener">↗ View details</a>` : ""
    ].filter(Boolean).join("");
    return `
      <article class="property-card" data-id="${property.id}">
        <div class="property-image">
          <a href="property.html?id=${property.id}"><img src="${image}" alt="${escapeHtml(property.type)} at ${escapeHtml(property.address)}" loading="lazy" /></a>
          <span class="tag">${escapeHtml(property.status)}</span>
          <button class="favorite ${savedIds.includes(property.id) ? "active" : ""}" data-id="${property.id}" aria-label="Save ${escapeHtml(property.address)}" aria-pressed="${savedIds.includes(property.id)}">${savedIds.includes(property.id) ? "♥" : "♡"}</button>
        </div>
        <div class="property-content">
          <div class="property-price">${formatPrice(property)}</div>
          <p class="property-address"><a href="property.html?id=${property.id}">${escapeHtml(property.address)}</a></p>
          <p class="property-city">${escapeHtml(property.city)}</p>
          ${mediaLinks ? `<div class="property-media-links">${mediaLinks}</div>` : ""}
          <a class="property-detail-button" href="property.html?id=${property.id}">View details</a>
          <div class="property-specs"><span>▣ ${property.beds} beds</span><span>◒ ${property.baths} baths</span><span>⌑ ${property.area}</span></div>
        </div>
      </article>`;
  }).join("");
}

function persistSaved() {
  localStorage.setItem("havenlySaved", JSON.stringify(savedIds));
  if (elements.savedCount) elements.savedCount.textContent = savedIds.length;
  renderSavedList();
}

function toggleSaved(id) {
  savedIds = savedIds.includes(id) ? savedIds.filter((savedId) => savedId !== id) : [...savedIds, id];
  persistSaved();
  applyFilters();
}

function renderSavedList() {
  const saved = properties.filter((property) => savedIds.includes(property.id));
  if (!saved.length) {
    elements.savedList.innerHTML = `<p class="saved-empty">You have not saved any homes yet. Tap the heart on a listing to keep it here.</p>`;
    return;
  }
  elements.savedList.innerHTML = saved.map((property) => `
    <div class="saved-item">
      <img src="${safeUrl(property.image)}" alt="${escapeHtml(property.address)}" />
      <div><strong>${escapeHtml(property.address)}</strong><span>${formatPrice(property)}</span></div>
      <button class="remove-saved" data-id="${property.id}" aria-label="Remove ${escapeHtml(property.address)}">×</button>
    </div>`).join("");
}

function applyFilters() {
  const type = elements.type.value;
  const location = elements.location.value.trim().toLowerCase();
  const maxPrice = elements.price.value === "all" ? Infinity : Number(elements.price.value);
  renderProperties(properties.filter((property) =>
    (listingMode === "all" || property.listingType === listingMode || (listingMode === "rent" && property.status === "For rent") || (listingMode === "sale" && property.status === "For sale")) &&
    (type === "all" || property.type === type) &&
    (!location || `${property.address} ${property.city}`.toLowerCase().includes(location)) &&
    property.price <= maxPrice
  ));
}

function setDrawer(open) {
  elements.drawer.classList.toggle("open", open);
  elements.backdrop.classList.toggle("show", open);
  elements.drawer.setAttribute("aria-hidden", !open);
}

const searchForm = document.querySelector("#searchForm");
if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyFilters();
    document.querySelector("#listings")?.scrollIntoView({ behavior: "smooth" });
  });
}

const clearFiltersButton = document.querySelector("#clearFilters");
if (clearFiltersButton) {
  clearFiltersButton.addEventListener("click", () => {
    elements.type.value = "all";
    elements.location.value = "";
    elements.price.value = "all";
    listingMode = "all";
    renderProperties();
  });
}

if (elements.grid) {
  elements.grid.addEventListener("click", (event) => {
    const favoriteButton = event.target.closest(".favorite");
    if (favoriteButton) {
      toggleSaved(Number(favoriteButton.dataset.id));
      return;
    }
    const interactiveLink = event.target.closest("a, button, .property-media-links a");
    if (interactiveLink) return;
    const card = event.target.closest(".property-card");
    if (card && card.dataset.id) {
      window.location.href = `property.html?id=${card.dataset.id}`;
    }
  });
}
if (elements.savedList) {
  elements.savedList.addEventListener("click", (event) => {
    const button = event.target.closest(".remove-saved");
    if (button) toggleSaved(Number(button.dataset.id));
  });
}
const savedButton = document.querySelector("#savedButton");
if (savedButton) {
  savedButton.addEventListener("click", () => setDrawer(true));
}
const closeDrawer = document.querySelector("#closeDrawer");
if (closeDrawer) {
  closeDrawer.addEventListener("click", () => setDrawer(false));
}
if (elements.backdrop) {
  elements.backdrop.addEventListener("click", () => setDrawer(false));
}

if (popupElements.trigger) {
  popupElements.trigger.addEventListener("click", openLoginPopup);
}
if (popupElements.close) {
  popupElements.close.addEventListener("click", closeLoginPopup);
}
if (popupElements.backdrop) {
  popupElements.backdrop.addEventListener("click", closeLoginPopup);
}
if (popupElements.form) {
  popupElements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    popupElements.error.textContent = "";
    try {
      const result = await apiRequest("login", { email: form.elements.email.value, password: form.elements.password.value });
      const user = result.user || { email: form.elements.email.value };
      localStorage.setItem("havenlyAdminSession", JSON.stringify({
        loggedIn: true,
        email: user.email || form.elements.email.value,
        name: user.name || user.email || form.elements.email.value
      }));
      form.reset();
      closeLoginPopup();
      window.location.href = "admin.html";
    } catch (error) {
      popupElements.error.textContent = error.message;
    }
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && popupElements.modal && !popupElements.modal.hidden) {
    closeLoginPopup();
  }
});

document.querySelector(".menu-toggle").addEventListener("click", (event) => {
  const nav = document.querySelector(".main-nav");
  const open = nav.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", open);
});
document.querySelectorAll(".main-nav a").forEach((link) => link.addEventListener("click", () => document.querySelector(".main-nav").classList.remove("open")));
const projectsToggle = document.querySelector(".projects-toggle");
const projectsMenu = document.querySelector("#projectsMenu");
projectsToggle.addEventListener("click", () => {
  const open = projectsMenu.classList.toggle("open");
  projectsToggle.setAttribute("aria-expanded", open);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".projects-nav")) {
    projectsMenu.classList.remove("open");
    projectsToggle.setAttribute("aria-expanded", "false");
  }
});
document.querySelectorAll("[data-listing]").forEach((link) => link.addEventListener("click", () => {
  listingMode = link.dataset.listing;
  applyFilters();
}));

document.querySelector("#contactForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const firstName = form.elements.name.value.trim().split(" ")[0];
  document.querySelector("#formSuccess").textContent = `Thank you, ${firstName}! We’ll be in touch shortly.`;
  form.reset();
});

document.querySelector("#year").textContent = new Date().getFullYear();
persistSaved();
if (document.querySelector("#propertyGrid") || document.querySelector("#searchForm")) {
  loadProperties();
}
if (document.querySelector("#projectsMenu")) {
  loadProjects();
}
if (document.querySelector("#homeGallery")) {
  loadHomeGallery();
}
if (document.querySelector("#agentsGrid")) {
  loadAgents();
}
