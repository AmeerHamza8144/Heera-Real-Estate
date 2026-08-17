const adminState = { properties: [], projects: [], homeGallery: [], submissions: [] };
const welcomeScreen = document.querySelector("#welcomeScreen");
const loginModal = document.querySelector("#loginModal");
const dashboard = document.querySelector("#dashboard");
const loginError = document.querySelector("#loginError");
const openLoginButton = document.querySelector("#openLoginButton");
const closeLoginModal = document.querySelector("#closeLoginModal");
const loginBackdrop = document.querySelector("#loginBackdrop");
const propertyForm = document.querySelector("#propertyForm");
const propertyMessage = document.querySelector("#propertyMessage");
const uploadStatus = document.querySelector("#uploadStatus");
const adminSessionKey = "havenlyAdminSession";

function getStoredAdminSession() {
  try {
    return JSON.parse(localStorage.getItem(adminSessionKey) || "null");
  } catch {
    return null;
  }
}

function saveAdminSession(user) {
  localStorage.setItem(adminSessionKey, JSON.stringify({
    loggedIn: true,
    email: user?.email || "",
    name: user?.name || user?.email || ""
  }));
}

function clearAdminSession() {
  localStorage.removeItem(adminSessionKey);
}

function showWelcomeScreen() {
  if (dashboard) dashboard.hidden = true;
  if (welcomeScreen) {
    welcomeScreen.hidden = false;
    return;
  }
  showLoginModal();
}

function showLoginModal() {
  if (!loginModal) return;
  if (loginError) loginError.textContent = "";
  loginModal.hidden = false;
  requestAnimationFrame(() => loginModal.classList.add("open"));
  const emailInput = document.querySelector("#loginForm")?.elements?.email;
  if (emailInput) emailInput.focus();
}

function hideLoginModal() {
  if (!loginModal) return;
  loginModal.classList.remove("open");
  setTimeout(() => {
    if (!loginModal.classList.contains("open")) {
      loginModal.hidden = true;
    }
  }, 200);
}

function showDashboard(user) {
  hideLoginModal();
  if (welcomeScreen) welcomeScreen.hidden = true;
  if (dashboard) dashboard.hidden = false;
  const adminName = document.querySelector("#adminName");
  if (adminName) adminName.textContent = user?.name || user?.email || "Admin";
  saveAdminSession(user);
  loadProperties();
  loadProjects();
  loadHomeGallery();
  loadAdminPopups();
  loadAgents();
  loadSubmissions();
}

async function loadSubmissions() {
  try {
    adminState.submissions = await api('admin_submissions');
    renderSubmissions();
  } catch (error) {
    const message = document.querySelector('#submissionMessage');
    if (message) message.textContent = error.message;
  }
}

function renderSubmissions() {
  const list = document.querySelector('#adminSubmissionList');
  const pending = adminState.submissions.filter(item => item.status === 'pending').length;
  document.querySelector('#submissionCount').textContent = `${adminState.submissions.length} submission${adminState.submissions.length === 1 ? '' : 's'}`;
  document.querySelector('#pendingSubmissionBadge').textContent = pending || '';
  if (!adminState.submissions.length) { list.innerHTML = '<p class="empty-list">No client properties have been submitted yet.</p>'; return; }
  list.innerHTML = adminState.submissions.map(item => `<article class="admin-property">
    <img src="${escapeHtml(item.media?.[0] || 'images/home-logo.jpg')}" alt="">
    <div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.seller_name)} · ${escapeHtml(item.seller_phone)}</p><strong>${escapeHtml(item.city)} · ${escapeHtml(item.size_label || item.property_type)}</strong><br><span class="submission-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></div>
    <div class="admin-row-actions"><button type="button" class="review-submission" data-id="${item.submission_id}">${item.status === 'pending' ? 'Review' : 'View'}</button></div>
  </article>`).join('');
}

function openSubmission(item) {
  const form = document.querySelector('#submissionForm');
  const fields = form.elements;
  ['submission_id','seller_name','seller_phone','seller_email','seller_cnic','listing_type','property_type','title','address_line1','city','state_region','size_label','property_facing','price_pkr','bedrooms','bathrooms','area_sqft','description','admin_notes','status'].forEach(name => { fields[name].value = item[name] ?? ''; });
  document.querySelector('#submissionEditorTitle').textContent = item.title;
  document.querySelector('#submissionEmptyEditor').hidden = true;
  form.hidden = false;
  document.querySelector('#submissionImages').innerHTML = (item.media || []).map(path => `<a href="${escapeHtml(path)}" target="_blank" rel="noopener"><img src="${escapeHtml(path)}" alt="Client property"></a>`).join('');
  const locked = item.status === 'approved';
  [...form.elements].forEach(field => { if (!['submission_id'].includes(field.name)) field.disabled = locked; });
  document.querySelector('#approveSubmission').disabled = item.status !== 'pending';
  document.querySelector('#rejectSubmission').disabled = item.status !== 'pending';
  document.querySelector('#submissionMessage').textContent = locked ? `Published as property #${item.approved_property_id}. Edit it from the Properties tab.` : '';
  form.scrollIntoView({behavior:'smooth',block:'start'});
}

