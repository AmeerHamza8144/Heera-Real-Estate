const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const safeUrl = (value) => {
  const url = String(value || "").trim();
  if (url.startsWith("uploads/")) return url;
  try { return ["http:", "https:"].includes(new URL(url).protocol) ? url : ""; } catch { return ""; }
};
const projectId = Number(window.__PROJECT_DATA__?.project_id || new URLSearchParams(window.location.search).get("id"));
const projectSlug = String(window.__PROJECT_DATA__?.slug || new URLSearchParams(window.location.search).get("slug") || "");
const requestedSubProjectId = Number(window.__PROJECT_DATA__?.selected_sub_project?.sub_project_id || new URLSearchParams(window.location.search).get("sub_project_id") || 0);
const requestedSubProjectSlug = String(window.__PROJECT_DATA__?.selected_sub_project?.slug || new URLSearchParams(window.location.search).get("sub_project_slug") || "");

function renderMedia(container, items, kind, emptyText) {
  const selected = items.filter((item) => item.media_type === kind && safeUrl(item.file_path));
  if (!selected.length) { container.innerHTML = `<p class="media-empty">${emptyText}</p>`; return; }
  container.innerHTML = selected.map((item) => {
    const source = safeUrl(item.file_path);
    const image = `<img src="${escapeHtml(source)}" alt="${escapeHtml(item.caption || "Project " + kind)}" loading="lazy" />`;
    return `<figure class="${kind === "plan" ? "plan-tile" : ""}">${kind === "gallery" ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener" aria-label="Open full-size project image">${image}</a>` : image}${item.caption ? `<p>${escapeHtml(item.caption)}</p>` : ""}</figure>`;
  }).join("");
}

function projectPropertyPrice(property) {
  const pkr = Number(property.price_pkr || 0);
  if (pkr > 0) return `PKR ${Math.round(pkr).toLocaleString("en-PK")}`;
  const legacy = Number(property.price || 0);
  return legacy > 0 ? `$${Math.round(legacy).toLocaleString("en-US")}` : "Price on request";
}

function renderProjectProperties(container, properties) {
  const section = document.querySelector("#propertiesSection");
  const rows = Array.isArray(properties) ? properties : [];
  if (!container || !section) return;
  section.hidden = rows.length === 0;
  container.innerHTML = rows.map((property) => {
    const href = property.slug ? `property/${encodeURIComponent(property.slug)}` : `property.php?id=${Number(property.property_id)}`;
    const image = safeUrl(property.image_url);
    const meta = [property.block_name, property.size_label, property.city].filter(Boolean).map(escapeHtml).join(" · ");
    return `<article class="project-property-card">
      <a class="project-property-image" href="${href}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(property.title || "Property")}" loading="lazy">` : "<span>No image uploaded</span>"}</a>
      <div><p class="eyebrow">${escapeHtml(property.listing_type === "rent" ? "For rent" : property.listing_type === "installment" ? "On installments" : "For sale")}</p><h3><a href="${href}">${escapeHtml(property.title || "Property")}</a></h3>${meta ? `<p>${meta}</p>` : ""}<strong>${escapeHtml(projectPropertyPrice(property))}</strong></div>
    </article>`;
  }).join("");
}

