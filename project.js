const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const safeUrl = (value) => {
  const url = String(value || "").trim();
  if (url.startsWith("uploads/")) return url;
  try { return ["http:", "https:"].includes(new URL(url).protocol) ? url : ""; } catch { return ""; }
};
const projectId = Number(new URLSearchParams(window.location.search).get("id"));

function renderMedia(container, items, kind, emptyText) {
  const selected = items.filter((item) => item.media_type === kind && safeUrl(item.file_path));
  if (!selected.length) { container.innerHTML = `<p class="media-empty">${emptyText}</p>`; return; }
  container.innerHTML = selected.map((item) => `<figure class="${kind === "plan" ? "plan-tile" : ""}"><img src="${safeUrl(item.file_path)}" alt="${escapeHtml(item.caption || "Project " + kind)}" loading="lazy" />${item.caption ? `<p>${escapeHtml(item.caption)}</p>` : ""}</figure>`).join("");
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
    const headers = ['Plan', 'Booking', 'Monthly instalment', 'Half-yearly count', 'Half-yearly instalment', 'On possession', 'Balloting', 'Total price'];
    const rows = structuredPlans.map((plan) => `
      <tr>
        <td>${escapeHtml(plan.size_label || '')}</td>
        <td>${escapeHtml(plan.booking_amount || '')}</td>
        <td>${escapeHtml(plan.monthly_installment || '')}</td>
        <td>${escapeHtml(plan.half_yearly_count || '')}</td>
        <td>${escapeHtml(plan.half_yearly_installment || '')}</td>
        <td>${escapeHtml(plan.on_possession || '')}</td>
        <td>${escapeHtml(plan.balloting || '')}</td>
        <td>${escapeHtml(plan.total_price || '')}</td>
      </tr>`).join('');
    parts.push(`<article class="payment-plan-card payment-plan-table"><h3>Payment plans</h3><div class="payment-plan-table-wrapper"><table><thead><tr>${headers.map((label) => `<th>${escapeHtml(label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></article>`);
  }
  container.innerHTML = parts.join("");
}

function renderProject(project) {
  document.title = `Havenly | ${project.title}`;
  document.querySelector("#projectTitle").textContent = project.title;
  document.querySelector("#projectCategory").textContent = project.category || "Project";
  document.querySelector("#projectLocation").textContent = project.location || "";
  document.querySelector("#projectHeadline").textContent = project.headline || project.title;
  document.querySelector("#projectDescription").textContent = project.description || "Project information will be added shortly.";
  const heroImage = safeUrl(project.hero_image_url) || safeUrl((project.media || []).find((item) => item.media_type === "gallery")?.file_path);
  if (heroImage) document.querySelector("#projectHero").style.backgroundImage = `linear-gradient(90deg,rgba(23,38,33,.72),rgba(23,38,33,.2)), url("${heroImage}")`;
  const facts = [["Location", project.location], ["Status", project.status], ["Project type", project.category]].filter(([, value]) => value);
  document.querySelector("#projectFacts").innerHTML = facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  renderProjectPlans(document.querySelector("#projectPlans"), project);
  renderMedia(document.querySelector("#projectGallery"), project.media || [], "gallery", "Project images will be available soon.");
}

async function loadProject() {
  if (!Number.isInteger(projectId) || projectId < 1) throw new Error("Missing project");
  const response = await fetch(`api.php?action=project&id=${projectId}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Project unavailable");
  renderProject(await response.json());
}

loadProject().catch(() => { document.querySelector("#projectContent").hidden = true; document.querySelector("#projectNotFound").hidden = false; });
document.querySelector("#year").textContent = new Date().getFullYear();
