const adminState = { properties: [], projects: [], subProjects: [], roles: [], permissions: [], masterOptions: [], homeGallery: [], submissions: [], officeAddresses: [], loginUsers: [], digitalMaps: [] };
let adminCsrfToken = "";
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
  if (window.HeeraAdminAPI?.request) {
    const result = await window.HeeraAdminAPI.request(action, data, isUpload);
    adminCsrfToken = window.HeeraAdminAPI.getCsrfToken?.() || adminCsrfToken;
    return result;
  }
  // Compatibility fallback for servers that have not deployed Admin API v2 yet.
  if (data && !adminCsrfToken) {
    const tokenResponse = await fetch("api.php?action=csrf", { credentials: "same-origin", headers: { Accept: "application/json" } });
    const tokenResult = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenResult.csrf_token) throw new Error("Could not create a secure session. Refresh the page and try again.");
    adminCsrfToken = tokenResult.csrf_token;
  }
  const options = { method: data ? "POST" : "GET", headers: { Accept: "application/json" }, credentials: 'same-origin', cache: 'no-store' };
  if (data) options.headers["X-CSRF-Token"] = adminCsrfToken;
  if (data && !isUpload) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }
  if (isUpload) options.body = data;
  const response = await fetch(`api.php?action=${encodeURIComponent(action)}`, options);
  const result = await response.json().catch(() => ({ error: "The server returned an invalid response." }));
  if (!response.ok) throw new Error(result.error || "Something went wrong.");
  if (result.csrf_token) adminCsrfToken = result.csrf_token;
  return result;
}

async function apiGet(action, params = {}) {
  if (window.HeeraAdminAPI?.get) return window.HeeraAdminAPI.get(action, params);
  const query = new URLSearchParams({ action, ...params }).toString();
  const response = await fetch(`api.php?${query}`, { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" });
  const result = await response.json().catch(() => ({ error: "The server returned an invalid response." }));
  if (!response.ok) throw new Error(result.error || "Something went wrong.");
  return result;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

const masterOptionLabels = { project: "Project", subproject: "Sub-Project", block: "Block", marla: "Marla / Size" };
let masterDataFilter = "all";
let masterDataRequest = null;

function activeMasterOptions(type) {
  return (adminState.masterOptions || []).filter((item) => item.option_type === type && Number(item.is_active));
}

function masterOptionChoices(type, selectedValue = "", blankLabel = "Choose an option") {
  const selected = String(selectedValue || "");
  const items = activeMasterOptions(type);
  const known = items.some((item) => item.name === selected);
  const legacy = selected && !known ? `<option value="${escapeHtml(selected)}">${escapeHtml(selected)} (existing)</option>` : "";
  return `<option value="">${escapeHtml(blankLabel)}</option>${legacy}${items.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("")}`;
}

function syncOneMasterSelect(selector, type, blankLabel) {
  const select = document.querySelector(selector);
  if (!select) return;
  const selected = select.value;
  select.innerHTML = masterOptionChoices(type, selected, blankLabel);
  select.value = selected;
}

function setMasterSelectValue(selector, type, value, blankLabel) {
  const select = document.querySelector(selector);
  if (!select) return;
  const selected = String(value || "");
  select.innerHTML = masterOptionChoices(type, selected, blankLabel);
  select.value = selected;
}

function syncMasterOptionSelects() {
  syncOneMasterSelect("#projectNameSelect", "project", "Choose project name");
  syncOneMasterSelect("#projectSubProjectName", "subproject", "No sub-project");
  syncOneMasterSelect("#subProjectNameSelect", "subproject", "Choose sub-project name");
  syncOneMasterSelect("#propertyBlockSelect", "block", "Choose block (optional)");
  syncOneMasterSelect("#propertyMarlaSelect", "marla", "Choose Marla / size (optional)");
  syncOneMasterSelect("#digitalMapProjectNameSelect", "project", "Choose project name");
  syncOneMasterSelect("#digitalMapBlockNameSelect", "block", "Choose block name");
  document.querySelectorAll(".payment-plan-size-select").forEach((select) => {
    const selected = select.value;
    select.innerHTML = masterOptionChoices("marla", selected, "Choose Marla / size");
    select.value = selected;
  });
}

function renderMasterOptions() {
  const list = document.querySelector("#masterOptionList");
  if (!list) return;
  const all = adminState.masterOptions || [];
  const items = masterDataFilter === "all" ? all : all.filter((item) => item.option_type === masterDataFilter);
  const count = document.querySelector("#masterOptionCount");
  if (count) count.textContent = `${items.length} option${items.length === 1 ? "" : "s"}`;
  if (!items.length) {
    list.innerHTML = '<p class="empty-list">No options in this category yet.</p>';
    return;
  }
  const canManage = document.documentElement.dataset.canManageMasterData !== "false";
  list.innerHTML = items.map((item) => `<article class="master-option-row${Number(item.is_active) ? "" : " is-archived"}">
    <span class="master-option-type">${escapeHtml(masterOptionLabels[item.option_type] || item.option_type)}</span>
    <div><strong>${escapeHtml(item.name)}</strong><small>${Number(item.is_active) ? "Available in forms" : "Archived · existing data preserved"}</small></div>
    ${canManage ? `<div class="admin-row-actions"><button class="edit-master-option" data-id="${Number(item.option_id)}" type="button">Edit</button><button class="toggle-master-option" data-id="${Number(item.option_id)}" type="button">${Number(item.is_active) ? "Archive" : "Restore"}</button></div>` : ""}
  </article>`).join("");
}

function resetMasterOptionEditor() {
  const form = document.querySelector("#masterOptionForm");
  if (!form) return;
  form.reset();
  form.elements.option_id.value = "";
  form.elements.sort_order.value = "0";
  form.elements.is_active.checked = true;
  document.querySelector("#masterOptionEditorTitle").textContent = "Add an option";
  document.querySelector("#cancelMasterOptionEdit").hidden = true;
  document.querySelector("#masterOptionMessage").textContent = "";
}

function populateMasterOptionEditor(item) {
  const form = document.querySelector("#masterOptionForm");
  if (!form) return;
  form.elements.option_id.value = item.option_id;
  form.elements.option_type.value = item.option_type;
  form.elements.name.value = item.name;
  form.elements.sort_order.value = item.sort_order || 0;
  form.elements.is_active.checked = !!Number(item.is_active);
  document.querySelector("#masterOptionEditorTitle").textContent = `Edit: ${item.name}`;
  document.querySelector("#cancelMasterOptionEdit").hidden = false;
  document.querySelector("#masterOptionMessage").textContent = "";
}

async function loadMasterData(force = false) {
  const workspace = document.querySelector("#masterDataWorkspace");
  if (workspace?.dataset.permissionAllowed === "false") return adminState.masterOptions;
  if (!force && adminState.masterOptions.length) {
    renderMasterOptions();
    syncMasterOptionSelects();
    return adminState.masterOptions;
  }
  if (masterDataRequest) return masterDataRequest;
  masterDataRequest = api("admin_master_data").then((rows) => {
    adminState.masterOptions = Array.isArray(rows) ? rows : [];
    renderMasterOptions();
    syncMasterOptionSelects();
    return adminState.masterOptions;
  }).catch((error) => {
    const message = document.querySelector("#masterOptionMessage");
    if (message) { message.textContent = error.message; message.classList.add("error"); }
    throw error;
  }).finally(() => { masterDataRequest = null; });
  return masterDataRequest;
}

document.querySelector("#masterDataFilters")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-master-filter]");
  if (!button) return;
  masterDataFilter = button.dataset.masterFilter || "all";
  document.querySelectorAll("[data-master-filter]").forEach((item) => item.classList.toggle("active", item === button));
  renderMasterOptions();
});