function submissionBody(statusOverride = null) {
  const fields = document.querySelector('#submissionForm').elements;
  const body = {};
  ['submission_id','seller_name','seller_phone','seller_email','seller_cnic','listing_type','property_type','title','address_line1','city','state_region','size_label','property_facing','price_pkr','bedrooms','bathrooms','area_sqft','description','admin_notes','status'].forEach(name => { body[name] = fields[name]?.value?.trim?.() ?? fields[name]?.value ?? ''; });
  if (statusOverride) body.status = statusOverride;
  return body;
}

document.querySelector('#adminSubmissionList').addEventListener('click', event => {
  if (!event.target.classList.contains('review-submission')) return;
  const item = adminState.submissions.find(entry => Number(entry.submission_id) === Number(event.target.dataset.id));
  if (item) openSubmission(item);
});

document.querySelector('#submissionForm').addEventListener('submit', async event => {
  event.preventDefault(); const message = document.querySelector('#submissionMessage'); message.textContent = 'Saving edits…';
  try { await api('save_submission', submissionBody()); message.textContent = 'Submission edits saved.'; await loadSubmissions(); }
  catch (error) { message.textContent = error.message; }
});

document.querySelector('#rejectSubmission').addEventListener('click', async () => {
  if (!confirm('Reject this client property? It will remain private.')) return;
  const message = document.querySelector('#submissionMessage');
  try { await api('save_submission', submissionBody('rejected')); message.textContent = 'Submission rejected.'; await loadSubmissions(); const item=adminState.submissions.find(entry=>Number(entry.submission_id)===Number(document.querySelector('#submissionForm').elements.submission_id.value)); if(item) openSubmission(item); }
  catch (error) { message.textContent = error.message; }
});

document.querySelector('#approveSubmission').addEventListener('click', async () => {
  if (!confirm('Approve and publish this property on the main website?')) return;
  const message = document.querySelector('#submissionMessage'); const body = submissionBody('pending'); message.textContent = 'Publishing property…';
  try { await api('save_submission', body); const result = await api('approve_submission', {submission_id: body.submission_id}); message.textContent = `Approved and published as property #${result.property_id}.`; await Promise.all([loadSubmissions(),loadProperties()]); const item=adminState.submissions.find(entry=>Number(entry.submission_id)===Number(body.submission_id)); if(item) openSubmission(item); }
  catch (error) { message.textContent = error.message; }
});

async function api(action, data = null, isUpload = false) {
  const options = { method: data ? "POST" : "GET", headers: { Accept: "application/json" }, credentials: 'same-origin' };
  if (data && !isUpload) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }
  if (isUpload) options.body = data;
  const response = await fetch(`api.php?action=${encodeURIComponent(action)}`, options);
  const result = await response.json().catch(() => ({ error: "The server returned an invalid response." }));
  if (!response.ok) throw new Error(result.error || "Something went wrong.");
  return result;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function mediaLines(property, type) {
  return (property.media || []).filter((media) => media.media_type === type).map((media) => media.file_path).join("\n");
}

async function loadProperties() {
  try {
    const properties = await api("admin_properties");
    adminState.properties = properties;
    renderPropertyList();
  } catch (error) {
    propertyMessage.textContent = error.message;
    propertyMessage.classList.add("error");
  }
}

function formatPricePkr(property) {
  if (property.price_pkr) {
    return "PKR " + Number(property.price_pkr).toLocaleString();
  }
  if (property.price) {
    return "$" + Number(property.price).toLocaleString();
  }
  return "—";
}

