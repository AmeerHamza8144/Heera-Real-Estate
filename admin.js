const adminState = { properties: [], projects: [], homeGallery: [], submissions: [], officeAddresses: [], loginUsers: [], digitalMaps: [], chatMessages: [] };
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

function setAdminSubview(workspaceId, subview) {
  if (!subview || !["list", "form"].includes(subview)) return;
  const workspace = document.getElementById(workspaceId);
  if (!workspace || !workspace.hasAttribute("data-subview")) return;
  workspace.dataset.subview = subview;
  document.querySelectorAll(`.admin-submenu button[data-workspace="${workspaceId}"][data-subview]`).forEach((button) => {
    button.classList.toggle("active", button.dataset.subview === subview);
  });
}

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
  loadOfficeAddresses();
  loadLoginUsers();
  loadChatMessages();
  loadSubmissions();
  loadDigitalMaps();
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
  ['submission_id','seller_name','seller_phone','seller_email','seller_cnic','listing_type','property_type','title','address_line1','city','state_region','block_name','size_label','property_facing','price_pkr','bedrooms','bathrooms','area_sqft','description','admin_notes','status','publish_start_date','publish_end_date'].forEach(name => { fields[name].value = item[name] ?? ''; });
  document.querySelector('#submissionEditorTitle').textContent = item.title;
  document.querySelector('#submissionEmptyEditor').hidden = true;
  form.hidden = false;
  document.querySelector('#submissionImages').innerHTML = (item.media || []).map(path => `<a href="${escapeHtml(path)}" target="_blank" rel="noopener"><img src="${escapeHtml(path)}" alt="Client property"></a>`).join('');
  document.querySelector('#submissionVideo').innerHTML=item.video_path?`<video controls preload="metadata" src="${escapeHtml(item.video_path)}"></video>`:'';
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
  ['submission_id','seller_name','seller_phone','seller_email','seller_cnic','listing_type','property_type','title','address_line1','city','state_region','block_name','size_label','property_facing','price_pkr','bedrooms','bathrooms','area_sqft','description','admin_notes','status','publish_start_date','publish_end_date'].forEach(name => { body[name] = fields[name]?.value?.trim?.() ?? fields[name]?.value ?? ''; });
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
  setAdminSubview("propertiesWorkspace", "form");
  const fields = propertyForm.elements;
  ["property_id", "title", "price", "listing_type", "property_type", "status", "address_line1", "city", "state_region", "block_name", "postal_code", "bedrooms", "bathrooms", "area_sqft", "description", "size_label", "property_facing", "price_pkr", "price_per_marla", "publish_start_date", "publish_end_date"].forEach((field) => {
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
  window.location.href = "index.html#admin-login";
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

document.querySelector("#cancelEdit").addEventListener("click", () => { resetEditor(); setAdminSubview("propertiesWorkspace", "list"); });

// Verify session with server on load. If not authenticated, redirect to main page where login resides.
;(async function initAdmin() {
  try {
    const session = await api('session');
    if (session && session.authenticated && session.user) {
      showDashboard(session.user);
    } else {
      // not authenticated — send user to main page where login UI is available
      window.location.href = 'index.html#admin-login';
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
  ["property_id", "title", "price", "listing_type", "property_type", "status", "address_line1", "city", "state_region", "block_name", "postal_code", "bedrooms", "bathrooms", "area_sqft", "description", "size_label", "property_facing", "price_pkr", "price_per_marla", "publish_start_date", "publish_end_date"].forEach((field) => {
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
      <label class="plan-name-field">Payment Plan Name<input name="project_plan_name_${index}" value="${escapeHtml(planData?.plan_name || "")}" placeholder="e.g. Executive Block Plan" required /></label>
      <label>Size / Type<input name="project_plan_size_label_${index}" value="${escapeHtml(planData?.size_label || "")}" placeholder="3 Marla" /></label>
      <label>Booking<input name="project_plan_booking_${index}" type="number" min="0" value="${planData?.booking_amount || ""}" placeholder="1000000" /></label>
      <label>Monthly Installment<input name="project_plan_monthly_${index}" type="number" min="0" value="${planData?.monthly_installment || ""}" placeholder="40000" /></label>
      <label>Half Yearly Count<input name="project_plan_half_count_${index}" type="number" min="0" value="${planData?.half_yearly_count || ""}" placeholder="5" /></label>
      <label>Half Yearly Installment<input name="project_plan_half_amount_${index}" type="number" min="0" value="${planData?.half_yearly_installment || ""}" placeholder="150000" /></label>
      <label>On Possession<input name="project_plan_possession_${index}" type="number" min="0" value="${planData?.on_possession || ""}" placeholder="350000" /></label>
      <label>Balloting<input name="project_plan_balloting_${index}" value="${escapeHtml(planData?.balloting || "")}" placeholder="Q1 2027 or Yes/No" /></label>
      <label>Other Payment<input name="project_plan_other_payment_${index}" type="number" min="0" value="${planData?.other_payment || ""}" placeholder="250000" /></label>
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
      plan_name: row.querySelector(`[name="project_plan_name_${i}"]`)?.value?.trim() || "Payment Plans",
      size_label: sizeLabel,
      booking_amount: row.querySelector(`[name="project_plan_booking_${i}"]`)?.value?.trim() || "",
      monthly_installment: row.querySelector(`[name="project_plan_monthly_${i}"]`)?.value?.trim() || "",
      half_yearly_count: row.querySelector(`[name="project_plan_half_count_${i}"]`)?.value?.trim() || "",
      half_yearly_installment: row.querySelector(`[name="project_plan_half_amount_${i}"]`)?.value?.trim() || "",
      on_possession: row.querySelector(`[name="project_plan_possession_${i}"]`)?.value?.trim() || "",
      balloting: row.querySelector(`[name="project_plan_balloting_${i}"]`)?.value?.trim() || "",
      other_payment: row.querySelector(`[name="project_plan_other_payment_${i}"]`)?.value?.trim() || "",
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
      <div><h3>${escapeHtml(project.title)}</h3><p>${project.plan_name ? `Plan: ${escapeHtml(project.plan_name)} · ` : ""}${escapeHtml(project.location)} · ${escapeHtml(project.status)}</p><strong>${escapeHtml(project.category)}</strong></div>
      <div class="admin-row-actions"><button type="button" class="edit-project" data-id="${project.project_id}">Edit</button><button type="button" class="delete-project" data-id="${project.project_id}">Delete</button></div>
    </article>`;
  }).join("");
}

function populateProjectEditor(project) {
  setAdminSubview("projectsWorkspace", "form");
  const fields = document.querySelector("#projectForm").elements;
  ["project_id", "title", "plan_name", "category", "location", "status", "hero_image_url", "headline", "description"].forEach((field) => {
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

document.querySelector("#cancelProjectEdit").addEventListener("click", () => { resetProjectEditor(); setAdminSubview("projectsWorkspace", "list"); });

// Toggle project payment plans visibility
document.querySelector("#enableProjectPaymentPlans").addEventListener("change", (event) => {
  document.querySelector("#projectPaymentPlansFieldset").hidden = !event.target.checked;
});

document.querySelector("#addProjectPlanRow").addEventListener("click", () => createProjectPlanRow(null));

document.querySelector("#projectForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  const body = {};
  ["project_id", "title", "plan_name", "category", "location", "status", "hero_image_url", "headline", "description"].forEach((field) => { body[field] = fields[field].value.trim(); });
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
  container.innerHTML = popups.map((p) => {
    const type = ['content', 'image', 'video'].includes(p.popup_type) ? p.popup_type : (p.image_url ? 'image' : 'content');
    const preview = type === 'image' && p.image_url
      ? `<img src="${escapeHtml(p.image_url)}" alt="">`
      : type === 'video' && p.video_url
        ? `<video class="digital-map-preview admin-popup-video" src="${escapeHtml(p.video_url)}" muted preload="metadata"></video>`
        : '<span class="admin-popup-type-preview">Content</span>';
    const typeLabel = `${type.charAt(0).toUpperCase()}${type.slice(1)} popup`;
    return `<article class="admin-property">${preview}<div><h3>${escapeHtml(p.headline || typeLabel)}</h3><p>${escapeHtml(p.link_url || '')}</p><strong>${escapeHtml(type)} only</strong><small style="color:${Number(p.is_published) ? 'green' : 'gray'}">${Number(p.is_published) ? '● Published' : '○ Draft'}</small></div><div class="admin-row-actions"><button type="button" class="edit-popup" data-id="${p.popup_id}">Edit</button><button type="button" class="delete-popup" data-id="${p.popup_id}">Delete</button></div></article>`;
  }).join('');
}

function syncPopupTypeFields() {
  const form = document.querySelector('#homePopupForm');
  const type = form.elements.popup_type.value;
  form.querySelectorAll('[data-popup-type-fields]').forEach((group) => { group.hidden = group.dataset.popupTypeFields !== type; });
}

function resetHomePopupEditor() {
  const form = document.querySelector('#homePopupForm');
  form.reset();
  form.elements.popup_id.value = '';
  form.elements.popup_type.value = 'content';
  syncPopupTypeFields();
  document.querySelector('#homePopupMessage').textContent = '';
}

function populateHomePopupEditor(popup) {
  const form = document.querySelector('#homePopupForm');
  form.elements.popup_id.value = popup.popup_id || '';
  form.elements.popup_type.value = popup.popup_type || (popup.image_url ? 'image' : 'content');
  form.elements.image_url.value = popup.image_url || '';
  form.elements.video_url.value = popup.video_url || '';
  form.elements.link_url.value = popup.link_url || '';
  form.elements.headline.value = popup.headline || '';
  form.elements.html_content.value = popup.html_content || '';
  form.elements.is_published.checked = !!Number(popup.is_published);
  syncPopupTypeFields();
  document.querySelector('#homePopupMessage').textContent = '';
}

document.querySelector('#popupTypeSelect').addEventListener('change', syncPopupTypeFields);

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
      if (Number(document.querySelector('#homePopupForm').elements.popup_id.value) === id) resetHomePopupEditor();
      await loadAdminPopups();
    } catch (error) { window.alert(error.message); }
  }
});

document.querySelector('#homePopupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = form.elements;
  const body = {
    popup_id: fields.popup_id.value.trim(),
    popup_type: fields.popup_type.value,
    image_url: fields.image_url.value.trim(),
    video_url: fields.video_url.value.trim(),
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
    await loadAdminPopups();
    resetHomePopupEditor();
    msg.textContent = 'Popup saved.';
  } catch (error) { msg.textContent = error.message; msg.classList.add('error'); }
});

async function uploadPopupFile(event, expectedType, targetField) {
  const files = [...event.target.files];
  if (!files.length) return;
  const data = new FormData();
  data.append('files[]', files[0]);
  const msg = document.querySelector('#homePopupMessage');
  msg.classList.remove('error');
  msg.textContent = `Uploading popup ${expectedType}…`;
  try {
    const result = await api('upload', data, true);
    const file = result.files && result.files[0];
    if (!file || !file.url || file.type !== expectedType) throw new Error(`Choose a valid ${expectedType} file.`);
    document.querySelector('#homePopupForm').elements[targetField].value = file.url;
    msg.textContent = `${expectedType.charAt(0).toUpperCase()}${expectedType.slice(1)} uploaded. Save this popup, then add another if required.`;
  } catch (error) { msg.textContent = error.message; msg.classList.add('error'); }
  event.target.value = '';
}

document.querySelector('#popupImageUpload').addEventListener('change', (event) => uploadPopupFile(event, 'image', 'image_url'));
document.querySelector('#popupVideoUpload').addEventListener('change', (event) => uploadPopupFile(event, 'video', 'video_url'));
syncPopupTypeFields();

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
  setAdminSubview("agentsWorkspace", "form");
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

document.querySelector("#cancelAgentEdit").addEventListener("click", () => { resetAgentEditor(); setAdminSubview("agentsWorkspace", "list"); });

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

async function loadOfficeAddresses() {
  try {
    adminState.officeAddresses = await api("admin_office_addresses");
    renderOfficeAddresses();
  } catch (error) {
    document.querySelector("#officeAddressMessage").textContent = error.message;
  }
}

function renderOfficeAddresses() {
  const items = adminState.officeAddresses || [];
  const list = document.querySelector("#adminOfficeAddressList");
  document.querySelector("#officeAddressCount").textContent = `${items.length} address${items.length === 1 ? "" : "es"}`;
  if (!items.length) { list.innerHTML = '<p class="empty-list">No office addresses yet.</p>'; return; }
  list.innerHTML = items.map((item) => `<article class="admin-property office-admin-item"><span class="office-admin-icon" aria-hidden="true">⌖</span>
    <div><h3>${escapeHtml(item.office_name)}</h3><p>${escapeHtml(item.address_text)}</p><strong>${item.is_published ? "Published" : "Hidden"}</strong></div>
    <div class="admin-row-actions"><button type="button" class="edit-office-address" data-id="${item.office_id}">Edit</button><button type="button" class="delete-office-address" data-id="${item.office_id}">Delete</button></div>
  </article>`).join("");
}

function populateOfficeAddressEditor(item) {
  setAdminSubview("addressesWorkspace", "form");
  const fields = document.querySelector("#officeAddressForm").elements;
  ["office_id", "office_name", "address_text", "phone", "map_url"].forEach((field) => { fields[field].value = item[field] ?? ""; });
  fields.is_published.checked = !!Number(item.is_published);
  document.querySelector("#officeAddressEditorTitle").textContent = `Edit: ${item.office_name}`;
  document.querySelector("#saveOfficeAddressButton").innerHTML = 'Save changes <span>→</span>';
  document.querySelector("#cancelOfficeAddressEdit").hidden = false;
}

function resetOfficeAddressEditor() {
  const form = document.querySelector("#officeAddressForm");
  form.reset();
  form.elements.office_id.value = "";
  form.elements.is_published.checked = true;
  document.querySelector("#officeAddressEditorTitle").textContent = "Add an office address";
  document.querySelector("#saveOfficeAddressButton").innerHTML = 'Save address <span>→</span>';
  document.querySelector("#cancelOfficeAddressEdit").hidden = true;
}

document.querySelector("#adminOfficeAddressList").addEventListener("click", async (event) => {
  const id = Number(event.target.dataset.id);
  const item = adminState.officeAddresses.find((address) => Number(address.office_id) === id);
  if (event.target.classList.contains("edit-office-address") && item) populateOfficeAddressEditor(item);
  if (event.target.classList.contains("delete-office-address") && item) {
    if (!window.confirm(`Delete “${item.office_name}”?`)) return;
    try { await api("delete_office_address", { office_id: id }); await loadOfficeAddresses(); resetOfficeAddressEditor(); }
    catch (error) { window.alert(error.message); }
  }
});

document.querySelector("#cancelOfficeAddressEdit").addEventListener("click", () => { resetOfficeAddressEditor(); setAdminSubview("addressesWorkspace", "list"); });
document.querySelector("#officeAddressForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const fields = event.currentTarget.elements;
  const message = document.querySelector("#officeAddressMessage");
  message.classList.remove("error");
  message.textContent = "Saving address…";
  try {
    await api("save_office_address", { office_id: fields.office_id.value.trim(), office_name: fields.office_name.value.trim(), address_text: fields.address_text.value.trim(), phone: fields.phone.value.trim(), map_url: fields.map_url.value.trim(), is_published: fields.is_published.checked ? 1 : 0 });
    await loadOfficeAddresses();
    resetOfficeAddressEditor();
    message.textContent = "Office address saved.";
  } catch (error) { message.textContent = error.message; message.classList.add("error"); }
});

async function loadLoginUsers() {
  try { adminState.loginUsers = await api("admin_login_users"); renderLoginUsers(); }
  catch (error) { document.querySelector("#loginUserMessage").textContent = error.message; }
}
function renderLoginUsers() {
  const list=document.querySelector("#adminLoginUserList"), items=adminState.loginUsers||[];
  document.querySelector("#loginUserCount").textContent=`${items.length} user${items.length===1?"":"s"}`;
  if(!items.length){list.innerHTML='<p class="empty-list">No login users found.</p>';return;}
  list.innerHTML=items.map(item=>`<article class="admin-property login-user-item"><span class="login-user-avatar">${escapeHtml((item.full_name||"U").charAt(0).toUpperCase())}</span><div><h3>${escapeHtml(item.full_name)}</h3><p>${escapeHtml(item.email||item.phone||item.username||"")}</p><strong>${escapeHtml(item.user_type)} · ${Number(item.is_active)?"Active":"Disabled"}</strong></div><div class="admin-row-actions"><button class="edit-login-user" data-type="${item.user_type}" data-id="${item.user_id}" type="button">Edit / Reset</button><button class="delete-login-user" data-type="${item.user_type}" data-id="${item.user_id}" type="button">Delete</button></div></article>`).join("");
}
function syncLoginUserType(){const form=document.querySelector("#loginUserForm");form.querySelector(".admin-username-field").hidden=form.elements.user_type.value!=="admin";}
function resetLoginUserEditor(){const form=document.querySelector("#loginUserForm");form.reset();form.elements.user_id.value="";form.elements.is_active.checked=true;form.elements.user_type.disabled=false;document.querySelector("#loginUserEditorTitle").textContent="Add a login user";document.querySelector("#saveLoginUserButton").innerHTML='Save user <span>→</span>';document.querySelector("#cancelLoginUserEdit").hidden=true;syncLoginUserType();}
function populateLoginUserEditor(item){setAdminSubview("loginUsersWorkspace","form");const form=document.querySelector("#loginUserForm");["user_id","user_type","full_name","email","phone","username"].forEach(name=>{form.elements[name].value=item[name]??"";});form.elements.new_password.value="";form.elements.is_active.checked=!!Number(item.is_active);form.elements.user_type.disabled=true;document.querySelector("#loginUserEditorTitle").textContent=`Edit: ${item.full_name}`;document.querySelector("#saveLoginUserButton").innerHTML='Save / reset password <span>→</span>';document.querySelector("#cancelLoginUserEdit").hidden=false;syncLoginUserType();}
document.querySelector("#loginUserForm").elements.user_type.addEventListener("change",syncLoginUserType);
document.querySelector("#cancelLoginUserEdit").addEventListener("click",()=>{resetLoginUserEditor();setAdminSubview("loginUsersWorkspace","list");});
document.querySelector("#adminLoginUserList").addEventListener("click",async event=>{const id=Number(event.target.dataset.id),type=event.target.dataset.type,item=adminState.loginUsers.find(user=>Number(user.user_id)===id&&user.user_type===type);if(event.target.classList.contains("edit-login-user")&&item)populateLoginUserEditor(item);if(event.target.classList.contains("delete-login-user")&&item){if(!confirm(`Delete login account for “${item.full_name}”?`))return;try{await api("delete_login_user",{user_id:id,user_type:type});await loadLoginUsers();resetLoginUserEditor();}catch(error){alert(error.message);}}});
document.querySelector("#loginUserForm").addEventListener("submit",async event=>{event.preventDefault();const f=event.currentTarget.elements,message=document.querySelector("#loginUserMessage");message.classList.remove("error");message.textContent="Saving user…";try{await api("save_login_user",{user_id:f.user_id.value,user_type:f.user_type.value,full_name:f.full_name.value.trim(),email:f.email.value.trim(),phone:f.phone.value.trim(),username:f.username.value.trim(),new_password:f.new_password.value,is_active:f.is_active.checked?1:0});await loadLoginUsers();resetLoginUserEditor();message.textContent="Login user saved securely.";}catch(error){message.textContent=error.message;message.classList.add("error");}});

async function loadChatMessages() {
  const list = document.querySelector("#adminChatMessageList");
  try { adminState.chatMessages = await api("admin_chat_messages"); renderChatMessages(); }
  catch (error) { if (list) list.innerHTML = `<p class="empty-list">${escapeHtml(error.message)}</p>`; }
}
function chatLanguageLabel(value) { return ({en:"English",ur:"Urdu",roman:"Roman Urdu"})[value] || value || "English"; }
function whatsappNumber(value) { const digits=String(value||"").replace(/\D/g,"");return digits.startsWith("0")?`92${digits.slice(1)}`:digits; }
function renderChatMessages() {
  const list=document.querySelector("#adminChatMessageList"),filter=document.querySelector("#chatMessageFilter")?.value||"all",all=adminState.chatMessages||[],items=filter==="all"?all:all.filter(item=>item.status===filter),newCount=all.filter(item=>item.status==="new").length;
  document.querySelector("#chatMessageCount").textContent=`${all.length} message${all.length===1?"":"s"}`;
  document.querySelector("#dashChatMessageCount").textContent=String(all.length);
  document.querySelector("#newChatMessageBadge").textContent=newCount?String(newCount):"";
  if(!items.length){list.innerHTML=`<p class="empty-list">${filter==="all"?"No chatbot callback messages yet.":`No ${escapeHtml(filter)} chatbot messages.`}</p>`;return;}
  list.innerHTML=items.map(item=>{const phone=escapeHtml(item.phone||""),wa=whatsappNumber(item.phone),date=item.created_at?new Date(String(item.created_at).replace(" ","T")).toLocaleString():"";return `<article class="admin-property chat-message-item" data-status="${escapeHtml(item.status)}"><span class="chat-message-avatar">${escapeHtml((item.name||"V").charAt(0).toUpperCase())}</span><div class="chat-message-content"><h3>${escapeHtml(item.name)}</h3><p><a href="tel:${phone}">${phone}</a> · ${escapeHtml(chatLanguageLabel(item.language))} · ${escapeHtml(date)}</p><div class="chat-message-text">${escapeHtml(item.message||"Callback requested from the chatbot.")}</div>${item.property_title?`<a class="chat-property-link" href="property.html?id=${Number(item.property_id)}" target="_blank" rel="noopener">Property: ${escapeHtml(item.property_title)}</a>`:""}</div><div class="chat-message-actions"><select class="chat-status-select" data-id="${item.enquiry_id}" aria-label="Message status"><option value="new"${item.status==="new"?" selected":""}>New</option><option value="contacted"${item.status==="contacted"?" selected":""}>Contacted</option><option value="closed"${item.status==="closed"?" selected":""}>Closed</option></select><a class="chat-action-link" href="tel:${phone}">Call</a>${wa?`<a class="chat-action-link whatsapp" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>`:""}<button class="delete-chat-message" data-id="${item.enquiry_id}" type="button">Delete</button></div></article>`;}).join("");
}
document.querySelector("#chatMessageFilter").addEventListener("change",renderChatMessages);
document.querySelector("#refreshChatMessages").addEventListener("click",loadChatMessages);
document.querySelector("#adminChatMessageList").addEventListener("change",async event=>{if(!event.target.classList.contains("chat-status-select"))return;const select=event.target;select.disabled=true;try{await api("update_chat_message",{enquiry_id:Number(select.dataset.id),status:select.value});await loadChatMessages();}catch(error){alert(error.message);select.disabled=false;}});
document.querySelector("#adminChatMessageList").addEventListener("click",async event=>{if(!event.target.classList.contains("delete-chat-message"))return;if(!confirm("Delete this chatbot message?"))return;try{await api("delete_chat_message",{enquiry_id:Number(event.target.dataset.id)});await loadChatMessages();}catch(error){alert(error.message);}});

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

let mapPdfModulePromise = null;
async function convertMapPdfInBrowser(pdfFile, statusElement) {
  if (!pdfFile || (pdfFile.type !== "application/pdf" && !/\.pdf$/i.test(pdfFile.name || ""))) throw new Error("Choose a valid map PDF.");
  if (!mapPdfModulePromise) mapPdfModulePromise = import("./vendor/pdfjs/pdf.mjs");
  const pdfjs = await mapPdfModulePromise;
  pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs/pdf.worker.mjs";
  if (statusElement) statusElement.textContent = "Reading PDF page 1…";
  const bytes = new Uint8Array(await pdfFile.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    cMapUrl: "./vendor/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "./vendor/pdfjs/standard_fonts/",
    wasmUrl: "./vendor/pdfjs/wasm/"
  });
  const documentHandle = await loadingTask.promise;
  let canvas = null;
  try {
    const page = await documentHandle.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const requestedScale = 300 / 72;
    const dimensionScale = 14000 / Math.max(base.width, base.height);
    const pixelScale = Math.sqrt(140000000 / Math.max(1, base.width * base.height));
    const scale = Math.min(requestedScale, dimensionScale, pixelScale);
    const dpi = Math.max(72, Math.round(scale * 72));
    const viewport = page.getViewport({ scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    if (width < 1000 || height < 1000) throw new Error("The PDF page is too small to create a high-resolution map.");
    if (statusElement) statusElement.textContent = `Converting PDF to ${width.toLocaleString()} × ${height.toLocaleString()} pixels…`;
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser cannot create the map image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    await page.render({ canvasContext: context, viewport, background: "#ffffff" }).promise;
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("The browser could not export the high-resolution map image.")), "image/jpeg", .92));
    const baseName = String(pdfFile.name || "map").replace(/\.pdf$/i, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "map";
    return { file: new File([blob], `${baseName}-300dpi.jpg`, { type: "image/jpeg" }), width, height, dpi };
  } finally {
    if (canvas) { canvas.width = 1; canvas.height = 1; }
    await documentHandle.destroy();
  }
}

async function loadDigitalMaps(selectedMapId = null) {
  const message = document.querySelector("#digitalMapMessage");
  try { adminState.digitalMaps = await api("admin_digital_maps"); renderDigitalMaps(selectedMapId); }
  catch (error) { if (message) message.textContent = error.message; }
}
function renderDigitalMaps(selectedMapId = null) {
  const maps=adminState.digitalMaps||[],list=document.querySelector("#adminDigitalMapList");
  document.querySelector("#digitalMapCount").textContent=`${maps.length} map${maps.length===1?"":"s"}`;
  list.innerHTML=maps.length?maps.map(map=>{const preview=map.map_image?`<img class="digital-map-preview" src="${escapeHtml(map.map_image)}" alt="">`:map.original_pdf?`<a class="digital-map-pdf-preview" href="${escapeHtml(map.original_pdf)}" target="_blank" rel="noopener">PDF</a>`:'<span class="admin-popup-type-preview">No file</span>';const files=`<div class="digital-map-file-links">${map.map_image?`<a href="${escapeHtml(map.map_image)}" target="_blank" rel="noopener">Open image</a>`:""}${map.original_pdf?`<a href="${escapeHtml(map.original_pdf)}" target="_blank" rel="noopener">Open saved PDF</a>`:""}${Number(map.is_active)&&map.map_image?`<a href="plot-finder.html?map_id=${Number(map.map_id)}" target="_blank" rel="noopener">View in Plot Finder</a>`:""}</div>`;return `<article class="admin-property">${preview}<div><h3>${escapeHtml(map.name)}</h3><p>${map.map_image?`${map.original_width.toLocaleString()} × ${map.original_height.toLocaleString()} high-resolution image`:'PDF waiting for image conversion'}</p><strong>${map.blocks.length} block${map.blocks.length===1?"":"s"} · ${Number(map.is_active)?"Published":"Hidden"}</strong>${files}</div><div class="admin-row-actions">${map.original_pdf?`<button class="convert-digital-map" data-id="${map.map_id}" type="button">${map.map_image?'Rebuild image':'Convert PDF'}</button>`:""}<button class="edit-digital-map" data-id="${map.map_id}" type="button">Edit</button><button class="delete-digital-map" data-id="${map.map_id}" type="button">Delete</button></div></article>`;}).join(""):'<p class="empty-list">No digital maps have been added.</p>';
  const select=document.querySelector("#digitalMapBlockMap"),previous=selectedMapId||Number(select.value)||maps[0]?.map_id||"";select.innerHTML='<option value="">Choose a map</option>'+maps.map(map=>`<option value="${map.map_id}">${escapeHtml(map.name)}</option>`).join("");if(maps.some(map=>Number(map.map_id)===Number(previous)))select.value=String(previous);renderDigitalMapBlocks();
}
function renderDigitalMapBlocks(){const mapId=Number(document.querySelector("#digitalMapBlockMap").value),map=adminState.digitalMaps.find(item=>Number(item.map_id)===mapId),container=document.querySelector("#digitalMapBlockList");container.innerHTML=map?(map.blocks.length?map.blocks.map(block=>`<span class="map-block-chip">${escapeHtml(block.name)}<button type="button" class="delete-digital-map-block" data-id="${block.block_id}" aria-label="Delete ${escapeHtml(block.name)}">×</button></span>`).join(""):'<p class="empty-list">No blocks yet. Add the first block above.</p>'):'<p class="empty-list">Choose a map to manage its blocks.</p>';}
function resetDigitalMapEditor(){const form=document.querySelector("#digitalMapForm");form.reset();form.elements.map_id.value="";form.elements.is_active.checked=true;document.querySelector("#digitalMapEditorTitle").textContent="Add a map";document.querySelector("#cancelDigitalMapEdit").hidden=true;document.querySelector("#digitalMapCurrentFiles").textContent="";document.querySelector("#saveDigitalMapButton").innerHTML='Save map <span>→</span>';}
function editDigitalMap(map){const form=document.querySelector("#digitalMapForm");form.elements.map_id.value=map.map_id;form.elements.name.value=map.name;form.elements.is_active.checked=!!Number(map.is_active);document.querySelector("#digitalMapEditorTitle").textContent=`Edit: ${map.name}`;document.querySelector("#cancelDigitalMapEdit").hidden=false;document.querySelector("#saveDigitalMapButton").innerHTML='Save changes <span>→</span>';document.querySelector("#digitalMapCurrentFiles").innerHTML=`${map.map_image?`Image saved: <a href="${escapeHtml(map.map_image)}" target="_blank" rel="noopener">open image</a>`:"No image uploaded"}${map.original_pdf?` · PDF saved: <a href="${escapeHtml(map.original_pdf)}" target="_blank" rel="noopener">open PDF</a>`:" · No PDF uploaded"}${map.plot_index_file?' · Plot index saved':' · No automatic plot index'}`;document.querySelector("#digitalMapBlockMap").value=String(map.map_id);renderDigitalMapBlocks();}
document.querySelector("#cancelDigitalMapEdit").addEventListener("click",resetDigitalMapEditor);
document.querySelector("#digitalMapBlockMap").addEventListener("change",renderDigitalMapBlocks);
document.querySelector("#digitalMapForm").addEventListener("submit",async event=>{event.preventDefault();const form=event.currentTarget,message=document.querySelector("#digitalMapMessage"),pdfFile=form.elements.original_pdf.files[0]||null,hasPdf=!!pdfFile,button=document.querySelector("#saveDigitalMapButton");button.disabled=true;try{let converted=null;if(hasPdf)converted=await convertMapPdfInBrowser(pdfFile,message);const data=new FormData(form);if(converted){data.set("map_image",converted.file,converted.file.name);data.set("browser_converted","1");data.set("conversion_dpi",String(converted.dpi));message.textContent=`Uploading PDF and ${converted.width.toLocaleString()} × ${converted.height.toLocaleString()} map image…`;}else message.textContent="Uploading and saving map…";const result=await api("save_digital_map",data,true);await loadDigitalMaps(result.map_id);resetDigitalMapEditor();message.textContent=result.converted?`PDF converted with ${result.conversion_method}: ${Number(result.original_width).toLocaleString()} × ${Number(result.original_height).toLocaleString()} pixels. It is ready in Plot Finder.`:"Digital map saved.";}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
document.querySelector("#adminDigitalMapList").addEventListener("click",async event=>{const id=Number(event.target.dataset.id),map=adminState.digitalMaps.find(item=>Number(item.map_id)===id),message=document.querySelector("#digitalMapMessage");if(event.target.classList.contains("convert-digital-map")&&map){if(!confirm(`Convert “${map.name}” PDF into a new high-resolution map image?`))return;event.target.disabled=true;try{message.textContent="Downloading the saved PDF…";const response=await fetch(map.original_pdf,{credentials:"same-origin"});if(!response.ok)throw new Error("The saved PDF could not be opened.");const pdfBlob=await response.blob(),pdfFile=new File([pdfBlob],`${map.name}.pdf`,{type:"application/pdf"}),converted=await convertMapPdfInBrowser(pdfFile,message),data=new FormData();data.set("map_id",String(map.map_id));data.set("name",map.name);if(Number(map.is_active))data.set("is_active","1");data.set("map_image",converted.file,converted.file.name);data.set("browser_converted","1");data.set("conversion_dpi",String(converted.dpi));message.textContent="Uploading the generated high-resolution image…";const result=await api("save_digital_map",data,true);await loadDigitalMaps(id);message.textContent=`Conversion complete: ${Number(result.original_width).toLocaleString()} × ${Number(result.original_height).toLocaleString()} pixels. The map is ready in Plot Finder.`;}catch(error){message.textContent=error.message;}finally{event.target.disabled=false;}return;}if(event.target.classList.contains("edit-digital-map")&&map)editDigitalMap(map);if(event.target.classList.contains("delete-digital-map")&&map){if(!confirm(`Delete “${map.name}” and its block list?`))return;try{await api("delete_digital_map",{map_id:id});await loadDigitalMaps();resetDigitalMapEditor();}catch(error){alert(error.message);}}});
document.querySelector("#digitalMapBlockForm").addEventListener("submit",async event=>{event.preventDefault();const f=event.currentTarget.elements,message=document.querySelector("#digitalMapBlockMessage"),mapId=Number(f.map_id.value);message.textContent="Adding block…";try{await api("save_digital_map_block",{map_id:mapId,name:f.name.value.trim()});f.name.value="";await loadDigitalMaps(mapId);message.textContent="Block added manually.";}catch(error){message.textContent=error.message;}});
document.querySelector("#digitalMapBlockList").addEventListener("click",async event=>{if(!event.target.classList.contains("delete-digital-map-block"))return;const mapId=Number(document.querySelector("#digitalMapBlockMap").value);if(!confirm("Delete this block name?"))return;try{await api("delete_digital_map_block",{block_id:Number(event.target.dataset.id)});await loadDigitalMaps(mapId);}catch(error){alert(error.message);}});

document.querySelectorAll(".admin-tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".admin-tab").forEach((item) => { item.classList.toggle("active", item === tab); item.setAttribute("aria-selected", item === tab); });
  document.querySelectorAll(".admin-workspace").forEach((workspace) => { workspace.hidden = workspace.id !== tab.dataset.workspace; });
  document.querySelectorAll(".admin-menu-group").forEach(group=>group.classList.toggle("open",group.contains(tab)));
  if (tab.dataset.defaultSubview) setAdminSubview(tab.dataset.workspace, tab.dataset.defaultSubview);
  const label=tab.childNodes[0]?.textContent?.trim()||tab.textContent.trim();document.querySelector(".dashboard-topbar h1").textContent=label;
}));

document.querySelectorAll(".admin-submenu button").forEach(button=>button.addEventListener("click",()=>{const tab=[...document.querySelectorAll(".admin-tab")].find(item=>item.dataset.workspace===button.dataset.workspace);tab?.click();document.querySelectorAll(".admin-submenu button").forEach(item=>item.classList.toggle("active",item===button));setAdminSubview(button.dataset.workspace,button.dataset.subview);const reset={property:resetEditor,project:resetProjectEditor,map:resetDigitalMapEditor,popup:resetHomePopupEditor,agent:resetAgentEditor,address:resetOfficeAddressEditor,user:resetLoginUserEditor}[button.dataset.reset];reset?.();setTimeout(()=>document.getElementById(button.dataset.target)?.scrollIntoView({behavior:"smooth",block:"start"}),80);}));

[["listingCount","dashPropertyCount"],["projectCount","dashProjectCount"],["submissionCount","dashSubmissionCount"],["loginUserCount","dashUserCount"]].forEach(([sourceId,targetId])=>{const source=document.getElementById(sourceId),target=document.getElementById(targetId);if(!source||!target)return;const sync=()=>{target.textContent=(source.textContent.match(/\d+/)||["0"])[0];};new MutationObserver(sync).observe(source,{childList:true,characterData:true,subtree:true});sync();});