function paymentNumber(value) {
  const raw = String(value ?? "").trim();
  if (!/^(?:PKR\s*)?[0-9][0-9,]*(?:\.[0-9]+)?$/i.test(raw)) return 0;
  const normalized = raw.replace(/^PKR\s*/i, "").replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function formatPkr(value) {
  return `PKR ${Math.round(Number(value) || 0).toLocaleString("en-PK")}`;
}

function formatPlanTableValue(value, isMoney = false) {
  if (value === null || value === undefined || String(value).trim() === "") return "—";
  const number = paymentNumber(value);
  return isMoney && number ? formatPkr(number) : String(value);
}

function installmentCalculatorMarkup(plans) {
  const options = plans.map((plan, index) => {
    const label = [plan.plan_name || "Payment Plan", plan.size_label || `Option ${index + 1}`].filter(Boolean).join(" — ");
    return `<option value="${index}">${escapeHtml(label)}</option>`;
  }).join("");
  return `<article class="installment-calculator" data-installment-calculator>
    <div class="calculator-heading">
      <div><p class="eyebrow">Payment estimator</p><h3>Installment Calculator</h3><p>Select a saved plan or adjust the figures to calculate the complete schedule.</p></div>
      <label class="calculator-plan-select">Payment plan<select data-calc-plan>${options}</select></label>
    </div>
    <div class="calculator-fields">
      <label>Total price (PKR)<input data-calc-field="total_price" type="number" min="0" step="1" inputmode="decimal"></label>
      <label>Down payment (PKR)<input data-calc-field="booking_amount" type="number" min="0" step="1" inputmode="decimal"></label>
      <label>Total monthly installments<input data-calc-field="monthly_installment_count" type="number" min="0" step="1" inputmode="numeric"></label>
      <label>One monthly installment (PKR)<input data-calc-field="monthly_installment" type="number" min="0" step="1" inputmode="decimal"></label>
      <label>Total half-yearly installments<input data-calc-field="half_yearly_count" type="number" min="0" step="1" inputmode="numeric"></label>
      <label>One half-yearly installment (PKR)<input data-calc-field="half_yearly_installment" type="number" min="0" step="1" inputmode="decimal"></label>
      <label>Balloting payment (PKR)<input data-calc-field="balloting" type="number" min="0" step="1" inputmode="decimal"></label>
      <label>On possession (PKR)<input data-calc-field="on_possession" type="number" min="0" step="1" inputmode="decimal"></label>
      <label>Other payment (PKR)<input data-calc-field="other_payment" type="number" min="0" step="1" inputmode="decimal"></label>
    </div>
    <div class="calculator-adjustments">
      <label>Payment discount<select data-calc-discount><option value="0">No discount</option></select></label>
      <label class="calculator-check" data-location-charge-wrap hidden><input data-calc-location-charge type="checkbox"><span data-location-charge-label>Apply preferred-location charge</span></label>
    </div>
    <div class="calculator-results" aria-live="polite">
      <div><span>Monthly installments total</span><strong data-calc-result="monthly_total">PKR 0</strong></div>
      <div><span>Half-yearly installments total</span><strong data-calc-result="half_yearly_total">PKR 0</strong></div>
      <div><span>Discount</span><strong data-calc-result="discount">PKR 0</strong></div>
      <div><span>Location charge</span><strong data-calc-result="location_charge">PKR 0</strong></div>
      <div class="calculator-result-primary"><span>Adjusted total price</span><strong data-calc-result="adjusted_total">PKR 0</strong></div>
      <div class="calculator-result-primary"><span>Total scheduled payments</span><strong data-calc-result="scheduled_total">PKR 0</strong></div>
      <div class="calculator-result-balance"><span data-calc-balance-label>Remaining balance</span><strong data-calc-result="balance">PKR 0</strong></div>
    </div>
    <div class="calculator-progress" aria-hidden="true"><span data-calc-progress></span></div>
    <p class="calculator-note">This calculation is an estimate. Confirm the final price, charges and payment dates with Heera Estate.</p>
    <div class="calculator-actions"><button type="button" class="button button-outline" data-calc-reset>Reset selected plan</button><button type="button" class="button button-primary" data-calc-copy>Copy calculation</button></div>
  </article>`;
}

function initializeInstallmentCalculator(container, plans, project) {
  const calculator = container.querySelector("[data-installment-calculator]");
  if (!calculator || !plans.length) return;
  const planSelect = calculator.querySelector("[data-calc-plan]");
  const discountSelect = calculator.querySelector("[data-calc-discount]");
  const locationInput = calculator.querySelector("[data-calc-location-charge]");
  const locationWrap = calculator.querySelector("[data-location-charge-wrap]");
  const locationLabel = calculator.querySelector("[data-location-charge-label]");
  const fields = Object.fromEntries([...calculator.querySelectorAll("[data-calc-field]")].map((input) => [input.dataset.calcField, input]));
  let locationRate = 0;
  let calculationText = "";

  const fieldValue = (name) => Math.max(0, Number(fields[name]?.value || 0));
  const setResult = (name, value) => { const output = calculator.querySelector(`[data-calc-result="${name}"]`); if (output) output.textContent = formatPkr(value); };

  function calculate() {
    const totalPrice = fieldValue("total_price");
    const downPayment = fieldValue("booking_amount");
    const monthlyCount = Math.floor(fieldValue("monthly_installment_count"));
    const monthlyAmount = fieldValue("monthly_installment");
    const halfYearlyCount = Math.floor(fieldValue("half_yearly_count"));
    const halfYearlyAmount = fieldValue("half_yearly_installment");
    const monthlyTotal = monthlyCount * monthlyAmount;
    const halfYearlyTotal = halfYearlyCount * halfYearlyAmount;
    const balloting = fieldValue("balloting");
    const possession = fieldValue("on_possession");
    const otherPayment = fieldValue("other_payment");
    const scheduledTotal = downPayment + monthlyTotal + halfYearlyTotal + balloting + possession + otherPayment;
    const baseTotal = totalPrice || scheduledTotal;
    const discountRate = Math.max(0, Number(discountSelect.value || 0));
    const discount = baseTotal * discountRate / 100;
    const locationCharge = locationInput.checked ? baseTotal * locationRate / 100 : 0;
    const adjustedTotal = Math.max(0, baseTotal - discount + locationCharge);
    const balance = adjustedTotal - scheduledTotal;
    setResult("monthly_total", monthlyTotal);
    setResult("half_yearly_total", halfYearlyTotal);
    setResult("discount", discount);
    setResult("location_charge", locationCharge);
    setResult("adjusted_total", adjustedTotal);
    setResult("scheduled_total", scheduledTotal);
    setResult("balance", Math.abs(balance));
    const balanceCard = calculator.querySelector(".calculator-result-balance");
    const balanceLabel = calculator.querySelector("[data-calc-balance-label]");
    balanceCard.classList.toggle("is-over", balance < -0.5);
    balanceCard.classList.toggle("is-balanced", Math.abs(balance) <= 0.5);
    balanceLabel.textContent = balance < -0.5 ? "Schedule exceeds total by" : Math.abs(balance) <= 0.5 ? "Payment schedule balanced" : "Remaining balance";
    const progress = adjustedTotal > 0 ? Math.min(100, scheduledTotal / adjustedTotal * 100) : 0;
    calculator.querySelector("[data-calc-progress]").style.width = `${progress}%`;
    const selectedPlan = plans[Number(planSelect.value)] || plans[0];
    calculationText = `${project.title}${project.plan_name ? ` — ${project.plan_name}` : ""}\n${selectedPlan.plan_name || "Payment Plan"} — ${selectedPlan.size_label || ""}\nTotal price: ${formatPkr(baseTotal)}\nDown payment: ${formatPkr(downPayment)}\n${monthlyCount} monthly installments × ${formatPkr(monthlyAmount)} = ${formatPkr(monthlyTotal)}\n${halfYearlyCount} half-yearly installments × ${formatPkr(halfYearlyAmount)} = ${formatPkr(halfYearlyTotal)}\nAdjusted total: ${formatPkr(adjustedTotal)}\nScheduled payments: ${formatPkr(scheduledTotal)}\n${balanceLabel.textContent}: ${formatPkr(Math.abs(balance))}`;
  }

  function applyPlan() {
    const plan = plans[Number(planSelect.value)] || plans[0];
    Object.keys(fields).forEach((name) => {
      const value = paymentNumber(plan[name]);
      fields[name].value = value || "";
    });
    discountSelect.innerHTML = '<option value="0">No discount</option>';
    const fullDiscount = paymentNumber(plan.full_payment_discount_percent);
    const halfDiscount = paymentNumber(plan.half_payment_discount_percent);
    if (fullDiscount) discountSelect.insertAdjacentHTML("beforeend", `<option value="${fullDiscount}">100% payment discount (${fullDiscount}%)</option>`);
    if (halfDiscount) discountSelect.insertAdjacentHTML("beforeend", `<option value="${halfDiscount}">50% payment discount (${halfDiscount}%)</option>`);
    locationRate = paymentNumber(plan.preferred_location_charge_percent);
    locationWrap.hidden = locationRate <= 0;
    locationInput.checked = false;
    locationLabel.textContent = `Apply preferred-location charge (${locationRate}%)`;
    calculate();
  }

  planSelect.addEventListener("change", applyPlan);
  calculator.addEventListener("input", calculate);
  calculator.addEventListener("change", calculate);
  calculator.querySelector("[data-calc-reset]").addEventListener("click", applyPlan);
  calculator.querySelector("[data-calc-copy]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(calculationText);
      button.textContent = "Calculation copied";
    } catch {
      window.prompt("Copy this calculation:", calculationText);
    }
    setTimeout(() => { button.textContent = "Copy calculation"; }, 1800);
  });
  applyPlan();
}