function renderPropertyList() {
  const container = document.querySelector("#adminPropertyList");
  document.querySelector("#listingCount").textContent = `${adminState.properties.length} listing${adminState.properties.length === 1 ? "" : "s"}`;
  if (!adminState.properties.length) {
    container.innerHTML = '<p class="empty-list">No properties yet. Add your first one using the form.</p>';
    return;
  }
  container.innerHTML = adminState.properties.map((property) => {
    const image = (property.media || []).find((item) => item.media_type === "image")?.file_path || "https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=300&q=80";
    const priceDisplay = formatPricePkr(property);
    return `<article class="admin-property">
      <img src="${escapeHtml(image)}" alt="" />
      <div><h3>${escapeHtml(property.title)}</h3><p>${escapeHtml(property.city)} · ${escapeHtml(property.listing_type)}</p><strong>${escapeHtml(priceDisplay)}</strong></div>
      <div class="admin-row-actions"><button type="button" class="edit-listing" data-id="${property.property_id}">Edit</button><button type="button" class="delete-listing" data-id="${property.property_id}">Delete</button></div>
    </article>`;
  }).join("");
}

function updateBedsBathsVisibility() {
  const typeSelect = document.querySelector("#propertyTypeSelect");
  const isLand = typeSelect && typeSelect.value === "Land";
  const bedsField = document.querySelector(".beds-field");
  const bathsField = document.querySelector(".baths-field");
  if (bedsField) bedsField.classList.toggle("hidden", isLand);
  if (bathsField) bathsField.classList.toggle("hidden", isLand);
}

// Payment plans removed from the admin UI and submission.

function populateEditor(property) {
  const fields = propertyForm.elements;
  ["property_id", "title", "price", "listing_type", "property_type", "status", "address_line1", "city", "state_region", "postal_code", "bedrooms", "bathrooms", "area_sqft", "description", "size_label", "property_facing", "price_pkr", "price_per_marla"].forEach((field) => {
    fields[field].value = property[field] ?? "";
  });
  fields.images.value = mediaLines(property, "image");
  fields.videos.value = mediaLines(property, "video");
  fields.links.value = mediaLines(property, "link");
  document.querySelector("#editorEyebrow").textContent = "Editing listing";
  document.querySelector("#editorTitle").textContent = property.title;
  document.querySelector("#saveButton").innerHTML = 'Save changes <span>→</span>';
  document.querySelector("#cancelEdit").hidden = false;
  propertyMessage.textContent = "";
  updateBedsBathsVisibility();
  // Payment plans removed
  document.querySelector(".editor-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

// first resetEditor removed; keep the later definition

function resetEditor() {
  propertyForm.reset();
  propertyForm.elements.property_id.value = "";
  document.querySelector("#editorEyebrow").textContent = "New listing";
  document.querySelector("#editorTitle").textContent = "Add a property";
  document.querySelector("#saveButton").innerHTML = 'Publish listing <span>→</span>';
  document.querySelector("#cancelEdit").hidden = true;
  propertyMessage.textContent = "";
  propertyMessage.classList.remove("error");
}

function splitUrls(value) {
  return value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
}

// Login form removed from admin.html — authentication happens on the main site page.

if (openLoginButton) {
  openLoginButton.addEventListener("click", showLoginModal);
}
if (closeLoginModal) {
  closeLoginModal.addEventListener("click", hideLoginModal);
}
if (loginBackdrop) {
  loginBackdrop.addEventListener("click", hideLoginModal);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && loginModal && !loginModal.hidden) {
    hideLoginModal();
  }
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  try { await api("logout", {}); } catch (error) { /* the UI can still end the local session */ }
  clearAdminSession();
  showWelcomeScreen();
  resetEditor();
});

document.querySelector("#adminPropertyList").addEventListener("click", async (event) => {
  const id = Number(event.target.dataset.id);
  if (!id) return;
  const property = adminState.properties.find((item) => Number(item.property_id) === id);
  if (event.target.classList.contains("edit-listing") && property) populateEditor(property);
  if (event.target.classList.contains("delete-listing") && property) {
    if (!window.confirm(`Delete “${property.title}”? This cannot be undone.`)) return;
    try {
      await api("delete_property", { property_id: id });
      if (Number(propertyForm.elements.property_id.value) === id) resetEditor();
      await loadProperties();
    } catch (error) {
      window.alert(error.message);
    }
  }
});

document.querySelector("#cancelEdit").addEventListener("click", resetEditor);

// Verify session with server on load. If not authenticated, redirect to main page where login resides.
;(async function initAdmin() {
  try {
    const session = await api('session');
    if (session && session.authenticated && session.user) {
      showDashboard(session.user);
    } else {
      // not authenticated — send user to main page where login UI is available
      window.location.href = 'index.html';
      return;
    }
  } catch (err) {
    const msgEl = document.querySelector('#propertyMessage');
    if (msgEl) msgEl.textContent = 'Unable to verify session: ' + (err.message || err);
    return;
  }
})();

propertyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fields = propertyForm.elements;
  const body = {};
  ["property_id", "title", "price", "listing_type", "property_type", "status", "address_line1", "city", "state_region", "postal_code", "bedrooms", "bathrooms", "area_sqft", "description", "size_label", "property_facing", "price_pkr", "price_per_marla"].forEach((field) => {
    body[field] = fields[field] ? fields[field].value.trim() : "";
  });
  body.media = { images: splitUrls(fields.images.value), videos: splitUrls(fields.videos.value), links: splitUrls(fields.links.value) };
  propertyMessage.classList.remove("error");
  propertyMessage.textContent = "Saving listing…";
  try {
    const result = await api("save_property", body);
    propertyMessage.textContent = "Listing saved and visible on the home page.";
    await loadProperties();
    if (!body.property_id) {
      resetEditor();
      propertyMessage.textContent = "Listing published and visible on the home page.";
    } else {
      const updated = adminState.properties.find((property) => Number(property.property_id) === Number(result.property_id));
      if (updated) populateEditor(updated);
    }
  } catch (error) {
    propertyMessage.textContent = error.message;
    propertyMessage.classList.add("error");
  }
});

document.querySelector("#mediaUpload").addEventListener("change", async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;
  const formData = new FormData();
  files.forEach((file) => formData.append("files[]", file));
  uploadStatus.textContent = `Uploading ${files.length} file${files.length === 1 ? "" : "s"}…`;
  try {
    const result = await api("upload", formData, true);
    result.files.forEach((file) => {
      const field = file.type === "image" ? propertyForm.elements.images : propertyForm.elements.videos;
      field.value = [field.value.trim(), file.url].filter(Boolean).join("\n");
    });
    uploadStatus.textContent = "Upload complete. Save the listing to publish the media.";
  } catch (error) {
    uploadStatus.textContent = error.message;
  }
  event.target.value = "";
});

async function loadProjects() {
  try {
    adminState.projects = await api("admin_projects");
    renderProjectList();
  } catch (error) {
    document.querySelector("#projectMessage").textContent = error.message;
    document.querySelector("#projectMessage").classList.add("error");
  }
}

function projectMediaLines(project, type) {
  return (project.media || []).filter((media) => media.media_type === type).map((media) => media.file_path).join("\n");
}

// Project payment plans UI
function createProjectPlanRow(planData) {
  const container = document.querySelector("#projectPaymentPlansContainer");
  const index = container.children.length;
  const row = document.createElement("div");
  row.className = "plan-row";
  row.dataset.index = index;
  row.innerHTML = `
    <div class="plan-row-header">
      <strong>Plan ${index + 1}</strong>
      <button type="button" class="remove-plan-btn" title="Remove this plan">×</button>
    </div>
    <div class="plan-fields">
      <label>Size / Type<input name="project_plan_size_label_${index}" value="${escapeHtml(planData?.size_label || "")}" placeholder="3 Marla" /></label>
      <label>Booking<input name="project_plan_booking_${index}" type="number" min="0" value="${planData?.booking_amount || ""}" placeholder="1000000" /></label>
      <label>Monthly Installment<input name="project_plan_monthly_${index}" type="number" min="0" value="${planData?.monthly_installment || ""}" placeholder="40000" /></label>
      <label>Half Yearly Count<input name="project_plan_half_count_${index}" type="number" min="0" value="${planData?.half_yearly_count || ""}" placeholder="5" /></label>
      <label>Half Yearly Installment<input name="project_plan_half_amount_${index}" type="number" min="0" value="${planData?.half_yearly_installment || ""}" placeholder="150000" /></label>
      <label>On Possession<input name="project_plan_possession_${index}" type="number" min="0" value="${planData?.on_possession || ""}" placeholder="350000" /></label>
      <label>Balloting<input name="project_plan_balloting_${index}" value="${escapeHtml(planData?.balloting || "")}" placeholder="Q1 2027 or Yes/No" /></label>
      <label>Total Price<input name="project_plan_total_${index}" type="number" min="0" value="${planData?.total_price || ""}" placeholder="3300000" /></label>
    </div>`;
  const removeBtn = row.querySelector(".remove-plan-btn");
  removeBtn.addEventListener("click", () => { row.remove(); reindexProjectPlanRows(); });
  container.appendChild(row);
}

function reindexProjectPlanRows() {
  const container = document.querySelector("#projectPaymentPlansContainer");
  const rows = container.querySelectorAll(".plan-row");
  rows.forEach((row, i) => {
    row.dataset.index = i;
    const header = row.querySelector(".plan-row-header strong");
    if (header) header.textContent = `Plan ${i + 1}`;
    const inputs = row.querySelectorAll("input");
    inputs.forEach((input) => { input.name = input.name.replace(/_\d+$/, `_${i}`); });
  });
}

