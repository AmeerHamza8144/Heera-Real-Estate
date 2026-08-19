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
        searchPrice: property.price_pkr ? Number(property.price_pkr) : Number(property.price),
        priceLabel: property.listing_type === "rent" ? `$${Number(property.price).toLocaleString()}/mo` : undefined,
        beds: property.bedrooms,
        baths: property.bathrooms,
        area: property.area_sqft ? `${Number(property.area_sqft).toLocaleString()} sqft` : "—",
        image: property.image_url || "https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=900&q=85",
        images: Array.isArray(property.images) ? property.images : [property.image_url].filter(Boolean),
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
const requestedListingMode = new URLSearchParams(window.location.search).get("listing");
let listingMode = ["sale", "rent"].includes(requestedListingMode) ? requestedListingMode : "all";

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
  const video = panel.querySelector('.popup-video');
  const headline = panel.querySelector('.popup-headline');
  const body = panel.querySelector('.popup-body');
  const action = panel.querySelector('.popup-action');
  const type = ['content','image','video'].includes(popup.popup_type) ? popup.popup_type : (popup.image_url ? 'image' : 'content');
  panel.dataset.popupType = type;
  video.pause();
  video.removeAttribute('src');
  video.load();
  img.hidden = type !== 'image';
  video.hidden = type !== 'video';
  headline.hidden = type !== 'content' || !popup.headline;
  body.hidden = type !== 'content' || !popup.html_content;
  if (type === 'image') img.src = safeUrl(popup.image_url) || popup.image_url;
  else img.removeAttribute('src');
  if (type === 'video') { video.src = safeUrl(popup.video_url) || popup.video_url; video.load(); }
  headline.textContent = type === 'content' ? (popup.headline || '') : '';
  body.innerHTML = type === 'content' ? (popup.html_content || '') : '';
  if (popup.link_url) {
    action.href = popup.link_url;
    action.textContent = 'View details';
    action.hidden = false;
  } else {
    action.hidden = true;
  }
// update dots
  const dots = existing.querySelectorAll('.popup-dot');
  dots.forEach((dot, i) => dot.classList.toggle('active', i === frontPopupIndex));
  // update counter
  const counter = existing.querySelector('#popupCounter');
  if (counter) {
    counter.hidden = frontPopups.length < 2;
    counter.textContent = frontPopups.length > 1 ? `${frontPopupIndex + 1} / ${frontPopups.length}` : '';
  }
  // restart auto-advance
  restartPopupTimer();
}

function renderPopupDots() {
  const existing = document.querySelector('#frontPopup');
  if (!existing) return;
  const dotsWrap = existing.querySelector('.popup-dots');
  if (!dotsWrap) return;
  const singlePopup = frontPopups.length < 2;
  dotsWrap.hidden = singlePopup;
  dotsWrap.innerHTML = singlePopup ? '' : frontPopups.map((_, i) => `<button type="button" class="popup-dot" data-index="${i}" aria-label="Go to ad ${i + 1}"></button>`).join('');
  existing.querySelectorAll('.popup-nav').forEach((button) => { button.hidden = singlePopup; });
}

function restartPopupTimer() {
  if (frontPopupTimer) clearInterval(frontPopupTimer);
  if (frontPopups.length < 2) return;
  if (frontPopups[frontPopupIndex]?.popup_type === 'video') return;
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
  existing.querySelector('.popup-video')?.pause();
}

