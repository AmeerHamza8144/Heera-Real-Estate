const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const safeUrl = (value) => {
  const url = String(value || "").trim();
  if (url.startsWith("uploads/")) return url;
  try { return ["http:", "https:"].includes(new URL(url).protocol) ? url : ""; } catch { return ""; }
};
const projectId = Number(window.__PROJECT_DATA__?.project_id || new URLSearchParams(window.location.search).get("id"));
const projectSlug = String(window.__PROJECT_DATA__?.slug || new URLSearchParams(window.location.search).get("slug") || "");

function renderMedia(container, items, kind, emptyText) {
  const selected = items.filter((item) => item.media_type === kind && safeUrl(item.file_path));
  if (!selected.length) { container.innerHTML = `<p class="media-empty">${emptyText}</p>`; return; }
  container.innerHTML = selected.map((item) => `<figure class="${kind === "plan" ? "plan-tile" : ""}"><img src="${safeUrl(item.file_path)}" alt="${escapeHtml(item.caption || "Project " + kind)}" loading="lazy" />${item.caption ? `<p>${escapeHtml(item.caption)}</p>` : ""}</figure>`).join("");
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
  document.title = `Heera Estate | ${project.title}${project.plan_name ? ` - ${project.plan_name}` : ""}`;
  if (project.slug && !/\/project\//.test(window.location.pathname)) history.replaceState(null, "", `project/${encodeURIComponent(project.slug)}`);
  document.querySelector("#projectTitle").textContent = project.title;
  document.querySelector("#projectCategory").textContent = project.plan_name ? `Plan: ${project.plan_name}` : (project.category || "Project");
  document.querySelector("#projectLocation").textContent = project.location || "";
  document.querySelector("#projectHeadline").textContent = project.headline || project.title;
  document.querySelector("#projectDescription").textContent = project.description || "Project information will be added shortly.";
  const heroImage = safeUrl(project.hero_image_url) || safeUrl((project.media || []).find((item) => item.media_type === "gallery")?.file_path);
  if (heroImage) document.querySelector("#projectHero").style.backgroundImage = `linear-gradient(90deg,rgba(23,38,33,.72),rgba(23,38,33,.2)), url("${heroImage}")`;
  const facts = [["Plan", project.plan_name], ["Location", project.location], ["Status", project.status], ["Project type", project.category]].filter(([, value]) => value);
  document.querySelector("#projectFacts").innerHTML = facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  renderProjectPlans(document.querySelector("#projectPlans"), project);
  renderMedia(document.querySelector("#projectGallery"), project.media || [], "gallery", "Project images will be available soon.");
}

async function loadProject() {
  if (window.__PROJECT_DATA__) { renderProject(window.__PROJECT_DATA__); return; }
  if ((!Number.isInteger(projectId) || projectId < 1) && !projectSlug) throw new Error("Missing project");
  const query = projectSlug ? `slug=${encodeURIComponent(projectSlug)}` : `id=${projectId}`;
  const response = await fetch(`api.php?action=project&${query}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Project unavailable");
  renderProject(await response.json());
}

loadProject().catch(() => { document.querySelector("#projectContent").hidden = true; document.querySelector("#projectNotFound").hidden = false; });
document.querySelector("#year").textContent = new Date().getFullYear();