function getProjectPaymentPlansData() {
  const enabled = document.querySelector("#enableProjectPaymentPlans")?.checked;
  if (!enabled) return [];
  const container = document.querySelector("#projectPaymentPlansContainer");
  const rows = container.querySelectorAll(".plan-row");
  const plans = [];
  rows.forEach((row, i) => {
    const sizeLabel = row.querySelector(`[name="project_plan_size_label_${i}"]`)?.value?.trim() || "";
    if (!sizeLabel) return;
    plans.push({
      size_label: sizeLabel,
      booking_amount: row.querySelector(`[name="project_plan_booking_${i}"]`)?.value?.trim() || "",
      monthly_installment: row.querySelector(`[name="project_plan_monthly_${i}"]`)?.value?.trim() || "",
      half_yearly_count: row.querySelector(`[name="project_plan_half_count_${i}"]`)?.value?.trim() || "",
      half_yearly_installment: row.querySelector(`[name="project_plan_half_amount_${i}"]`)?.value?.trim() || "",
      on_possession: row.querySelector(`[name="project_plan_possession_${i}"]`)?.value?.trim() || "",
      balloting: row.querySelector(`[name="project_plan_balloting_${i}"]`)?.value?.trim() || "",
      total_price: row.querySelector(`[name="project_plan_total_${i}"]`)?.value?.trim() || ""
    });
  });
  return plans;
}


function renderProjectList() {
  const container = document.querySelector("#adminProjectList");
  document.querySelector("#projectCount").textContent = `${adminState.projects.length} project${adminState.projects.length === 1 ? "" : "s"}`;
  if (!adminState.projects.length) {
    container.innerHTML = '<p class="empty-list">No projects yet. Add one using the form.</p>';
    return;
  }
  container.innerHTML = adminState.projects.map((project) => {
    const image = project.hero_image_url || (project.media || []).find((media) => media.media_type === "gallery")?.file_path || "https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=300&q=80";
    return `<article class="admin-property">
      <img src="${escapeHtml(image)}" alt="" />
      <div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.location)} · ${escapeHtml(project.status)}</p><strong>${escapeHtml(project.category)}</strong></div>
      <div class="admin-row-actions"><button type="button" class="edit-project" data-id="${project.project_id}">Edit</button><button type="button" class="delete-project" data-id="${project.project_id}">Delete</button></div>
    </article>`;
  }).join("");
}