async function loadHomePopupFront() {
  try {
    const response = await fetch('api.php?action=home_popups', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const data = await response.json();
    const popups = Array.isArray(data) ? data : (data && data.popups) ? data.popups : [];
    const candidates = popups.filter((p) => {
      if (!p) return false;
      const type = ['content','image','video'].includes(p.popup_type) ? p.popup_type : (p.image_url ? 'image' : 'content');
      return type === 'image' ? !!p.image_url : type === 'video' ? !!p.video_url : !!(p.headline || p.html_content);
    });
    if (!candidates.length) return;
    frontPopups = candidates;
    frontPopupIndex = 0;
    renderPopupDots();
    showFrontPopupByIndex(0);
    openFrontPopup();
  } catch (e) { /* ignore */ }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.hash !== '#admin-login') loadHomePopupFront();
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
    if (window.location.hash === '#admin-login' || window.location.hash === '#login') {
      openLoginBtn.click();
      if(window.location.hash==='#admin-login') setTimeout(()=>setAuthView('admin-login'),0);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
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

async function loadPublicOfficeAddresses() {
  const container = document.querySelector("#officeAddresses");
  if (!container) return;
  try {
    const response = await fetch("api.php?action=office_addresses", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Could not load office addresses");
    const items = await response.json();
    if (!Array.isArray(items) || !items.length) {
      container.innerHTML = '<p class="home-gallery-empty">Office addresses will appear here soon.</p>';
      return;
    }
    container.innerHTML = items.map((item) => {
      const phone = item.phone ? `<a href="tel:${encodeURIComponent(item.phone)}">${escapeHtml(item.phone)}</a>` : "";
      const mapUrl = safeUrl(item.map_url);
      return `<article class="office-address-card"><span class="office-address-icon" aria-hidden="true">⌖</span><div><h3>${escapeHtml(item.office_name)}</h3><address>${escapeHtml(item.address_text)}</address><div class="office-address-actions">${phone}${mapUrl ? `<a href="${mapUrl}" target="_blank" rel="noopener">Open in Maps <span>→</span></a>` : ""}</div></div></article>`;
    }).join("");
  } catch (error) {
    container.innerHTML = '<p class="home-gallery-empty">Office addresses are temporarily unavailable.</p>';
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
  if (popupElements.error) popupElements.error.textContent = "";
  popupElements.modal.hidden = false;
  requestAnimationFrame(() => popupElements.modal.classList.add("open"));
  popupElements.modal.querySelector('input')?.focus();
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

const formatPrice = (property) => {
  if (property.pricePkr) return `PKR ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(property.pricePkr)}`;
  return property.priceLabel || new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0
  }).format(property.price);
};

function propertyCardsMarkup(list) {
  return list.map((property) => {
    const image = safeUrl(property.image) || "https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=900&q=85";
    const images = (Array.isArray(property.images) ? property.images : [image]).map(safeUrl).filter(Boolean);
    if (!images.length) images.push(image);
    const carouselSlides = images.map((imageUrl, index) => `
      <a class="property-listing-slide" href="property.html?id=${property.id}" aria-label="View ${escapeHtml(property.address)}, photo ${index + 1}">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(property.type)} at ${escapeHtml(property.address)}${images.length > 1 ? `, photo ${index + 1}` : ""}" loading="lazy" />
      </a>`).join("");
    const carouselControls = images.length > 1 ? `
      <button class="property-slide-control property-slide-previous" type="button" data-direction="-1" aria-label="Previous property photo">‹</button>
      <button class="property-slide-control property-slide-next" type="button" data-direction="1" aria-label="Next property photo">›</button>
      <div class="property-slide-dots" aria-hidden="true">${images.map((_, index) => `<span class="property-slide-dot${index === 0 ? " active" : ""}"></span>`).join("")}</div>
      <span class="property-slide-count" aria-live="polite">1 / ${images.length}</span>` : "";
    const videoUrl = safeUrl(property.videoUrl);
    const externalUrl = safeUrl(property.externalUrl);
    const mediaLinks = [
      property.photoCount > 1 ? `<span>▣ ${property.photoCount} photos</span>` : "",
      videoUrl ? `<a href="${videoUrl}" target="_blank" rel="noopener">▶ Video tour</a>` : "",
      externalUrl ? `<a href="${externalUrl}" target="_blank" rel="noopener">↗ View details</a>` : ""
    ].filter(Boolean).join("");
    const specificationItems = [
      property.type !== "Land" && property.beds !== null && property.beds !== undefined ? `▣ ${escapeHtml(property.beds)} beds` : "",
      property.type !== "Land" && property.baths !== null && property.baths !== undefined ? `◒ ${escapeHtml(property.baths)} baths` : "",
      property.sizeLabel ? `⌗ ${escapeHtml(property.sizeLabel)}` : "",
      property.area && property.area !== "—" ? `⌑ ${escapeHtml(property.area)}` : "",
      property.propertyFacing ? `◈ ${escapeHtml(property.propertyFacing)}` : ""
    ].filter(Boolean);
    return `
      <article class="property-card" data-id="${property.id}">
        <div class="property-image">
          <div class="property-listing-track">${carouselSlides}</div>
          ${carouselControls}
          <span class="tag">${escapeHtml(property.status)}</span>
          <button class="favorite ${savedIds.includes(property.id) ? "active" : ""}" data-id="${property.id}" aria-label="Save ${escapeHtml(property.address)}" aria-pressed="${savedIds.includes(property.id)}">${savedIds.includes(property.id) ? "♥" : "♡"}</button>
        </div>
        <div class="property-content">
          <div class="property-price">${formatPrice(property)}</div>
          <p class="property-address"><a href="property.html?id=${property.id}">${escapeHtml(property.address)}</a></p>
          <p class="property-city">${escapeHtml(property.city)}</p>
          ${mediaLinks ? `<div class="property-media-links">${mediaLinks}</div>` : ""}
          <a class="property-detail-button" href="property.html?id=${property.id}">View details</a>
          ${specificationItems.length ? `<div class="property-specs">${specificationItems.map((item) => `<span>${item}</span>`).join("")}</div>` : ""}
        </div>
      </article>`;
  }).join("");
}

let propertyPage = 0;
let propertyListExpanded = false;
let currentPropertyList = [];

function propertyPageSize() {
  if (window.matchMedia("(max-width: 570px)").matches) return 1;
  if (window.matchMedia("(max-width: 820px)").matches) return 2;
  return 3;
}

function updatePropertyPage() {
  const track = elements.grid?.querySelector(".property-page-track");
  const pages = track?.children.length || 0;
  if (!track || pages < 1) return;
  propertyPage = (propertyPage + pages) % pages;
  track.style.transform = `translateX(-${propertyPage * 100}%)`;
  const pageStatus = document.querySelector("#propertyPageStatus");
  if (pageStatus) pageStatus.textContent = pages > 1 ? `Properties ${propertyPage + 1} of ${pages}` : "";
}

function renderProperties(list = properties) {
  currentPropertyList = list;
  const previous = document.querySelector("#propertyPrevious");
  const next = document.querySelector("#propertyNext");
  const pageStatus = document.querySelector("#propertyPageStatus");
  const viewAll = document.querySelector("#clearFilters");
  if (!list.length) {
    elements.grid.classList.remove("is-slider");
    elements.grid.innerHTML = `<div class="no-results"><h3>No properties found</h3><p>Try changing your search filters to see more available listings.</p></div>`;
    elements.resultsMessage.textContent = "No matching properties";
    if (previous) previous.hidden = true;
    if (next) next.hidden = true;
    if (pageStatus) pageStatus.textContent = "";
    return;
  }
  elements.resultsMessage.textContent = list.length === properties.length ? "" : `${list.length} matching ${list.length === 1 ? "property" : "properties"}`;
  const pageSize = propertyPageSize();
  const useSlider = !propertyListExpanded && list.length > pageSize;
  elements.grid.classList.toggle("is-slider", useSlider);
  if (useSlider) {
    const pages = [];
    for (let index = 0; index < list.length; index += pageSize) pages.push(list.slice(index, index + pageSize));
    propertyPage = Math.min(propertyPage, pages.length - 1);
    elements.grid.innerHTML = `<div class="property-page-track">${pages.map((page) => `<div class="property-page">${propertyCardsMarkup(page)}</div>`).join("")}</div>`;
    if (previous) previous.hidden = false;
    if (next) next.hidden = false;
    updatePropertyPage();
  } else {
    propertyPage = 0;
    elements.grid.innerHTML = propertyCardsMarkup(list);
    if (previous) previous.hidden = true;
    if (next) next.hidden = true;
    if (pageStatus) pageStatus.textContent = "";
  }
  if (viewAll) viewAll.innerHTML = propertyListExpanded ? 'Show property slider <span>→</span>' : 'View all homes <span>→</span>';
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
  propertyListExpanded = false;
  propertyPage = 0;
  const type = elements.type.value;
  const location = elements.location.value.trim().toLowerCase();
  const maxPrice = elements.price.value === "all" ? Infinity : Number(elements.price.value);
  renderProperties(properties.filter((property) =>
    (listingMode === "all" || property.listingType === listingMode || (listingMode === "rent" && property.status === "For rent") || (listingMode === "sale" && property.status === "For sale")) &&
    (type === "all" || property.type === type) &&
    (!location || `${property.address} ${property.city}`.toLowerCase().includes(location)) &&
    Number(property.searchPrice ?? property.price) <= maxPrice
  ));
}

function movePropertySlide(card, direction) {
  const track = card?.querySelector(".property-listing-track");
  const slides = card?.querySelectorAll(".property-listing-slide") || [];
  if (!track || slides.length < 2) return;
  const currentIndex = Number(track.dataset.index || 0);
  const nextIndex = (currentIndex + direction + slides.length) % slides.length;
  track.dataset.index = String(nextIndex);
  track.style.transform = `translateX(-${nextIndex * 100}%)`;
  card.querySelectorAll(".property-slide-dot").forEach((dot, index) => dot.classList.toggle("active", index === nextIndex));
  const count = card.querySelector(".property-slide-count");
  if (count) count.textContent = `${nextIndex + 1} / ${slides.length}`;
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
    propertyListExpanded = !propertyListExpanded;
    propertyPage = 0;
    renderProperties();
  });
}

document.querySelector("#propertyPrevious")?.addEventListener("click", () => {
  propertyPage -= 1;
  updatePropertyPage();
});
document.querySelector("#propertyNext")?.addEventListener("click", () => {
  propertyPage += 1;
  updatePropertyPage();
});

let propertyResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(propertyResizeTimer);
  propertyResizeTimer = setTimeout(() => renderProperties(currentPropertyList.length ? currentPropertyList : properties), 160);
});

