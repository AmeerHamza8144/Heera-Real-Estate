(() => {
  "use strict";
  const calculator = document.querySelector("[data-installment-calculator]");
  if (!calculator) return;

  const projectSelect = document.querySelector("#calculatorProject");
  const planSelect = document.querySelector("#calculatorPlan");
  const loadMessage = document.querySelector("#calculatorLoadMessage");
  const discountSelect = calculator.querySelector("[data-calc-discount]");
  const locationInput = calculator.querySelector("[data-calc-location-charge]");
  const locationWrap = calculator.querySelector("[data-location-charge-wrap]");
  const locationLabel = calculator.querySelector("[data-location-charge-label]");
  const fields = Object.fromEntries([...calculator.querySelectorAll("[data-calc-field]")].map((input) => [input.dataset.calcField, input]));
  let projects = [];
  let locationRate = 0;
  let calculationText = "";

  const paymentNumber = (value) => {
    const raw = String(value ?? "").trim();
    if (!/^(?:PKR\s*)?[0-9][0-9,]*(?:\.[0-9]+)?$/i.test(raw)) return 0;
    const normalized = raw.replace(/^PKR\s*/i, "").replace(/,/g, "");
    const number = Number(normalized);
    return Number.isFinite(number) && number > 0 ? number : 0;
  };
  const formatPkr = (value) => `PKR ${Math.round(Number(value) || 0).toLocaleString("en-PK")}`;
  const fieldValue = (name) => Math.max(0, Number(fields[name]?.value || 0));
  const setResult = (name, value) => { const output = calculator.querySelector(`[data-calc-result="${name}"]`); if (output) output.textContent = formatPkr(value); };
  const selectedProject = () => projects.find((project) => String(project.project_id) === projectSelect.value) || null;
  const selectedPlan = () => selectedProject()?.payment_plans?.[Number(planSelect.value)] || null;

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
    calculator.querySelector("[data-calc-progress]").style.width = `${adjustedTotal > 0 ? Math.min(100, scheduledTotal / adjustedTotal * 100) : 0}%`;

    const project = selectedProject();
    const plan = selectedPlan();
    calculationText = `${project ? `${project.title}${project.plan_name ? ` — ${project.plan_name}` : ""}` : "Manual payment plan"}\n${plan ? `${plan.plan_name || "Payment Plan"} — ${plan.size_label || ""}` : ""}\nTotal price: ${formatPkr(baseTotal)}\nDown payment: ${formatPkr(downPayment)}\n${monthlyCount} monthly installments × ${formatPkr(monthlyAmount)} = ${formatPkr(monthlyTotal)}\n${halfYearlyCount} half-yearly installments × ${formatPkr(halfYearlyAmount)} = ${formatPkr(halfYearlyTotal)}\nBalloting: ${formatPkr(balloting)}\nOn possession: ${formatPkr(possession)}\nOther payment: ${formatPkr(otherPayment)}\nAdjusted total: ${formatPkr(adjustedTotal)}\nTotal scheduled payments: ${formatPkr(scheduledTotal)}\n${balanceLabel.textContent}: ${formatPkr(Math.abs(balance))}`;
  }

  function configureAdjustments(plan = {}) {
    discountSelect.innerHTML = '<option value="0">No discount</option>';
    const fullDiscount = paymentNumber(plan.full_payment_discount_percent);
    const halfDiscount = paymentNumber(plan.half_payment_discount_percent);
    if (fullDiscount) discountSelect.insertAdjacentHTML("beforeend", `<option value="${fullDiscount}">100% payment discount (${fullDiscount}%)</option>`);
    if (halfDiscount) discountSelect.insertAdjacentHTML("beforeend", `<option value="${halfDiscount}">50% payment discount (${halfDiscount}%)</option>`);
    locationRate = paymentNumber(plan.preferred_location_charge_percent);
    locationWrap.hidden = locationRate <= 0;
    locationInput.checked = false;
    locationLabel.textContent = `Apply preferred-location charge (${locationRate}%)`;
  }

  function applyPlan() {
    const plan = selectedPlan();
    if (!plan) {
      configureAdjustments();
      calculate();
      return;
    }
    Object.keys(fields).forEach((name) => { fields[name].value = paymentNumber(plan[name]) || ""; });
    configureAdjustments(plan);
    calculate();
  }

  function renderPlanOptions() {
    const project = selectedProject();
    planSelect.replaceChildren();
    if (!project || !Array.isArray(project.payment_plans) || !project.payment_plans.length) {
      planSelect.add(new Option("Enter figures manually", "manual"));
      if (project) loadMessage.textContent = "This project has no structured payment plan yet. You can enter the figures manually.";
      applyPlan();
      return;
    }
    project.payment_plans.forEach((plan, index) => planSelect.add(new Option([plan.plan_name || "Payment Plan", plan.size_label].filter(Boolean).join(" — "), String(index))));
    loadMessage.textContent = "The selected plan was loaded from the published project. You may adjust it for an estimate.";
    applyPlan();
  }

  async function loadProjects() {
    loadMessage.textContent = "Loading published payment plans…";
    try {
      const response = await fetch("api.php?action=projects", { headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) throw new Error("Payment plans unavailable");
      projects = data.filter((project) => Array.isArray(project.payment_plans) && project.payment_plans.length);
      projects.forEach((project) => projectSelect.add(new Option(`${project.title}${project.plan_name ? ` — ${project.plan_name}` : ""}`, String(project.project_id))));
      loadMessage.textContent = projects.length ? "Choose a project to load its installment figures." : "No published structured plans are available yet. Enter figures manually.";
      const requestedProject = new URLSearchParams(location.search).get("project");
      if (requestedProject && projects.some((project) => String(project.project_id) === requestedProject)) projectSelect.value = requestedProject;
      renderPlanOptions();
    } catch {
      loadMessage.textContent = "Published plans could not be loaded. Manual calculation is still available.";
      renderPlanOptions();
    }
  }

  projectSelect.addEventListener("change", renderPlanOptions);
  planSelect.addEventListener("change", applyPlan);
  calculator.addEventListener("input", calculate);
  calculator.addEventListener("change", calculate);
  calculator.querySelector("[data-calc-reset]").addEventListener("click", () => {
    if (selectedPlan()) applyPlan();
    else { Object.values(fields).forEach((input) => { input.value = ""; }); configureAdjustments(); calculate(); }
  });
  calculator.querySelector("[data-calc-copy]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try { await navigator.clipboard.writeText(calculationText); button.textContent = "Calculation copied"; }
    catch { window.prompt("Copy this calculation:", calculationText); }
    setTimeout(() => { button.textContent = "Copy calculation"; }, 1800);
  });

  document.querySelector("#year").textContent = new Date().getFullYear();
  calculate();
  loadProjects();
})();