function populateProjectEditor(project) {
  const fields = document.querySelector("#projectForm").elements;
  ["project_id", "title", "category", "location", "status", "hero_image_url", "headline", "description"].forEach((field) => {
    fields[field].value = project[field] ?? "";
  });
  fields.gallery_images.value = projectMediaLines(project, "gallery");
  fields.plans.value = projectMediaLines(project, "plan");
  document.querySelector("#projectEditorEyebrow").textContent = "Editing project";
  document.querySelector("#projectEditorTitle").textContent = project.title;
  document.querySelector("#saveProjectButton").innerHTML = 'Save changes <span>→</span>';
  document.querySelector("#cancelProjectEdit").hidden = false;
  document.querySelector("#projectMessage").textContent = "";
  document.querySelector("#projectsWorkspace .editor-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  // populate optional payment plans
  const enableCheckbox = document.querySelector("#enableProjectPaymentPlans");
  const container = document.querySelector("#projectPaymentPlansContainer");
  container.innerHTML = "";
  if (project.payment_plans && Array.isArray(project.payment_plans) && project.payment_plans.length) {
    enableCheckbox.checked = true;
    document.querySelector("#projectPaymentPlansFieldset").hidden = false;
    project.payment_plans.forEach((plan) => createProjectPlanRow(plan));
  } else {
    enableCheckbox.checked = false;
    document.querySelector("#projectPaymentPlansFieldset").hidden = true;
  }
}

function resetProjectEditor() {
  const form = document.querySelector("#projectForm");
  form.reset();
  form.elements.project_id.value = "";
  document.querySelector("#projectEditorEyebrow").textContent = "New project";
  document.querySelector("#projectEditorTitle").textContent = "Add a project";
  document.querySelector("#saveProjectButton").innerHTML = 'Publish project <span>→</span>';
  document.querySelector("#cancelProjectEdit").hidden = true;
  document.querySelector("#projectMessage").textContent = "";
  document.querySelector("#projectMessage").classList.remove("error");
  // reset payment plans UI
  document.querySelector("#projectPaymentPlansContainer").innerHTML = "";
  document.querySelector("#enableProjectPaymentPlans").checked = false;
  document.querySelector("#projectPaymentPlansFieldset").hidden = true;
}

document.querySelector("#adminProjectList").addEventListener("click", async (event) => {
  const id = Number(event.target.dataset.id);
  if (!id) return;
  const project = adminState.projects.find((item) => Number(item.project_id) === id);
  if (event.target.classList.contains("edit-project") && project) populateProjectEditor(project);
  if (event.target.classList.contains("delete-project") && project) {
    if (!window.confirm(`Delete “${project.title}” and its plans/gallery? This cannot be undone.`)) return;
    try {
      await api("delete_project", { project_id: id });
      if (Number(document.querySelector("#projectForm").elements.project_id.value) === id) resetProjectEditor();
      await loadProjects();
    } catch (error) { window.alert(error.message); }
  }
});

document.querySelector("#cancelProjectEdit").addEventListener("click", resetProjectEditor);

// Toggle project payment plans visibility
document.querySelector("#enableProjectPaymentPlans").addEventListener("change", (event) => {
  document.querySelector("#projectPaymentPlansFieldset").hidden = !event.target.checked;
});

document.querySelector("#addProjectPlanRow").addEventListener("click", () => createProjectPlanRow(null));

document.querySelector("#projectForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  const body = {};
  ["project_id", "title", "category", "location", "status", "hero_image_url", "headline", "description"].forEach((field) => { body[field] = fields[field].value.trim(); });
  body.media = { gallery: splitUrls(fields.gallery_images.value), plans: splitUrls(fields.plans.value) };
  // include optional payment plans when enabled
  body.payment_plans = getProjectPaymentPlansData();
  const message = document.querySelector("#projectMessage");
  message.classList.remove("error");
  message.textContent = "Saving project…";
  try {
    const result = await api("save_project", body);
    await loadProjects();
    if (!body.project_id) {
      resetProjectEditor();
      message.textContent = "Project published. It is now in the Projects menu.";
    } else {
      const updated = adminState.projects.find((project) => Number(project.project_id) === Number(result.project_id));
      if (updated) populateProjectEditor(updated);
      message.textContent = "Project details saved.";
    }
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
});

document.querySelector("#projectMediaUpload").addEventListener("change", async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;
  const data = new FormData();
  files.forEach((file) => data.append("files[]", file));
  const status = document.querySelector("#projectUploadStatus");
  status.textContent = "Uploading project images…";
  try {
    const result = await api("upload", data, true);
    const target = document.querySelector("#projectForm").elements[document.querySelector("#projectUploadTarget").value];
    target.value = [target.value.trim(), ...result.files.filter((file) => file.type === "image").map((file) => file.url)].filter(Boolean).join("\n");
    status.textContent = "Upload complete. Save the project to publish the images.";
  } catch (error) { status.textContent = error.message; }
  event.target.value = "";
});

async function loadHomeGallery() {
  try {
    adminState.homeGallery = await api("admin_home_gallery");
    renderAdminHomeGallery();
  } catch (error) { document.querySelector("#homeGalleryStatus").textContent = error.message; }
}

// Admin popup management
async function loadAdminPopups() {
  try {
    const popups = await api('admin_popups');
    adminState.popups = popups;
    renderAdminPopups();
  } catch (error) { document.querySelector('#homePopupMessage').textContent = error.message; }
}

function renderAdminPopups() {
  const container = document.querySelector('#adminPopupList');
  const popups = adminState.popups || [];
  if (!popups.length) { container.innerHTML = '<p class="empty-list">No popups yet. Use the form above to add one.</p>'; return; }
  container.innerHTML = popups.map((p) => `<article class="admin-property"><img src="${escapeHtml(p.image_url || 'https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=300&q=80')}" alt="" /><div><h3>${escapeHtml(p.headline || 'Popup')}</h3><p>${escapeHtml(p.link_url || '')}</p><small style="color:${p.is_published ? 'green' : 'gray'}">${p.is_published ? '● Published' : '○ Draft'}</small></div><div class="admin-row-actions"><button type="button" class="edit-popup" data-id="${p.popup_id}">Edit</button><button type="button" class="delete-popup" data-id="${p.popup_id}">Delete</button></div></article>`).join('');
}

function populateHomePopupEditor(popup) {
  const form = document.querySelector('#homePopupForm');
  form.elements.popup_id.value = popup.popup_id || '';
  form.elements.image_url.value = popup.image_url || '';
  form.elements.link_url.value = popup.link_url || '';
  form.elements.headline.value = popup.headline || '';
  form.elements.html_content.value = popup.html_content || '';
  form.elements.is_published.checked = !!popup.is_published;
  document.querySelector('#homePopupMessage').textContent = '';
}