if (elements.grid) {
  elements.grid.addEventListener("click", (event) => {
    const slideControl = event.target.closest(".property-slide-control");
    if (slideControl) {
      const card = slideControl.closest(".property-card");
      movePropertySlide(card, Number(slideControl.dataset.direction));
      return;
    }
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

  let swipeStartX = null;
  let swipeCard = null;
  elements.grid.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    swipeStartX = event.touches[0].clientX;
    swipeCard = event.target.closest(".property-card");
  }, { passive: true });
  elements.grid.addEventListener("touchend", (event) => {
    if (swipeStartX === null || !swipeCard || !event.changedTouches.length) return;
    const distance = event.changedTouches[0].clientX - swipeStartX;
    if (Math.abs(distance) > 45) movePropertySlide(swipeCard, distance < 0 ? 1 : -1);
    swipeStartX = null;
    swipeCard = null;
  }, { passive: true });
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

const accountAccess=document.querySelector("#accountAccess"),accountMessage=document.querySelector("#accountMessage");
function safeAuthReturn(){const destination=new URLSearchParams(location.search).get('return');return destination==='client-form.html'?destination:'';}
function setAuthView(view){if(!accountAccess)return;accountAccess.dataset.view=view;accountAccess.querySelectorAll(".account-form").forEach(form=>form.classList.toggle("active",form.dataset.authForm===view));accountAccess.querySelectorAll(".account-tab").forEach(tab=>tab.classList.toggle("active",tab.dataset.authView===view));if(accountMessage){accountMessage.textContent="";accountMessage.classList.remove("success");}accountAccess.querySelector(`.account-form[data-auth-form="${view}"] input`)?.focus();}
accountAccess?.addEventListener("click",event=>{const button=event.target.closest("[data-auth-view]");if(button)setAuthView(button.dataset.authView);});
document.querySelector("#clientSignupForm")?.addEventListener("submit",async event=>{event.preventDefault();const form=event.currentTarget,f=form.elements;if(f.password.value!==f.confirm_password.value){accountMessage.textContent="Passwords do not match.";return;}accountMessage.textContent="Creating account…";try{await apiRequest("client_signup",{full_name:f.full_name.value.trim(),email:f.email.value.trim(),phone:f.phone.value.trim(),password:f.password.value});form.reset();setAuthView("client-login");accountMessage.textContent="Account created. You can now sign in.";accountMessage.classList.add("success");}catch(error){accountMessage.textContent=error.message;}});
document.querySelector("#clientLoginForm")?.addEventListener("submit",async event=>{event.preventDefault();const form=event.currentTarget,f=form.elements;accountMessage.textContent="Signing in…";try{const result=await apiRequest("client_login",{login:f.login.value.trim(),password:f.password.value});localStorage.setItem("heeraClientSession",JSON.stringify(result.user));window.dispatchEvent(new CustomEvent("heera:auth-changed",{detail:{authenticated:true,role:"client",user:result.user}}));const destination=safeAuthReturn();if(destination){window.location.href=destination;return;}form.reset();closeLoginPopup();}catch(error){accountMessage.textContent=error.message;}});
document.querySelector("#adminLoginForm")?.addEventListener("submit",async event=>{event.preventDefault();const f=event.currentTarget.elements;accountMessage.textContent="Signing in…";try{const result=await apiRequest("login",{login:f.login.value.trim(),password:f.password.value});const user=result.user||{};localStorage.setItem("havenlyAdminSession",JSON.stringify({loggedIn:true,email:user.email||f.login.value,name:user.name||user.email||f.login.value}));window.location.href=safeAuthReturn()||"admin.html";}catch(error){accountMessage.textContent=error.message;}});
document.querySelector("#forgotPasswordForm")?.addEventListener("submit",async event=>{event.preventDefault();const f=event.currentTarget.elements;accountMessage.textContent="Sending request…";try{const result=await apiRequest("forgot_password",{identity:f.identity.value.trim()});accountMessage.textContent=result.message;accountMessage.classList.add("success");}catch(error){accountMessage.textContent=error.message;}});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && popupElements.modal && !popupElements.modal.hidden) {
    closeLoginPopup();
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
if (document.querySelector("#homeGallery")) {
  loadHomeGallery();
}
if (document.querySelector("#agentsGrid")) {
  loadAgents();
}
if (document.querySelector("#officeAddresses")) {
  loadPublicOfficeAddresses();
}