document.querySelector("#masterOptionList")?.addEventListener("click", async (event) => {
  const id = Number(event.target.dataset.id);
  const item = (adminState.masterOptions || []).find((option) => Number(option.option_id) === id);
  if (!item) return;
  if (event.target.classList.contains("edit-master-option")) populateMasterOptionEditor(item);
  if (event.target.classList.contains("toggle-master-option")) {
    try {
      if (Number(item.is_active)) await api("archive_master_option", { option_id: id });
      else await api("save_master_option", { option_id: id, option_type: item.option_type, name: item.name, sort_order: item.sort_order, is_active: true });
      await loadMasterData(true);
    } catch (error) { alert(error.message); }
  }
});

document.querySelector("#masterOptionForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#masterOptionMessage");
  const button = document.querySelector("#saveMasterOptionButton");
  message.classList.remove("error");
  button.disabled = true;
  message.textContent = "Saving option…";
  button.disabled = true;
  try {
    await api("save_master_option", {
      option_id: form.elements.option_id.value,
      option_type: form.elements.option_type.value,
      name: form.elements.name.value.trim(),
      sort_order: form.elements.sort_order.value,
      is_active: form.elements.is_active.checked
    });
    resetMasterOptionEditor();
    await loadMasterData(true);
    message.textContent = "Option saved and connected to entry forms.";
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  } finally { button.disabled = false; }
});

document.querySelector("#cancelMasterOptionEdit")?.addEventListener("click", resetMasterOptionEditor);

function mediaLines(property, type) {
  return (property.media || []).filter((media) => media.media_type === type).map((media) => media.file_path).join("\n");
}