document.querySelector('#adminPopupList').addEventListener('click', async (event) => {
  const id = Number(event.target.dataset.id);
  if (!id) return;
  if (event.target.classList.contains('edit-popup')) {
    const popup = (adminState.popups || []).find((p) => Number(p.popup_id) === id);
    if (popup) populateHomePopupEditor(popup);
  }
  if (event.target.classList.contains('delete-popup')) {
    if (!window.confirm('Delete this popup?')) return;
    try {
      await api('delete_popup', { popup_id: id });
      await loadAdminPopups();
    } catch (error) { window.alert(error.message); }
  }
});

document.querySelector('#homePopupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  const body = {
    popup_id: fields.popup_id.value.trim(),
    image_url: fields.image_url.value.trim(),
    link_url: fields.link_url.value.trim(),
    headline: fields.headline.value.trim(),
    html_content: fields.html_content.value.trim(),
    is_published: fields.is_published.checked ? 1 : 0
  };
  const msg = document.querySelector('#homePopupMessage');
  msg.classList.remove('error');
  msg.textContent = 'Saving…';
  try {
    await api('save_popup', body);
    msg.textContent = 'Popup saved.';
    await loadAdminPopups();
    event.currentTarget.reset();
  } catch (error) { msg.textContent = error.message; msg.classList.add('error'); }
});

document.querySelector('#popupImageUpload').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;
  const data = new FormData();
  files.forEach((file) => data.append('files[]', file));
  const msg = document.querySelector('#homePopupMessage');
  msg.classList.remove('error');
  msg.textContent = 'Uploading popup image…';
  try {
    const result = await api('upload', data, true);
    const file = result.files && result.files[0];
    if (file && file.url) {
      document.querySelector('#homePopupForm').elements.image_url.value = file.url;
      msg.textContent = 'Image uploaded. Save the popup to publish.';
    }
  } catch (error) { msg.textContent = error.message; msg.classList.add('error'); }
event.target.value = '';
});

async function loadAgents() {
  try {
    adminState.agents = await api("admin_agents");
    renderAgentList();
  } catch (error) {
    document.querySelector("#agentMessage").textContent = error.message || "Could not load agents";
  }
}

function renderAgentList() {
  const container = document.querySelector("#adminAgentList");
  document.querySelector("#agentCount").textContent = `${(adminState.agents || []).length} agent${(adminState.agents || []).length === 1 ? "" : "s"}`;
  if (!adminState.agents || !adminState.agents.length) {
    container.innerHTML = '<p class="empty-list">No agents yet. Add one using the form.</p>';
    return;
  }
  container.innerHTML = adminState.agents.map((agent) => {
    const image = agent.photo_url || (agent.media || []).find((m) => m.media_type === "image")?.file_path || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80";
    return `<article class="admin-property">
      <img src="${escapeHtml(image)}" alt="" />
      <div><h3>${escapeHtml(agent.name)}</h3><p>${escapeHtml(agent.title || "Agent")}</p><small>${escapeHtml(agent.email || "")}</small></div>
      <div class="admin-row-actions"><button type="button" class="edit-agent" data-id="${agent.agent_id}">Edit</button><button type="button" class="delete-agent" data-id="${agent.agent_id}">Delete</button></div>
    </article>`;
  }).join("");
}

