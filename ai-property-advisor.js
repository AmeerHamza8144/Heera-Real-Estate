(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const safe = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money = value => Number(value || 0) > 0 ? `PKR ${Math.round(Number(value)).toLocaleString('en-PK')}` : 'Price on request';
  let loadedOptions = false;
  let latestBrief = '';

  async function api(action, data=null) {
    if (window.HeeraAdminAPI?.request) return window.HeeraAdminAPI.request(action, data);
    if (typeof window.api === 'function') return window.api(action, data);
    throw new Error('Admin API is not available.');
  }

  async function loadOptions(force=false) {
    if (loadedOptions && !force) return;
    const [agents, projects] = await Promise.all([api('admin_agents'), api('admin_projects')]);
    const agentSelect = $('#advisorAgent');
    const projectSelect = $('#advisorProject');
    if (agentSelect) agentSelect.innerHTML = '<option value="">Any / current agent</option>' + (agents || []).map(a => `<option value="${Number(a.agent_id)}">${safe(a.name)}</option>`).join('');
    if (projectSelect) projectSelect.innerHTML = '<option value="">Any project</option>' + (projects || []).map(p => `<option value="${Number(p.project_id)}">${safe(p.title)}${p.plan_name ? ` — ${safe(p.plan_name)}` : ''}</option>`).join('');
    loadedOptions = true;
  }

  function formData() {
    const form = $('#aiAdvisorForm');
    const data = Object.fromEntries(new FormData(form).entries());
    ['budget_min','budget_max','monthly_max','bedrooms'].forEach(k => { if (data[k] === '') delete data[k]; });
    data.agent_id = Number(data.agent_id || 0);
    data.project_id = Number(data.project_id || 0);
    return data;
  }

  function propertyUrl(match) {
    if (match.slug) return `property/${encodeURIComponent(match.slug)}`;
    return `property.php?id=${Number(match.property_id)}`;
  }

  function renderMatches(matches=[]) {
    const list = $('#aiAdvisorMatches');
    if (!list) return;
    if (!matches.length) {
      list.innerHTML = '<div class="ai-advisor-empty"><div><i class="ti ti-home-search" aria-hidden="true"></i><strong>No available matches</strong><p>Try widening the budget or removing one preference.</p></div></div>';
      return;
    }
    list.innerHTML = matches.map(match => {
      const plan = match.payment_plan || {};
      const details = [match.project_title, match.block, match.size, match.property_type].filter(Boolean).join(' · ');
      const planText = plan.monthly_installment ? ` · ${money(plan.monthly_installment)}/month` : '';
      return `<article class="ai-match-card">
        ${match.image_url ? `<img src="${safe(match.image_url)}" alt="" loading="lazy">` : '<span></span>'}
        <div class="ai-match-card__body"><h4>${safe(match.title)}</h4><p>${safe(details || match.city)} · ${safe(money(match.price_pkr))}${safe(planText)}</p><p class="ai-match-card__reason">${safe((match.reasons || []).slice(0,3).join(' · '))}</p></div>
        <span class="ai-match-score" title="Match score">${Number(match.score)}%</span>
        <div class="ai-match-actions"><a href="${safe(propertyUrl(match))}" target="_blank" rel="noopener"><i class="ti ti-external-link"></i> View listing</a><button type="button" data-advisor-compare-property="${Number(match.property_id)}"><i class="ti ti-arrows-diff"></i> Compare</button><button type="button" data-advisor-copy-property="${Number(match.property_id)}" data-copy-text="${safe(`${match.title} — ${money(match.price_pkr)} — ${propertyUrl(match)}`)}"><i class="ti ti-copy"></i> Copy</button></div>
      </article>`;
    }).join('');
  }

  async function recommend(event) {
    event?.preventDefault();
    const button = $('#advisorFindButton');
    const state = $('#aiAdvisorState');
    const brief = $('#aiAdvisorBrief');
    if (button) { button.disabled = true; button.textContent = 'Finding matches…'; }
    if (state) state.innerHTML = '<strong>Scanning live property inventory…</strong><span class="ai-advisor-provider">Working</span>';
    if (brief) brief.textContent = '';
    try {
      const result = await api('ai_advisor_recommend', formData());
      latestBrief = result.brief || '';
      if (state) state.innerHTML = `<strong>${Number(result.matches?.length || 0)} best matches from ${Number(result.inventory_count || 0)} properties</strong><span class="ai-advisor-provider">${result.provider === 'openai' ? `AI · ${safe(result.model || 'OpenAI')}` : 'Smart Match'}</span>`;
      if (brief) brief.textContent = latestBrief;
      renderMatches(result.matches || []);
      await loadHistory();
    } catch (error) {
      if (state) state.innerHTML = `<strong>${safe(error.message || 'Advisor request failed.')}</strong><span class="ai-advisor-provider">Error</span>`;
      renderMatches([]);
    } finally {
      if (button) { button.disabled = false; button.innerHTML = '<i class="ti ti-sparkles"></i> Find best properties'; }
    }
  }

  async function loadHistory() {
    const target = $('#aiAdvisorHistoryList');
    if (!target) return;
    try {
      const history = await api('ai_advisor_history');
      target.innerHTML = history?.length ? history.map(item => `<span class="ai-history-chip">${safe(item.client_name || 'Client search')} · ${safe(item.agent_name || 'Admin')} · ${new Date(String(item.created_at).replace(' ','T')).toLocaleDateString()}</span>`).join('') : '<span class="ai-history-chip">No advisor searches yet</span>';
    } catch { target.innerHTML = '<span class="ai-history-chip">History unavailable</span>'; }
  }

  async function refresh() {
    await loadOptions();
    await loadHistory();
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch { window.prompt('Copy:', text); }
  }

  function wire() {
    $('#aiAdvisorForm')?.addEventListener('submit', recommend);
    $('#advisorResetButton')?.addEventListener('click', () => { $('#aiAdvisorForm')?.reset(); latestBrief=''; $('#aiAdvisorBrief').textContent=''; $('#aiAdvisorMatches').innerHTML='<div class="ai-advisor-empty"><div><i class="ti ti-sparkles" aria-hidden="true"></i><strong>Tell me what your client needs</strong><p>The advisor will rank only properties currently in your database.</p></div></div>'; });
    $('#advisorCopyBrief')?.addEventListener('click', () => latestBrief && copyText(latestBrief));
    $('#advisorWhatsApp')?.addEventListener('click', () => { if (!latestBrief) return; window.open(`https://wa.me/?text=${encodeURIComponent(latestBrief)}`, '_blank', 'noopener'); });
    $('#aiAdvisorMatches')?.addEventListener('click', event => {
      const compareButton = event.target.closest('[data-advisor-compare-property]');
      if (compareButton) {
        const id = Number(compareButton.dataset.advisorCompareProperty || 0);
        if (id) {
          let ids = [];
          try { ids = JSON.parse(localStorage.getItem('heeraCompare') || '[]').map(Number).filter(Number.isFinite).slice(0,2); } catch {}
          if (!ids.includes(id)) {
            if (ids.length >= 2) ids.shift();
            ids.push(id);
          }
          localStorage.setItem('heeraCompare', JSON.stringify(ids));
          compareButton.innerHTML = '<i class="ti ti-check"></i> Added';
          if (ids.length === 2 && confirm('Two properties are selected. Open AI Property Comparison now?')) window.open('property-comparison.html', '_blank', 'noopener');
        }
        return;
      }
      const button = event.target.closest('[data-advisor-copy-property]');
      if (button) copyText(button.dataset.copyText || '');
    });
    refresh().catch(()=>{});
  }

  window.HeeraAIAdvisor = { refresh, recommend };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