function renderProjectPlans(container, project) {
  const planMedia = (project.media || []).filter((item) => item.media_type === "plan" && safeUrl(item.file_path));
  const structuredPlans = Array.isArray(project.payment_plans) ? project.payment_plans.filter(Boolean) : [];
  if (!planMedia.length && !structuredPlans.length) {
    container.innerHTML = `<p class="media-empty">Plans will be available soon.</p>`;
    return;
  }
  const parts = [];
  if (planMedia.length) {
    parts.push(...planMedia.map((item) => `<figure class="plan-tile"><img src="${safeUrl(item.file_path)}" alt="${escapeHtml(item.caption || "Project plan image")}" loading="lazy" />${item.caption ? `<p>${escapeHtml(item.caption)}</p>` : ""}</figure>`));
  }
  if (structuredPlans.length) {
    const headers = ['Plot category', 'Down payment', 'Total monthly installments', 'One monthly installment', 'Total half-yearly installments', 'One half-yearly installment', 'Balloting', 'On possession', 'Other payment', 'Total price'];
    const planGroups = new Map();
    structuredPlans.forEach((plan) => {
      const displayName = String(plan.plan_name || 'Payment Plans').trim() || 'Payment Plans';
      const groupKey = displayName.toLocaleLowerCase();
      if (!planGroups.has(groupKey)) planGroups.set(groupKey, { name: displayName, plans: [] });
      planGroups.get(groupKey).plans.push(plan);
    });
    planGroups.forEach((group) => {
      const rows = group.plans.map((plan) => {
        const values = [plan.size_label, plan.booking_amount, plan.monthly_installment_count, plan.monthly_installment, plan.half_yearly_count, plan.half_yearly_installment, plan.balloting, plan.on_possession, plan.other_payment, plan.total_price];
        const moneyColumns = new Set([1, 3, 5, 6, 7, 8, 9]);
        return `<tr>${values.map((value, index) => `<td data-label="${escapeHtml(headers[index])}">${escapeHtml(formatPlanTableValue(value, moneyColumns.has(index)))}</td>`).join('')}</tr>`;
      }).join('');
      parts.push(`<article class="payment-plan-card payment-plan-table"><h3>${escapeHtml(group.name)}</h3><div class="payment-plan-table-wrapper"><table><thead><tr>${headers.map((label) => `<th>${escapeHtml(label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></article>`);
    });
    parts.push(installmentCalculatorMarkup(structuredPlans));
  }
  container.innerHTML = parts.join("");
  initializeInstallmentCalculator(container, structuredPlans, project);
}

function renderProject(project) {
  const subProjects = Array.isArray(project.sub_projects) ? project.sub_projects : [];
  const selectedSubProject = project.selected_sub_project || subProjects.find((item) => Number(item.sub_project_id) === requestedSubProjectId) || null;
  const selectedSubProjectId = Number(selectedSubProject?.sub_project_id || 0);
  const selectedName = String(selectedSubProject?.name || "").trim();
  const displayProject = selectedSubProjectId ? {
    ...project,
    payment_plans: (project.payment_plans || []).filter((plan) => !plan.sub_project_id || Number(plan.sub_project_id) === selectedSubProjectId),
    properties: (project.properties || []).filter((property) => Number(property.sub_project_id || 0) === selectedSubProjectId || (!property.sub_project_id && subProjects.length === 1))
  } : project;
  document.title = `Heera Estate | ${project.title}${selectedName ? ` - ${selectedName}` : (project.plan_name ? ` - ${project.plan_name}` : "")}`;
  if (selectedSubProject?.slug && !/\/sub-project\//.test(window.location.pathname)) {
    history.replaceState(null, "", `sub-project/${encodeURIComponent(selectedSubProject.slug)}`);
  } else if (project.slug && !/\/(?:project|sub-project)\//.test(window.location.pathname)) {
    history.replaceState(null, "", `project/${encodeURIComponent(project.slug)}${selectedSubProjectId ? `?sub_project_id=${selectedSubProjectId}` : ""}`);
  }
  document.querySelector("#projectTitle").textContent = selectedName || project.title;
  document.querySelector("#projectCategory").textContent = selectedName ? project.title : (project.plan_name ? `Plan: ${project.plan_name}` : (project.category || "Project"));
  document.querySelector("#projectLocation").textContent = project.location || "";
  const overviewEyebrow = document.querySelector("#projectOverviewEyebrow");
  if (overviewEyebrow) overviewEyebrow.textContent = selectedName ? "About the sub-project" : "About the project";
  document.querySelector("#projectHeadline").textContent = selectedName || project.headline || project.title;
  document.querySelector("#projectDescription").textContent = selectedSubProject?.description || project.description || "Project information will be added shortly.";
  const heroImage = safeUrl(project.hero_image_url) || safeUrl((project.media || []).find((item) => item.media_type === "gallery")?.file_path);
  if (heroImage) document.querySelector("#projectHero").style.backgroundImage = `linear-gradient(90deg,rgba(23,38,33,.72),rgba(23,38,33,.2)), url("${heroImage}")`;
  const facts = selectedName
    ? [["Parent project", project.title], ["Sub-project", selectedName], ["Location", project.location], ["Status", selectedSubProject.status || project.status]]
    : [["Location", project.location], ["Status", project.status], ["Project type", project.category], ["Sub-projects", subProjects.length ? String(subProjects.length) : ""]];
  const visibleFacts = facts.filter(([, value]) => value);
  document.querySelector("#projectFacts").innerHTML = visibleFacts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  const subSection = document.querySelector("#subProjectsSection");
  const subGrid = document.querySelector("#projectSubProjects");
  if (subSection && subGrid && subProjects.length) {
    subSection.hidden = false;
    subGrid.innerHTML = subProjects.map((item) => { const href=item.slug?`sub-project/${encodeURIComponent(item.slug)}`:`project.php?sub_project_id=${Number(item.sub_project_id)}`;return `<a class="sub-project-public-card${Number(item.sub_project_id) === selectedSubProjectId ? " is-active" : ""}" href="${href}"${Number(item.sub_project_id) === selectedSubProjectId ? ' aria-current="page"' : ""}><p class="eyebrow">${escapeHtml(item.status || "Published")}</p><h3>${escapeHtml(item.name)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</a>`; }).join("");
  }
  const plansSection = document.querySelector("#plansSection");
  const hasPlans = (displayProject.media || []).some((item) => item.media_type === "plan") || (displayProject.payment_plans || []).length > 0;
  if (plansSection) plansSection.hidden = !hasPlans;
  renderProjectPlans(document.querySelector("#projectPlans"), displayProject);
  renderProjectProperties(document.querySelector("#projectProperties"), displayProject.properties || []);
  renderMedia(document.querySelector("#projectGallery"), project.media || [], "gallery", "Project images will be available soon.");
}

async function loadProject() {
  if (window.__PROJECT_DATA__) { renderProject(window.__PROJECT_DATA__); return; }
  if ((!Number.isInteger(projectId) || projectId < 1) && !projectSlug && !requestedSubProjectSlug && requestedSubProjectId < 1) throw new Error("Missing project");
  const query = requestedSubProjectSlug
    ? `sub_project_slug=${encodeURIComponent(requestedSubProjectSlug)}`
    : `${projectSlug ? `slug=${encodeURIComponent(projectSlug)}` : `id=${projectId}`}${requestedSubProjectId ? `&sub_project_id=${requestedSubProjectId}` : ""}`;
  const response = await fetch(`api.php?action=project&${query}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Project unavailable");
  renderProject(await response.json());
}

loadProject().catch(() => { document.querySelector("#projectContent").hidden = true; document.querySelector("#projectNotFound").hidden = false; });
document.querySelector("#year").textContent = new Date().getFullYear();