function populateAgentEditor(agent) {
  const fields = document.querySelector("#agentForm").elements;
  ["agent_id", "name", "title", "email", "phone", "photo_url", "bio"].forEach((field) => { fields[field].value = agent[field] ?? ""; });
  document.querySelector("#agentEditorTitle").textContent = `Edit: ${agent.name}`;
  document.querySelector("#saveAgentButton").innerHTML = 'Save changes <span>→</span>';
  document.querySelector("#cancelAgentEdit").hidden = false;
  document.querySelector("#agentMessage").textContent = "";
  document.querySelector("#agentForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetAgentEditor() {
  const form = document.querySelector("#agentForm");
  form.reset();
  form.elements.agent_id.value = "";
  document.querySelector("#agentEditorTitle").textContent = "Add an agent";
  document.querySelector("#saveAgentButton").innerHTML = 'Save agent <span>→</span>';
  document.querySelector("#cancelAgentEdit").hidden = true;
  document.querySelector("#agentMessage").textContent = "";
}

document.querySelector("#adminAgentList").addEventListener("click", async (event) => {
  const id = Number(event.target.dataset.id);
  if (!id) return;
  const agent = (adminState.agents || []).find((a) => Number(a.agent_id) === id);
  if (event.target.classList.contains("edit-agent") && agent) populateAgentEditor(agent);
  if (event.target.classList.contains("delete-agent") && agent) {
    if (!window.confirm(`Delete “${agent.name}”? This cannot be undone.`)) return;
    try { await api("delete_agent", { agent_id: id }); await loadAgents(); } catch (error) { window.alert(error.message); }
  }
});

document.querySelector("#cancelAgentEdit").addEventListener("click", resetAgentEditor);

document.querySelector("#agentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  const body = {
    agent_id: fields.agent_id.value.trim(),
    name: fields.name.value.trim(),
    title: fields.title.value.trim(),
    email: fields.email.value.trim(),
    phone: fields.phone.value.trim(),
    photo_url: fields.photo_url.value.trim(),
    bio: fields.bio.value.trim()
  };
  const message = document.querySelector("#agentMessage");
  message.classList.remove("error");
  message.textContent = "Saving agent…";
  try {
    await api("save_agent", body);
    await loadAgents();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("agents:updated"));
    }
    resetAgentEditor();
    message.textContent = "Agent saved.";
  } catch (error) { message.textContent = error.message; message.classList.add("error"); }
});

document.querySelector("#agentPhotoUpload").addEventListener("change", async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;
  const data = new FormData();
  files.forEach((file) => data.append("files[]", file));
  const status = document.querySelector("#agentMessage");
  status.textContent = "Uploading photo…";
  try {
    const result = await api("upload", data, true);
    const file = result.files && result.files[0];
    if (file && file.url) document.querySelector("#agentForm").elements.photo_url.value = file.url;
    status.textContent = "Photo uploaded. Save the agent to publish.";
  } catch (error) { status.textContent = error.message; }
  event.target.value = "";
});

function renderAdminHomeGallery() {
  const container = document.querySelector("#adminHomeGallery");
  if (!adminState.homeGallery.length) { container.innerHTML = '<p class="empty-list">No gallery images yet. Add one above.</p>'; return; }
  container.innerHTML = adminState.homeGallery.map((item) => `<article class="admin-gallery-item"><img src="${escapeHtml(item.image_url)}" alt="" /><button data-id="${item.gallery_id}" type="button">Delete</button><p>${escapeHtml(item.caption || "No caption")}</p></article>`).join("");
}

async function addHomeGalleryImage(imageUrl, caption = "") {
  await api("save_home_gallery", { image_url: imageUrl, caption });
  await loadHomeGallery();
}

document.querySelector("#homeGalleryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector("#homeGalleryStatus");
  try {
    await addHomeGalleryImage(form.elements.image_url.value.trim(), form.elements.caption.value.trim());
    form.reset();
    status.textContent = "Image added to the home page gallery.";
  } catch (error) { status.textContent = error.message; }
});

document.querySelector("#homeGalleryUpload").addEventListener("change", async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;
  const data = new FormData();
  files.forEach((file) => data.append("files[]", file));
  const status = document.querySelector("#homeGalleryStatus");
  status.textContent = "Uploading gallery images…";
  try {
    const result = await api("upload", data, true);
    await Promise.all(result.files.filter((file) => file.type === "image").map((file) => addHomeGalleryImage(file.url)));
    status.textContent = "Gallery images added to the home page.";
  } catch (error) { status.textContent = error.message; }
  event.target.value = "";
});

document.querySelector("#adminHomeGallery").addEventListener("click", async (event) => {
  const id = Number(event.target.dataset.id);
  if (!id || !window.confirm("Remove this image from the home page gallery?")) return;
  try { await api("delete_home_gallery", { gallery_id: id }); await loadHomeGallery(); }
  catch (error) { window.alert(error.message); }
});

document.querySelectorAll(".admin-tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".admin-tab").forEach((item) => { item.classList.toggle("active", item === tab); item.setAttribute("aria-selected", item === tab); });
  document.querySelectorAll(".admin-workspace").forEach((workspace) => { workspace.hidden = workspace.id !== tab.dataset.workspace; });
  document.querySelector(".dashboard-topbar h1").textContent = tab.textContent === "Home gallery" ? "Home gallery" : `Your ${tab.textContent.toLowerCase()}`;
}));

(async function checkSession() {
  try {
    const result = await api("session");
    if (result.authenticated) {
      showDashboard(result.user);
    } else {
      showLoginModal();
    }
  } catch (error) {
    showLoginModal();
    if (loginError) loginError.textContent = "Set up MySQL and the PHP API before signing in. See README.md.";
  }
})();