async function loadProperties() {
  try {
    const [properties] = await Promise.all([api("admin_properties"), loadMasterData().catch(() => [])]);
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
  const statusClass = (status) => status === "available" ? "badge--success" : status === "pending" ? "badge--warning" : status === "sold" || status === "rented" ? "badge--danger" : "badge--neutral";
  container.innerHTML = adminState.properties.map((property) => {
    const image = (property.media || []).find((item) => item.media_type === "image")?.file_path || "images/home-logo.jpg";
    const priceDisplay = formatPricePkr(property);
    const filterPrice = Number(property.price_pkr || property.price || 0);
    const searchText = [property.title, property.city, property.block_name, property.size_label, property.property_type, property.property_facing, property.project_title, property.status].filter(Boolean).join(" ").toLowerCase();
    return `<article class="admin-property" data-property-id="${Number(property.property_id)}" data-project="${escapeHtml(property.project_title || "")}" data-block="${escapeHtml(property.block_name || "")}" data-size="${escapeHtml(property.size_label || "")}" data-type="${escapeHtml(property.property_type || "")}" data-facing="${escapeHtml(property.property_facing || "")}" data-price="${filterPrice}" data-search="${escapeHtml(searchText)}" tabindex="0" role="button" aria-label="Edit ${escapeHtml(property.title)}">
      <img src="${escapeHtml(image)}" alt="" loading="lazy" />
      <div><h3>${escapeHtml(property.title)}</h3><p>${escapeHtml(property.city)}${property.block_name ? ` · ${escapeHtml(property.block_name)}` : ""}${property.project_title ? ` · ${escapeHtml(property.project_title)}` : ""}</p><strong>${escapeHtml(priceDisplay)}</strong> <span class="badge ${statusClass(property.status)}">${escapeHtml(property.status || "")}</span></div>
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

// Property-level payment plans are linked only for On Installments listings.

function populateEditor(property) {
  setAdminSubview("propertiesWorkspace", "form");
  syncMasterOptionSelects();
  setMasterSelectValue("#propertyBlockSelect", "block", property.block_name, "Choose block (optional)");
  setMasterSelectValue("#propertyMarlaSelect", "marla", property.size_label, "Choose Marla / size (optional)");
  syncPropertyProjectOptions();
  const fields = propertyForm.elements;
  ["property_id", "project_id", "title", "price", "listing_type", "property_type", "status", "address_line1", "city", "state_region", "block_name", "postal_code", "bedrooms", "bathrooms", "area_sqft", "description", "size_label", "property_facing", "price_pkr", "price_per_marla", "publish_start_date", "publish_end_date"].forEach((field) => {
    fields[field].value = property[field] ?? "";
  });
  syncPropertySubProjectOptions(property.sub_project_name || "", property.sub_project_id || "");
  syncPropertyPaymentPlanOptions(property.payment_plan_id || "");
  fields.images.value = mediaLines(property, "image");
  fields.videos.value = mediaLines(property, "video");
  fields.links.value = mediaLines(property, "link");
  document.querySelector("#editorEyebrow").textContent = "Editing listing";
  document.querySelector("#editorTitle").textContent = property.title;
  document.querySelector("#saveButton").innerHTML = 'Save changes <span>→</span>';
  document.querySelector("#cancelEdit").hidden = false;
  propertyMessage.textContent = "";
  updateBedsBathsVisibility();
  // Payment plan linkage is synchronized above.
  document.querySelector(".editor-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

// first resetEditor removed; keep the later definition

function resetEditor() {
  propertyForm.reset();
  propertyForm.elements.property_id.value = "";
  syncMasterOptionSelects();
  syncPropertySubProjectOptions("", "");
  syncPropertyPaymentPlanOptions("");
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
  const row = event.target.closest(".admin-property[data-property-id]");
  const id = Number(event.target.dataset.id || row?.dataset.propertyId);
  if (!id) return;
  const property = adminState.properties.find((item) => Number(item.property_id) === id);
  if (!property) return;
  if (event.target.classList.contains("delete-listing")) {
    if (!window.confirm(`Delete “${property.title}”? This cannot be undone.`)) return;
    try {
      await api("delete_property", { property_id: id });
      if (Number(propertyForm.elements.property_id.value) === id) resetEditor();
      await loadProperties();
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }
  if (event.target.classList.contains("edit-listing") || (row && !event.target.closest("button,a,select,input"))) populateEditor(property);
});

document.querySelector("#adminPropertyList").addEventListener("keydown", (event) => {
  if (!['Enter', ' '].includes(event.key) || event.target.closest('button,a,select,input')) return;
  const row = event.target.closest(".admin-property[data-property-id]");
  const property = adminState.properties.find((item) => Number(item.property_id) === Number(row?.dataset.propertyId));
  if (property) { event.preventDefault(); populateEditor(property); }
});

document.querySelector("#cancelEdit").addEventListener("click", () => { resetEditor(); setAdminSubview("propertiesWorkspace", "list"); });

// Verify session with server on load. If not authenticated, redirect to main page where login resides.
;(async function initAdmin() {
  try {
    const session = window.HeeraAdminAPI?.bootstrap ? await window.HeeraAdminAPI.bootstrap() : await api('session');
    if (session?.csrf_token) {
      adminCsrfToken = session.csrf_token;
      window.HeeraAdminAPI?.setCsrfToken?.(session.csrf_token);
    }
    if (session && session.authenticated && session.user) {
      showDashboard(session.user);
      window.__HEERA_ADMIN_BOOTSTRAP__ = session;
      window.dispatchEvent(new CustomEvent('heera:admin-ready', { detail: session }));
    } else {
      window.location.href = 'index.html#admin-login';
      return;
    }
  } catch (err) {
    const msgEl = document.querySelector('#propertyMessage');
    if (msgEl) msgEl.textContent = 'Unable to connect to the Admin API: ' + (err.message || err);
    window.dispatchEvent(new CustomEvent('heera:admin-api-error', { detail: { message: err.message || String(err) } }));
    return;
  }
})();

propertyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fields = propertyForm.elements;
  const body = {};
  ["property_id", "project_id", "sub_project_id", "sub_project_name", "title", "price", "listing_type", "property_type", "status", "address_line1", "city", "state_region", "block_name", "postal_code", "bedrooms", "bathrooms", "area_sqft", "description", "size_label", "property_facing", "price_pkr", "price_per_marla", "publish_start_date", "publish_end_date"].forEach((field) => {
    body[field] = fields[field] ? fields[field].value.trim() : "";
  });
  body.payment_plan_id = fields.payment_plan_id ? fields.payment_plan_id.value.trim() : "";
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
    [adminState.projects] = await Promise.all([api("admin_projects"), loadMasterData().catch(() => [])]);
    propertyPlanCache.clear();
    renderProjectList();
    syncPropertyProjectOptions();
    syncSubProjectProjectOptions();
    syncPropertySubProjectOptions(null);
    syncPropertyPaymentPlanOptions(null);
  } catch (error) {
    document.querySelector("#projectMessage").textContent = error.message;
    document.querySelector("#projectMessage").classList.add("error");
  }
}

function syncPropertyProjectOptions() {
  const select = document.querySelector("#propertyProjectSelect");
  if (!select) return;
  const selected = select.value;
  const options = adminState.projects.map((project) => {
    const label = `${project.title}${project.status !== "published" ? " (Draft)" : ""}`;
    return `<option value="${Number(project.project_id)}">${escapeHtml(label)}</option>`;
  }).join("");
  select.innerHTML = `<option value="">No linked project</option>${options}`;
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

async function loadSubProjects(projectId = "") {
  try {
    const params = projectId ? { project_id: String(projectId) } : {};
    [adminState.subProjects] = await Promise.all([apiGet("admin_sub_projects", params), loadMasterData().catch(() => [])]);
    renderSubProjects();
    syncSubProjectProjectOptions();
    syncPropertySubProjectOptions(null);
  } catch (error) {
    const message = document.querySelector("#subProjectMessage");
    if (message) { message.textContent = error.message; message.classList.add("error"); }
  }
}

function subProjectsForProject(projectId) {
  return (adminState.subProjects || []).filter(item => Number(item.project_id) === Number(projectId));
}

function syncSubProjectProjectOptions() {
  const selects = [document.querySelector("#subProjectParentProject"), document.querySelector("#subProjectProjectFilter")].filter(Boolean);
  selects.forEach(select => {
    const selected = select.value;
    const first = select.id === "subProjectProjectFilter" ? '<option value="">All projects</option>' : '<option value="">Choose project</option>';
    select.innerHTML = first + adminState.projects.map(project => `<option value="${Number(project.project_id)}">${escapeHtml(project.title)}${project.status !== "published" ? " (Draft)" : ""}</option>`).join("");
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
  });
}

function renderSubProjects() {
  const list = document.querySelector("#adminSubProjectList");
  if (!list) return;
  const filter = document.querySelector("#subProjectProjectFilter")?.value || "";
  const items = filter ? adminState.subProjects.filter(item => String(item.project_id) === filter) : adminState.subProjects;
  const count = document.querySelector("#subProjectCount");
  if (count) count.textContent = `${items.length} sub-project${items.length === 1 ? "" : "s"}`;
  if (!items.length) { list.innerHTML = '<p class="empty-list">No sub-projects found. Create phases, blocks or plans under a parent project.</p>'; return; }
  list.innerHTML = items.map(item => `<article class="admin-property" data-sub-project-id="${Number(item.sub_project_id)}"><span class="login-user-avatar">SP</span><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.project_title || "Project")} · ${escapeHtml(item.status)}</p><strong>${Number(item.property_count || 0)} properties · ${Number(item.payment_plan_count || 0)} payment plans</strong></div><div class="admin-row-actions"><button class="edit-sub-project" data-id="${Number(item.sub_project_id)}" type="button">Edit</button><button class="delete-sub-project" data-id="${Number(item.sub_project_id)}" type="button">Delete</button></div></article>`).join("");
}

function resetSubProjectEditor() {
  const form = document.querySelector("#subProjectForm"); if (!form) return;
  form.reset(); form.elements.sub_project_id.value = ""; form.elements.sort_order.value = "0";
  syncMasterOptionSelects();
  document.querySelector("#subProjectEditorTitle").textContent = "Add a sub-project";
  document.querySelector("#cancelSubProjectEdit").hidden = true;
  document.querySelector("#subProjectMessage").textContent = "";
}

function populateSubProjectEditor(item) {
  setAdminSubview("subProjectsWorkspace", "form");
  const form = document.querySelector("#subProjectForm");
  syncMasterOptionSelects();
  setMasterSelectValue("#subProjectNameSelect", "subproject", item.name, "Choose sub-project name");
  ["sub_project_id","project_id","name","status","sort_order","description"].forEach(name => { form.elements[name].value = item[name] ?? ""; });
  document.querySelector("#subProjectEditorTitle").textContent = `Edit: ${item.name}`;
  document.querySelector("#cancelSubProjectEdit").hidden = false;
  document.querySelector("#subProjectMessage").textContent = "";
}

function syncPropertySubProjectOptions(preferredName = null, preferredSubProjectId = null) {
  const projectSelect = document.querySelector("#propertyProjectSelect");
  const input = document.querySelector("#propertySubProjectInput");
  const hiddenId = document.querySelector("#propertySubProjectId");
  const hint = document.querySelector("#propertySubProjectHint");
  if (!projectSelect || !input || !hiddenId) return;
  const projectId = projectSelect.value;
  const currentName = preferredName !== null ? String(preferredName || "") : input.value;
  const currentId = preferredSubProjectId !== null ? String(preferredSubProjectId || "") : hiddenId.value;
  if (!projectId) {
    input.innerHTML = '<option value="">Choose a linked project first</option>';
    input.value = "";
    input.disabled = true;
    hiddenId.value = "";
    if (hint) hint.textContent = "Choose a linked project first, then select a saved sub-project name.";
    return;
  }
  const items = subProjectsForProject(projectId);
  const masterNames = activeMasterOptions("subproject").map((item) => item.name);
  const names = [...new Set([...items.map((item) => item.name), ...masterNames])];
  if (currentName && !names.includes(currentName)) names.unshift(currentName);
  input.innerHTML = `<option value="">No sub-project</option>${names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  input.disabled = false;
  input.value = currentName;
  const match = items.find(item => String(item.sub_project_id) === currentId)
    || items.find(item => item.name.localeCompare(currentName, undefined, { sensitivity: "accent" }) === 0);
  hiddenId.value = match ? String(match.sub_project_id) : "";
  if (hint) hint.textContent = names.length ? "Select an existing project-linked or Master Data name." : "Add a sub-project name in Master Data first.";
}

function propertyPaymentPlanLabel(plan) {
  const parts = [plan?.plan_name || "Payment Plan", plan?.size_label || ""].filter(Boolean);
  if (plan?.total_price) parts.push(`PKR ${Number(plan.total_price).toLocaleString("en-PK")}`);
  return parts.join(" — ");
}

const propertyPlanCache = new Map();
function renderPropertyPaymentPlanPreview(plan) {
  const preview = document.querySelector("#propertyPaymentPlanPreview");
  if (!preview) return;
  if (!plan) { preview.hidden = true; preview.innerHTML = ""; return; }
  const pkr = (value) => value ? `PKR ${Number(value).toLocaleString("en-PK")}` : "—";
  preview.hidden = false;
  preview.innerHTML = `
    <div><span>Total price</span><strong>${escapeHtml(pkr(plan.total_price))}</strong></div>
    <div><span>Booking</span><strong>${escapeHtml(pkr(plan.booking_amount))}</strong></div>
    <div><span>Monthly</span><strong>${escapeHtml(plan.monthly_installment_count || "0")} × ${escapeHtml(pkr(plan.monthly_installment))}</strong></div>
    <div><span>Half-yearly</span><strong>${escapeHtml(plan.half_yearly_count || "0")} × ${escapeHtml(pkr(plan.half_yearly_installment))}</strong></div>
    <div><span>Possession</span><strong>${escapeHtml(pkr(plan.on_possession))}</strong></div>
    <div><span>Plan</span><strong>${escapeHtml(plan.plan_name || "Payment Plan")}${plan.size_label ? ` · ${escapeHtml(plan.size_label)}` : ""}</strong></div>`;
}

async function fetchPropertyPaymentPlans(projectId, subProjectId = "") {
  const key = `${String(projectId || "")}:${String(subProjectId || "")}`;
  if (!projectId) return [];
  if (propertyPlanCache.has(key)) return propertyPlanCache.get(key);
  let result;
  if (window.HeeraAdminAPI?.get) {
    result = await window.HeeraAdminAPI.get("admin_payment_plans", { project_id: String(projectId), ...(subProjectId ? { sub_project_id: String(subProjectId) } : {}) });
  } else {
    const response = await fetch(`api.php?action=admin_payment_plans&project_id=${encodeURIComponent(String(projectId))}${subProjectId ? `&sub_project_id=${encodeURIComponent(String(subProjectId))}` : ""}`, { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" });
    result = await response.json().catch(() => ({ error: "Invalid payment plan response." }));
    if (!response.ok) throw new Error(result.error || "Payment plans could not be loaded.");
  }
  const plans = Array.isArray(result) ? result : [];
  propertyPlanCache.set(key, plans);
  return plans;
}

async function syncPropertyPaymentPlanOptions(preferredPlanId = null) {
  const typeSelect = document.querySelector("#propertyListingType");
  const projectSelect = document.querySelector("#propertyProjectSelect");
  const planSelect = document.querySelector("#propertyPaymentPlanSelect");
  const wrapper = document.querySelector("#propertyPaymentPlanLink");
  const hint = document.querySelector("#propertyPaymentPlanHint");
  if (!typeSelect || !projectSelect || !planSelect || !wrapper) return;
  const isInstallment = typeSelect.value === "installment";
  wrapper.hidden = !isInstallment;
  renderPropertyPaymentPlanPreview(null);
  if (!isInstallment) {
    planSelect.innerHTML = '<option value="">No payment plan connected</option>';
    planSelect.value = "";
    planSelect.disabled = true;
    return;
  }
  const currentValue = preferredPlanId !== null ? String(preferredPlanId || "") : planSelect.value;
  const projectId = projectSelect.value;
  const subProjectId = document.querySelector("#propertySubProjectId")?.value || "";
  if (!projectId) {
    planSelect.innerHTML = '<option value="">Choose a project first</option>';
    planSelect.disabled = true;
    if (hint) hint.textContent = "Step 1: choose the linked project above. Step 2: select a payment plan here (optional).";
    return;
  }
  planSelect.innerHTML = '<option value="">Loading payment plans…</option>';
  planSelect.disabled = true;
  if (hint) hint.textContent = "Loading saved payment plans from the API…";
  try {
    const plans = await fetchPropertyPaymentPlans(projectId, subProjectId);
    if (!plans.length) {
      planSelect.innerHTML = '<option value="">No payment plans added to this project</option>';
      if (hint) hint.textContent = "This project has no structured payment plans yet. Add one in Projects → Edit Project.";
      return;
    }
    planSelect.disabled = false;
    planSelect.innerHTML = `<option value="">No payment plan connected (optional)</option>${plans.map((plan) => `<option value="${escapeHtml(plan.plan_id || "")}">${escapeHtml(propertyPaymentPlanLabel(plan))}</option>`).join("")}`;
    if ([...planSelect.options].some((option) => option.value === currentValue)) planSelect.value = currentValue;
    if (hint) hint.textContent = "Choose a saved plan if this property should advertise a specific installment schedule.";
    renderPropertyPaymentPlanPreview(plans.find((plan) => String(plan.plan_id) === planSelect.value) || null);
    planSelect.onchange = () => renderPropertyPaymentPlanPreview(plans.find((plan) => String(plan.plan_id) === planSelect.value) || null);
  } catch (error) {
    planSelect.innerHTML = '<option value="">Payment plans unavailable</option>';
    if (hint) hint.textContent = error.message;
  }
}

document.querySelector("#propertyListingType")?.addEventListener("change", () => syncPropertyPaymentPlanOptions(null));
document.querySelector("#propertyProjectSelect")?.addEventListener("change", () => { syncPropertySubProjectOptions("", ""); syncPropertyPaymentPlanOptions(null); });
document.querySelector("#propertySubProjectInput")?.addEventListener("change", () => { syncPropertySubProjectOptions(null, ""); syncPropertyPaymentPlanOptions(null); });
function projectMediaLines(project, type) {
  return (project.media || []).filter((media) => media.media_type === type).map((media) => media.file_path).join("\n");
}

// Project payment plans UI
function newPaymentPlanId() {
  if (window.crypto?.randomUUID) return `plan_${window.crypto.randomUUID().replace(/-/g, "")}`;
  return `plan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function createProjectPlanRow(planData) {
  const container = document.querySelector("#projectPaymentPlansContainer");
  const index = container.children.length;
  const row = document.createElement("div");
  row.className = "plan-row";
  row.dataset.index = index;
  const planId = String(planData?.plan_id || newPaymentPlanId());
  const projectId = document.querySelector("#projectForm")?.elements?.project_id?.value || 0;
  const availableSubProjects = subProjectsForProject(projectId);
  const linkedSubProject = availableSubProjects.find((item) => String(item.sub_project_id) === String(planData?.sub_project_id || ""));
  const subProjectName = String(planData?.sub_project_name || linkedSubProject?.name || "");
  const subProjectNames = [...new Set([...availableSubProjects.map((item) => item.name), ...activeMasterOptions("subproject").map((item) => item.name)])];
  if (subProjectName && !subProjectNames.includes(subProjectName)) subProjectNames.unshift(subProjectName);
  row.innerHTML = `
    <input type="hidden" name="project_plan_id_${index}" value="${escapeHtml(planId)}" />
    <div class="plan-row-header">
      <strong>Plan ${index + 1}</strong>
      <button type="button" class="remove-plan-btn" title="Remove this plan">×</button>
    </div>
    <div class="plan-fields">
      <label class="plan-name-field">Payment Plan Name<input name="project_plan_name_${index}" value="${escapeHtml(planData?.plan_name || "")}" placeholder="e.g. Executive Block Plan" required /></label>
      <label>Sub-Project name (optional)<select name="project_plan_sub_project_name_${index}"><option value="">No sub-project</option>${subProjectNames.map((name) => `<option value="${escapeHtml(name)}"${name === subProjectName ? " selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select><span class="field-hint">Names come from Master Data and this project's saved sub-projects.</span></label>
      <label>Size / Type<select class="payment-plan-size-select" name="project_plan_size_label_${index}">${masterOptionChoices("marla", planData?.size_label || "", "Choose Marla / size")}</select></label>
      <label>Booking<input name="project_plan_booking_${index}" type="number" min="0" value="${escapeHtml(planData?.booking_amount || "")}" placeholder="1000000" /></label>
      <label>Total Monthly Installments<input name="project_plan_monthly_count_${index}" type="number" min="0" step="1" value="${escapeHtml(planData?.monthly_installment_count || "")}" placeholder="42" /></label>
      <label>One Monthly Installment Amount<input name="project_plan_monthly_${index}" type="number" min="0" value="${escapeHtml(planData?.monthly_installment || "")}" placeholder="10000" /></label>
      <label>Total Half-Yearly Installments<input name="project_plan_half_count_${index}" type="number" min="0" step="1" value="${escapeHtml(planData?.half_yearly_count || "")}" placeholder="7" /></label>
      <label>One Half-Yearly Installment Amount<input name="project_plan_half_amount_${index}" type="number" min="0" value="${escapeHtml(planData?.half_yearly_installment || "")}" placeholder="105000" /></label>
      <label>On Possession<input name="project_plan_possession_${index}" type="number" min="0" value="${escapeHtml(planData?.on_possession || "")}" placeholder="350000" /></label>
      <label>Balloting Payment / Note<input name="project_plan_balloting_${index}" value="${escapeHtml(planData?.balloting || "")}" placeholder="195000 or On demand" /></label>
      <label>Other Payment<input name="project_plan_other_payment_${index}" type="number" min="0" value="${escapeHtml(planData?.other_payment || "")}" placeholder="250000" /></label>
      <label>Total Price<input name="project_plan_total_${index}" type="number" min="0" value="${escapeHtml(planData?.total_price || "")}" placeholder="3300000" /></label>
      <label>Full Payment Discount %<input name="project_plan_full_discount_${index}" type="number" min="0" max="100" step="0.01" value="${escapeHtml(planData?.full_payment_discount_percent || "")}" placeholder="10" /></label>
      <label>50% Payment Discount %<input name="project_plan_half_discount_${index}" type="number" min="0" max="100" step="0.01" value="${escapeHtml(planData?.half_payment_discount_percent || "")}" placeholder="5" /></label>
      <label>Preferred Location Charge %<input name="project_plan_location_charge_${index}" type="number" min="0" max="100" step="0.01" value="${escapeHtml(planData?.preferred_location_charge_percent || "")}" placeholder="10" /></label>
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
    const controls = row.querySelectorAll("input,select");
    controls.forEach((control) => { control.name = control.name.replace(/_\d+$/, `_${i}`); });
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
    const subProjectName = row.querySelector(`[name="project_plan_sub_project_name_${i}"]`)?.value?.trim() || "";
    const projectId = document.querySelector("#projectForm")?.elements?.project_id?.value || 0;
    const matchingSubProject = subProjectsForProject(projectId).find((item) => item.name.localeCompare(subProjectName, undefined, { sensitivity: "base" }) === 0);
    plans.push({
      plan_id: row.querySelector(`[name="project_plan_id_${i}"]`)?.value?.trim() || newPaymentPlanId(),
      plan_name: row.querySelector(`[name="project_plan_name_${i}"]`)?.value?.trim() || "Payment Plans",
      sub_project_id: matchingSubProject ? String(matchingSubProject.sub_project_id) : "",
      sub_project_name: subProjectName,
      size_label: sizeLabel,
      booking_amount: row.querySelector(`[name="project_plan_booking_${i}"]`)?.value?.trim() || "",
      monthly_installment_count: row.querySelector(`[name="project_plan_monthly_count_${i}"]`)?.value?.trim() || "",
      monthly_installment: row.querySelector(`[name="project_plan_monthly_${i}"]`)?.value?.trim() || "",
      half_yearly_count: row.querySelector(`[name="project_plan_half_count_${i}"]`)?.value?.trim() || "",
      half_yearly_installment: row.querySelector(`[name="project_plan_half_amount_${i}"]`)?.value?.trim() || "",
      on_possession: row.querySelector(`[name="project_plan_possession_${i}"]`)?.value?.trim() || "",
      balloting: row.querySelector(`[name="project_plan_balloting_${i}"]`)?.value?.trim() || "",
      other_payment: row.querySelector(`[name="project_plan_other_payment_${i}"]`)?.value?.trim() || "",
      total_price: row.querySelector(`[name="project_plan_total_${i}"]`)?.value?.trim() || "",
      full_payment_discount_percent: row.querySelector(`[name="project_plan_full_discount_${i}"]`)?.value?.trim() || "",
      half_payment_discount_percent: row.querySelector(`[name="project_plan_half_discount_${i}"]`)?.value?.trim() || "",
      preferred_location_charge_percent: row.querySelector(`[name="project_plan_location_charge_${i}"]`)?.value?.trim() || ""
    });
  });
  return plans;
}

function syncProjectSubProjectNameOptions(project = null) {
  const select = document.querySelector("#projectSubProjectName");
  if (!select) return;
  const selected = project?.plan_name || project?.sub_projects?.[0]?.name || select.value;
  select.innerHTML = masterOptionChoices("subproject", selected, "No sub-project");
  select.value = selected || "";
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
      <div><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.location)} · ${escapeHtml(project.status)}</p><strong>${escapeHtml(project.category)} · ${Number(project.sub_projects?.length || 0)} sub-projects</strong></div>
      <div class="admin-row-actions"><button type="button" class="edit-project" data-id="${project.project_id}">Edit</button><button type="button" class="delete-project" data-id="${project.project_id}">Delete</button></div>
    </article>`;
  }).join("");
}

function populateProjectEditor(project) {
  setAdminSubview("projectsWorkspace", "form");
  syncMasterOptionSelects();
  setMasterSelectValue("#projectNameSelect", "project", project.title, "Choose project name");
  setMasterSelectValue("#projectSubProjectName", "subproject", project.plan_name || project.sub_projects?.[0]?.name || "", "No sub-project");
  const fields = document.querySelector("#projectForm").elements;
  ["project_id", "title", "plan_name", "category", "location", "status", "hero_image_url", "headline", "description"].forEach((field) => {
    fields[field].value = project[field] ?? "";
  });
  fields.plan_name.value = project.plan_name || project.sub_projects?.[0]?.name || "";
  syncProjectSubProjectNameOptions(project);
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
  syncMasterOptionSelects();
  form.elements.project_id.value = "";
  syncProjectSubProjectNameOptions(null);
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

// Important-update management (stored in the legacy popup_ads table for compatibility).
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
  if (!popups.length) { container.innerHTML = '<p class="empty-list">No important updates yet. Use the form above to add one.</p>'; return; }
  container.innerHTML = popups.map((p) => {
    const summary = String(p.html_content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return `<article class="admin-property"><span class="admin-popup-type-preview">Update</span><div><h3>${escapeHtml(p.headline || 'Important update')}</h3><p>${escapeHtml(summary || p.link_url || '')}</p><strong>Order ${Number(p.sort_order || 0)}</strong><small style="color:${Number(p.is_published) ? 'green' : 'gray'}">${Number(p.is_published) ? '● Published' : '○ Draft'}</small></div><div class="admin-row-actions"><button type="button" class="edit-popup" data-id="${p.popup_id}">Edit</button><button type="button" class="delete-popup" data-id="${p.popup_id}">Delete</button></div></article>`;
  }).join('');
}

function populateHomePopupEditor(popup) {
  const form = document.querySelector('#homePopupForm');
  form.elements.popup_id.value = popup.popup_id || '';
  form.elements.link_url.value = popup.link_url || '';
  form.elements.headline.value = popup.headline || '';
  form.elements.html_content.value = popup.html_content || '';
  form.elements.sort_order.value = popup.sort_order || '0';
  form.elements.is_published.checked = !!Number(popup.is_published);
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
    if (!window.confirm('Delete this important update?')) return;
    try {
      await api('delete_popup', { popup_id: id });
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
    popup_type: 'content',
    image_url: '',
    video_url: '',
    link_url: fields.link_url.value.trim(),
    headline: fields.headline.value.trim(),
    html_content: fields.html_content.value.trim(),
    sort_order: fields.sort_order.value,
    is_published: fields.is_published.checked ? 1 : 0
  };
  const msg = document.querySelector('#homePopupMessage');
  msg.classList.remove('error');
  msg.textContent = 'Saving…';
  try {
    await api('save_popup', body);
    msg.textContent = 'Important update saved.';
    await loadAdminPopups();
    form.reset();
    form.elements.sort_order.value = '0';
    form.elements.is_published.checked = true;
  } catch (error) { msg.textContent = error.message; msg.classList.add('error'); }
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

document.querySelector("#subProjectProjectFilter")?.addEventListener("change", renderSubProjects);
document.querySelector("#cancelSubProjectEdit")?.addEventListener("click", () => { resetSubProjectEditor(); setAdminSubview("subProjectsWorkspace", "list"); });
document.querySelector("#adminSubProjectList")?.addEventListener("click", async event => {
  const id = Number(event.target.dataset.id || event.target.closest("[data-sub-project-id]")?.dataset.subProjectId);
  const item = adminState.subProjects.find(entry => Number(entry.sub_project_id) === id);
  if (!item) return;
  if (event.target.classList.contains("edit-sub-project")) populateSubProjectEditor(item);
  if (event.target.classList.contains("delete-sub-project")) {
    if (!confirm(`Delete sub-project “${item.name}”? Linked properties/payment plans will be kept but unlinked.`)) return;
    try { await api("delete_sub_project", { sub_project_id: id }); await loadSubProjects(); propertyPlanCache.clear(); resetSubProjectEditor(); }
    catch (error) { alert(error.message); }
  }
});
document.querySelector("#subProjectForm")?.addEventListener("submit", async event => {
  event.preventDefault(); const f=event.currentTarget.elements, message=document.querySelector("#subProjectMessage");
  message.classList.remove("error"); message.textContent="Saving sub-project…";
  try { await api("save_sub_project", { sub_project_id:f.sub_project_id.value, project_id:f.project_id.value, name:f.name.value.trim(), status:f.status.value, sort_order:f.sort_order.value, description:f.description.value.trim() }); await loadSubProjects(); await loadProjects(); propertyPlanCache.clear(); resetSubProjectEditor(); message.textContent="Sub-project saved."; }
  catch(error){ message.textContent=error.message; message.classList.add("error"); }
});

async function loadRoles() {
  try {
    const result = await api("admin_roles");
    adminState.roles = Array.isArray(result?.roles) ? result.roles : [];
    adminState.permissions = Array.isArray(result?.permissions) ? result.permissions : [];
    renderRoles(); syncLoginRoleOptions(); renderRolePermissionGrid([]);
  } catch (error) {
    const message=document.querySelector("#roleMessage"); if(message){message.textContent=error.message;message.classList.add("error");}
  }
}
function syncLoginRoleOptions(preferred = null) {
  const select=document.querySelector("#loginUserRoleSelect"); if(!select)return;
  const selected=preferred!==null?String(preferred||""):select.value;
  select.innerHTML='<option value="">Choose role</option>'+adminState.roles.map(role=>`<option value="${Number(role.role_id)}">${escapeHtml(role.name)}</option>`).join("");
  if([...select.options].some(option=>option.value===selected))select.value=selected;
}
function renderRoles(){
  const list=document.querySelector("#adminRoleList");if(!list)return;
  document.querySelector("#roleCount").textContent=`${adminState.roles.length} role${adminState.roles.length===1?"":"s"}`;
  if(!adminState.roles.length){list.innerHTML='<p class="empty-list">No roles found.</p>';return;}
  list.innerHTML=adminState.roles.map(role=>`<article class="admin-property"><span class="login-user-avatar"><i class="ti ti-lock-access"></i></span><div><h3>${escapeHtml(role.name)}</h3><p>${escapeHtml(role.description||role.role_key)}</p><strong>${Number(role.user_count||0)} users · ${role.permissions?.length||0} permissions</strong><div class="role-permission-summary">${(role.permissions||[]).slice(0,6).map(p=>`<span class="role-permission-chip">${escapeHtml(p)}</span>`).join("")}${(role.permissions||[]).length>6?`<span class="role-permission-chip">+${(role.permissions||[]).length-6}</span>`:""}</div></div><div class="admin-row-actions"><button class="edit-role" data-id="${Number(role.role_id)}" type="button">Edit</button>${Number(role.is_system)?"":`<button class="delete-role" data-id="${Number(role.role_id)}" type="button">Delete</button>`}</div></article>`).join("");
}
function renderRolePermissionGrid(selected=[]){
  const grid=document.querySelector("#rolePermissionGrid");if(!grid)return;const chosen=new Set(selected||[]);const groups={};
  adminState.permissions.forEach(permission=>{(groups[permission.module_name]??=[]).push(permission);});
  grid.innerHTML=Object.entries(groups).map(([module,permissions])=>`<section class="permission-module" data-permission-module="${escapeHtml(module)}"><div class="permission-module__heading"><h4>${escapeHtml(module)}</h4><button class="permission-module-toggle" type="button" data-permission-module-toggle="${escapeHtml(module)}">Select module</button></div><div class="permission-module__items">${permissions.map(permission=>`<label class="permission-check"><input type="checkbox" name="permissions" value="${escapeHtml(permission.permission_key)}"${chosen.has(permission.permission_key)?" checked":""}><span><strong>${escapeHtml(permission.label)}</strong><br><small>${escapeHtml(permission.permission_key)}</small></span></label>`).join("")}</div></section>`).join("");
  updatePermissionSelectionCount();
}
function updatePermissionSelectionCount(){const form=document.querySelector("#roleForm"),output=document.querySelector("#permissionSelectionCount");if(!form||!output)return;const checked=form.querySelectorAll('input[name="permissions"]:checked').length,total=form.querySelectorAll('input[name="permissions"]').length;output.textContent=`${checked} of ${total} selected`;}
function resetRoleEditor(){const form=document.querySelector("#roleForm");if(!form)return;form.reset();form.elements.role_id.value="";document.querySelector("#roleEditorTitle").textContent="Create a role";document.querySelector("#cancelRoleEdit").hidden=true;renderRolePermissionGrid([]);document.querySelector("#roleMessage").textContent="";}
function populateRoleEditor(role){const form=document.querySelector("#roleForm");form.elements.role_id.value=role.role_id;form.elements.name.value=role.name||"";form.elements.role_key.value=role.role_key||"";form.elements.description.value=role.description||"";document.querySelector("#roleEditorTitle").textContent=`Edit: ${role.name}`;document.querySelector("#cancelRoleEdit").hidden=false;renderRolePermissionGrid(role.permissions||[]);}
document.querySelector("#cancelRoleEdit")?.addEventListener("click",resetRoleEditor);
document.querySelector("#roleForm")?.addEventListener("change",updatePermissionSelectionCount);
document.querySelector("#roleForm")?.addEventListener("click",event=>{
  const actionButton=event.target.closest("button[data-permission-action]");
  if(actionButton){
    const action=actionButton.dataset.permissionAction;
    document.querySelectorAll('#rolePermissionGrid input[name="permissions"]').forEach(input=>{
      input.checked=action==='all'||(action==='view'&&(input.value.endsWith('.view')||input.value==='system.health'));
    });
    updatePermissionSelectionCount();
    return;
  }
  const moduleButton=event.target.closest("button[data-permission-module-toggle]");
  if(moduleButton){
    const section=moduleButton.closest('.permission-module'),inputs=[...section.querySelectorAll('input[name="permissions"]')];
    const select=inputs.some(input=>!input.checked);inputs.forEach(input=>{input.checked=select;});
    moduleButton.textContent=select?'Clear module':'Select module';updatePermissionSelectionCount();
  }
});
document.querySelector("#adminRoleList")?.addEventListener("click",async event=>{const id=Number(event.target.dataset.id),role=adminState.roles.find(r=>Number(r.role_id)===id);if(!role)return;if(event.target.classList.contains("edit-role"))populateRoleEditor(role);if(event.target.classList.contains("delete-role")){if(!confirm(`Delete role “${role.name}”?`))return;try{await api("delete_role",{role_id:id});await loadRoles();resetRoleEditor();}catch(error){alert(error.message);}}});
document.querySelector("#roleForm")?.addEventListener("submit",async event=>{event.preventDefault();const f=event.currentTarget.elements,message=document.querySelector("#roleMessage");const permissions=[...event.currentTarget.querySelectorAll('input[name="permissions"]:checked')].map(input=>input.value);message.classList.remove("error");message.textContent="Saving role…";try{await api("save_role",{role_id:f.role_id.value,name:f.name.value.trim(),role_key:f.role_key.value.trim(),description:f.description.value.trim(),permissions});await loadRoles();resetRoleEditor();message.textContent="Role permissions saved.";}catch(error){message.textContent=error.message;message.classList.add("error");}});

async function loadLoginUsers() {
  try {
    adminState.loginUsers = await api("admin_login_users");
    try {
      const options = await api("admin_role_options");
      if (Array.isArray(options) && options.length) {
        const fullRoles = new Map((adminState.roles || []).map(role => [String(role.role_id), role]));
        adminState.roles = options.map(role => fullRoles.get(String(role.role_id)) || role);
      }
    } catch (_) { /* role options are convenience data; user list can still render */ }
    renderLoginUsers(); syncLoginRoleOptions();
  }
  catch (error) { document.querySelector("#loginUserMessage").textContent = error.message; }
}
function renderLoginUsers() {
  const list=document.querySelector("#adminLoginUserList"), items=adminState.loginUsers||[];
  document.querySelector("#loginUserCount").textContent=`${items.length} user${items.length===1?"":"s"}`;
  if(!items.length){list.innerHTML='<p class="empty-list">No login users found.</p>';return;}
  list.innerHTML=items.map(item=>`<article class="admin-property login-user-item"><span class="login-user-avatar">${escapeHtml((item.full_name||"U").charAt(0).toUpperCase())}</span><div><h3>${escapeHtml(item.full_name)}</h3><p>${escapeHtml(item.email||item.phone||item.username||"")}</p><strong>${escapeHtml(item.user_type === "admin" ? (item.role_name || "Admin") : "Client")} · ${Number(item.is_active)?"Active":"Disabled"}</strong></div><div class="admin-row-actions"><button class="edit-login-user" data-type="${item.user_type}" data-id="${item.user_id}" type="button">Edit / Reset</button><button class="delete-login-user" data-type="${item.user_type}" data-id="${item.user_id}" type="button">Delete</button></div></article>`).join("");
}
function syncLoginUserType(){const form=document.querySelector("#loginUserForm");const admin=form.elements.user_type.value==="admin";form.querySelector(".admin-username-field").hidden=!admin;form.querySelector(".admin-role-field").hidden=!admin;if(admin)syncLoginRoleOptions(form.elements.role_id?.value||"");}
function resetLoginUserEditor(){const form=document.querySelector("#loginUserForm");form.reset();form.elements.user_id.value="";form.elements.is_active.checked=true;form.elements.user_type.disabled=false;document.querySelector("#loginUserEditorTitle").textContent="Add a login user";document.querySelector("#saveLoginUserButton").innerHTML='Save user <span>→</span>';document.querySelector("#cancelLoginUserEdit").hidden=true;syncLoginUserType();}
function populateLoginUserEditor(item){setAdminSubview("loginUsersWorkspace","form");const form=document.querySelector("#loginUserForm");["user_id","user_type","full_name","email","phone","username"].forEach(name=>{form.elements[name].value=item[name]??"";});syncLoginRoleOptions(item.role_id||"");form.elements.new_password.value="";form.elements.is_active.checked=!!Number(item.is_active);form.elements.user_type.disabled=true;document.querySelector("#loginUserEditorTitle").textContent=`Edit: ${item.full_name}`;document.querySelector("#saveLoginUserButton").innerHTML='Save / reset password <span>→</span>';document.querySelector("#cancelLoginUserEdit").hidden=false;syncLoginUserType();}
document.querySelector("#loginUserForm").elements.user_type.addEventListener("change",syncLoginUserType);
document.querySelector("#cancelLoginUserEdit").addEventListener("click",()=>{resetLoginUserEditor();setAdminSubview("loginUsersWorkspace","list");});
document.querySelector("#adminLoginUserList").addEventListener("click",async event=>{const id=Number(event.target.dataset.id),type=event.target.dataset.type,item=adminState.loginUsers.find(user=>Number(user.user_id)===id&&user.user_type===type);if(event.target.classList.contains("edit-login-user")&&item)populateLoginUserEditor(item);if(event.target.classList.contains("delete-login-user")&&item){if(!confirm(`Delete login account for “${item.full_name}”?`))return;try{await api("delete_login_user",{user_id:id,user_type:type});await loadLoginUsers();resetLoginUserEditor();}catch(error){alert(error.message);}}});
document.querySelector("#loginUserForm").addEventListener("submit",async event=>{event.preventDefault();const f=event.currentTarget.elements,message=document.querySelector("#loginUserMessage");message.classList.remove("error");message.textContent="Saving user…";try{await api("save_login_user",{user_id:f.user_id.value,user_type:f.user_type.value,full_name:f.full_name.value.trim(),email:f.email.value.trim(),phone:f.phone.value.trim(),username:f.username.value.trim(),role_id:f.role_id?.value||"",new_password:f.new_password.value,is_active:f.is_active.checked?1:0});await loadLoginUsers();resetLoginUserEditor();message.textContent="Login user saved securely.";}catch(error){message.textContent=error.message;message.classList.add("error");}});

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

async function loadDigitalMaps(selectedMapId = null) {
  const message = document.querySelector("#digitalMapMessage");
  try { [adminState.digitalMaps] = await Promise.all([api("admin_digital_maps"), loadMasterData().catch(() => [])]); renderDigitalMaps(selectedMapId); }
  catch (error) { if (message) message.textContent = error.message; }
}
function renderDigitalMaps(selectedMapId = null) {
  const maps=adminState.digitalMaps||[],list=document.querySelector("#adminDigitalMapList");
  document.querySelector("#digitalMapCount").textContent=`${maps.length} map${maps.length===1?"":"s"}`;
  list.innerHTML=maps.length?maps.map(map=>{const preview=map.map_image?`<img class="digital-map-preview" src="${escapeHtml(map.map_image)}" alt="">`:'<span class="admin-popup-type-preview">PDF</span>';const format=map.map_image?(map.original_pdf?'Image + PDF':'Image only'):'PDF only';const dimensions=Number(map.original_width)&&Number(map.original_height)?`${map.original_width} × ${map.original_height}`:format;const pdfLink=String(map.original_pdf||"").startsWith("maps/")?`<a href="${escapeHtml(map.original_pdf)}" target="_blank" rel="noopener">Open PDF</a>`:"";return `<article class="admin-property">${preview}<div><h3>${escapeHtml(map.name)}</h3><p>${escapeHtml(dimensions)}</p><strong>${map.blocks.length} block${map.blocks.length===1?"":"s"} · ${Number(map.is_active)?"Published":"Hidden"}</strong></div><div class="admin-row-actions">${pdfLink}<button class="edit-digital-map" data-id="${map.map_id}" type="button">Edit</button><button class="delete-digital-map" data-id="${map.map_id}" type="button">Delete</button></div></article>`;}).join(""):'<p class="empty-list">No digital maps have been added.</p>';
  const select=document.querySelector("#digitalMapBlockMap"),previous=selectedMapId||Number(select.value)||maps[0]?.map_id||"";select.innerHTML='<option value="">Choose a map</option>'+maps.map(map=>`<option value="${map.map_id}">${escapeHtml(map.name)}</option>`).join("");if(maps.some(map=>Number(map.map_id)===Number(previous)))select.value=String(previous);renderDigitalMapBlocks();
}
function renderDigitalMapBlocks(){const mapId=Number(document.querySelector("#digitalMapBlockMap").value),map=adminState.digitalMaps.find(item=>Number(item.map_id)===mapId),container=document.querySelector("#digitalMapBlockList");container.innerHTML=map?(map.blocks.length?map.blocks.map(block=>`<span class="map-block-chip">${escapeHtml(block.name)}<button type="button" class="delete-digital-map-block" data-id="${block.block_id}" aria-label="Delete ${escapeHtml(block.name)}">×</button></span>`).join(""):'<p class="empty-list">No blocks yet. Add the first block above.</p>'):'<p class="empty-list">Choose a map to manage its blocks.</p>';}
function resetDigitalMapEditor(){const form=document.querySelector("#digitalMapForm");form.reset();form.elements.map_id.value="";form.elements.is_active.checked=true;syncMasterOptionSelects();document.querySelector("#digitalMapEditorTitle").textContent="Add a map";document.querySelector("#cancelDigitalMapEdit").hidden=true;document.querySelector("#digitalMapCurrentFiles").textContent="";document.querySelector("#saveDigitalMapButton").innerHTML='Save map <span>→</span>';}
function editDigitalMap(map){const form=document.querySelector("#digitalMapForm");setMasterSelectValue("#digitalMapProjectNameSelect","project",map.name,"Choose project name");form.elements.map_id.value=map.map_id;form.elements.name.value=map.name;form.elements.is_active.checked=!!Number(map.is_active);document.querySelector("#digitalMapEditorTitle").textContent=`Edit: ${map.name}`;document.querySelector("#cancelDigitalMapEdit").hidden=false;document.querySelector("#saveDigitalMapButton").innerHTML='Save changes <span>→</span>';const files=document.querySelector("#digitalMapCurrentFiles"),parts=[];if(map.map_image)parts.push(`<a href="${escapeHtml(map.map_image)}" target="_blank" rel="noopener">Open current image</a>`);if(map.original_pdf)parts.push(`<a href="${escapeHtml(map.original_pdf)}" target="_blank" rel="noopener">Open current PDF</a>`);if(map.plot_index_file)parts.push("Automatic plot index saved");files.innerHTML=parts.length?parts.join(" · "):"No files saved yet.";document.querySelector("#digitalMapBlockMap").value=String(map.map_id);renderDigitalMapBlocks();}
document.querySelector("#cancelDigitalMapEdit").addEventListener("click",resetDigitalMapEditor);
document.querySelector("#digitalMapBlockMap").addEventListener("change",renderDigitalMapBlocks);
document.querySelector("#digitalMapForm").addEventListener("submit",async event=>{event.preventDefault();const form=event.currentTarget,message=document.querySelector("#digitalMapMessage"),button=document.querySelector("#saveDigitalMapButton"),data=new FormData(form),hasPdf=!!form.elements.original_pdf?.files?.length,hasImage=!!form.elements.map_image?.files?.length;message.classList.remove("error");message.textContent="Uploading and saving map…";button.disabled=true;try{const result=await api("save_digital_map",data,true);await loadDigitalMaps(result.map_id);resetDigitalMapEditor();message.textContent=hasPdf&&hasImage?"Map image and PDF uploaded and saved.":hasPdf?"Map PDF uploaded and saved.":hasImage?"Map image uploaded and saved.":"Digital map changes saved.";}catch(error){message.textContent=error.message;message.classList.add("error");}finally{button.disabled=false;}});
document.querySelector("#adminDigitalMapList").addEventListener("click",async event=>{const id=Number(event.target.dataset.id),map=adminState.digitalMaps.find(item=>Number(item.map_id)===id);if(event.target.classList.contains("edit-digital-map")&&map)editDigitalMap(map);if(event.target.classList.contains("delete-digital-map")&&map){if(!confirm(`Delete “${map.name}” and its block list?`))return;try{await api("delete_digital_map",{map_id:id});await loadDigitalMaps();resetDigitalMapEditor();}catch(error){alert(error.message);}}});
document.querySelector("#digitalMapBlockForm").addEventListener("submit",async event=>{event.preventDefault();const f=event.currentTarget.elements,message=document.querySelector("#digitalMapBlockMessage"),mapId=Number(f.map_id.value);message.textContent="Adding block…";try{await api("save_digital_map_block",{map_id:mapId,name:f.name.value.trim()});f.name.value="";await loadDigitalMaps(mapId);message.textContent="Block added manually.";}catch(error){message.textContent=error.message;}});
document.querySelector("#digitalMapBlockList").addEventListener("click",async event=>{if(!event.target.classList.contains("delete-digital-map-block"))return;const mapId=Number(document.querySelector("#digitalMapBlockMap").value);if(!confirm("Delete this block name?"))return;try{await api("delete_digital_map_block",{block_id:Number(event.target.dataset.id)});await loadDigitalMaps(mapId);}catch(error){alert(error.message);}});

[["listingCount","dashPropertyCount"],["projectCount","dashProjectCount"],["submissionCount","dashSubmissionCount"],["loginUserCount","dashUserCount"]].forEach(([sourceId,targetId])=>{const source=document.getElementById(sourceId),target=document.getElementById(targetId);if(!source||!target)return;const sync=()=>{target.textContent=(source.textContent.match(/\d+/)||["0"])[0];};new MutationObserver(sync).observe(source,{childList:true,characterData:true,subtree:true});sync();});
