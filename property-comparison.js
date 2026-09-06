(() => {
  'use strict';
  const sides = [...document.querySelectorAll('.compare-side')];
  const catalog = [];
  const storedIds = (() => { try { return JSON.parse(localStorage.getItem('heeraCompare') || '[]').map(Number).filter(Number.isFinite).slice(0,2); } catch { return []; } })();

  const escapeHtml = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
  const listingLabel = value => value === 'rent' ? 'For rent' : value === 'installment' ? 'On Installments' : 'For sale';
  const selectedSource = side => side.querySelector('.source-switch__button.active')?.dataset.source || 'inventory';

  function catalogLabel(property) {
    const price = Number(property.price_pkr || 0) > 0 ? `PKR ${money(property.price_pkr)}` : Number(property.price || 0) > 0 ? `$${money(property.price)}` : 'Price on request';
    return `${property.title || property.address_line1 || 'Property'} — ${property.size_label || property.property_type || ''} — ${price}`;
  }

  function inventoryPreview(property) {
    if (!property) return '<p>Select a property to preview its key facts.</p>';
    const plan = property.selected_payment_plan || null;
    const price = Number(property.price_pkr || 0) > 0 ? `PKR ${money(property.price_pkr)}` : Number(plan?.total_price || 0) > 0 ? `PKR ${money(plan.total_price)}` : Number(property.price || 0) > 0 ? `$${money(property.price)}` : 'Price on request';
    return `<strong>${escapeHtml(property.title || 'Property')}</strong><div class="preview-facts"><span>${escapeHtml(listingLabel(property.listing_type))}</span><span>${escapeHtml(property.property_type || 'Property')}</span>${property.size_label?`<span>${escapeHtml(property.size_label)}</span>`:''}<span>${escapeHtml(price)}</span>${plan?.monthly_installment?`<span>Monthly PKR ${escapeHtml(money(plan.monthly_installment))}</span>`:''}</div>`;
  }

  function renderCatalog() {
    sides.forEach((side, index) => {
      const select = side.querySelector('[data-inventory-select]');
      const current = select.value;
      select.innerHTML = '<option value="">Choose a property…</option>' + catalog.map(p => `<option value="${Number(p.property_id)}">${escapeHtml(catalogLabel(p))}</option>`).join('');
      const requested = new URLSearchParams(location.search).get(index === 0 ? 'a' : 'b');
      const preferred = Number(requested || storedIds[index] || current || 0);
      if (preferred && catalog.some(p => Number(p.property_id) === preferred)) select.value = String(preferred);
      side.querySelector('[data-inventory-preview]').innerHTML = inventoryPreview(catalog.find(p => Number(p.property_id) === Number(select.value)));
    });
  }

  async function loadCatalog() {
    try {
      const response = await fetch('api.php?action=properties', { headers: { Accept:'application/json' } });
      if (!response.ok) throw new Error('Listings unavailable');
      const data = await response.json();
      if (Array.isArray(data)) catalog.push(...data);
    } catch {
      document.querySelector('#comparisonStatus').textContent = 'Website listings could not be loaded. Manual comparison is still available.';
    }
    renderCatalog();
  }

  function setSource(side, source) {
    side.querySelectorAll('.source-switch__button').forEach(btn => btn.classList.toggle('active', btn.dataset.source === source));
    side.querySelectorAll('[data-source-panel]').forEach(panel => panel.hidden = panel.dataset.sourcePanel !== source);
  }

  sides.forEach(side => {
    side.querySelector('.source-switch').addEventListener('click', event => {
      const button = event.target.closest('.source-switch__button');
      if (button) setSource(side, button.dataset.source);
    });
    side.querySelector('[data-inventory-select]').addEventListener('change', event => {
      const property = catalog.find(item => Number(item.property_id) === Number(event.target.value));
      side.querySelector('[data-inventory-preview]').innerHTML = inventoryPreview(property);
    });
  });

  function fieldValue(side, name) {
    const field = side.querySelector(`[name="${name}"]`);
    return field ? field.value.trim() : '';
  }

  function sidePayload(side) {
    if (selectedSource(side) === 'inventory') return { source:'inventory', property_id:Number(side.querySelector('[data-inventory-select]').value || 0) };
    const names = ['title','listing_type','property_type','project','location','block','facing','size_label','area_sqft','bedrooms','bathrooms','currency','price','plan_name','booking_amount','monthly_installment_count','monthly_installment','half_yearly_count','half_yearly_installment','balloting','on_possession','other_payment','notes'];
    return Object.fromEntries([['source','manual'], ...names.map(name => [name, fieldValue(side,name)])]);
  }

  function payload() {
    return {
      property_a: sidePayload(sides[0]),
      property_b: sidePayload(sides[1]),
      preferences: {
        budget_max: document.querySelector('#compareBudgetMax').value,
        monthly_max: document.querySelector('#compareMonthlyMax').value,
        preferred_location: document.querySelector('#comparePreferredLocation').value.trim(),
        priority: document.querySelector('#comparePriority').value,
        notes: document.querySelector('#compareNotes').value.trim(),
      }
    };
  }

  async function compareRequest(body) {
    const options = { method:'POST', headers:{ Accept:'application/json','Content-Type':'application/json' }, body:JSON.stringify(body), credentials:'same-origin' };
    let response = await fetch('api/v1/property-comparison', options);
    if (response.status === 404) response = await fetch('api.php?action=compare_properties', options);
    const result = await response.json().catch(() => ({ error:'The server returned an invalid comparison response.' }));
    if (!response.ok) throw new Error(result.error || 'Comparison failed.');
    return result;
  }

  function insightsMarkup(score) {
    const good = (score.reasons || []).map(text => `<div class="insight-item good">✓ ${escapeHtml(text)}</div>`).join('');
    const warnings = (score.warnings || []).map(text => `<div class="insight-item warning">! ${escapeHtml(text)}</div>`).join('');
    return `<div class="insight-list">${good || '<div class="insight-item">No specific advantage was calculated from the supplied fields.</div>'}${warnings}</div>`;
  }

  function renderResult(result) {
    const a=result.property_a,b=result.property_b;
    document.querySelector('#scoreA').textContent=`${result.score_a.score}/100`;
    document.querySelector('#scoreB').textContent=`${result.score_b.score}/100`;
    document.querySelector('#scoreTitleA').textContent=a.title;
    document.querySelector('#scoreTitleB').textContent=b.title;
    document.querySelector('#tableTitleA').textContent=a.title;
    document.querySelector('#tableTitleB').textContent=b.title;
    document.querySelector('#comparisonWinner').textContent=result.winner==='a'?`${a.title} is the stronger fit`:result.winner==='b'?`${b.title} is the stronger fit`:'Very close match — compare the trade-offs';
    document.querySelector('#comparisonTableBody').innerHTML=(result.rows||[]).map(row=>`<tr><td>${escapeHtml(row.label)}</td><td class="${row.winner==='a'?'metric-winner':''}">${escapeHtml(row.a)}</td><td class="${row.winner==='b'?'metric-winner':''}">${escapeHtml(row.b)}</td></tr>`).join('');
    document.querySelector('#insightsA').innerHTML=insightsMarkup(result.score_a);
    document.querySelector('#insightsB').innerHTML=insightsMarkup(result.score_b);
    document.querySelector('#comparisonBrief').textContent=result.brief || '';
    document.querySelector('#comparisonDisclaimer').textContent=result.disclaimer || '';
    document.querySelector('#comparisonProvider').textContent=result.provider==='openai'?'AI + database comparison':'Database comparison';
    document.querySelector('#aiProviderBadge').textContent=result.provider==='openai'?'AI-assisted':'Local analysis';
    const section=document.querySelector('#comparisonResults');section.hidden=false;section.scrollIntoView({behavior:'smooth',block:'start'});
    window.__LAST_COMPARISON__=result;
  }

  document.querySelector('#runComparison').addEventListener('click', async () => {
    const button=document.querySelector('#runComparison'),status=document.querySelector('#comparisonStatus');
    button.disabled=true;button.innerHTML='Comparing…';status.textContent='Checking property facts and customer priorities…';
    try { const result=await compareRequest(payload()); renderResult(result); status.textContent='Comparison complete.'; }
    catch(error){status.textContent=error.message;}
    finally{button.disabled=false;button.innerHTML='Compare properties <span>→</span>';}
  });

  document.querySelector('#resetComparison').addEventListener('click', () => {
    sides.forEach(side=>{setSource(side,'inventory');side.querySelectorAll('input,textarea').forEach(field=>field.value='');side.querySelectorAll('select[name]').forEach(field=>field.selectedIndex=0);side.querySelector('[data-inventory-select]').value='';side.querySelector('[data-inventory-preview]').innerHTML=inventoryPreview(null);});
    ['#compareBudgetMax','#compareMonthlyMax','#comparePreferredLocation','#compareNotes'].forEach(sel=>document.querySelector(sel).value='');
    document.querySelector('#comparePriority').value='balanced';document.querySelector('#comparisonResults').hidden=true;localStorage.removeItem('heeraCompare');document.querySelector('#comparisonStatus').textContent='';
  });

  document.querySelector('#copyComparison').addEventListener('click', async event => {
    const result=window.__LAST_COMPARISON__;if(!result)return;
    const rows=(result.rows||[]).map(r=>`${r.label}: ${r.a} | ${r.b}`).join('\n');
    const text=`PROPERTY COMPARISON\nA: ${result.property_a.title} (${result.score_a.score}/100)\nB: ${result.property_b.title} (${result.score_b.score}/100)\n\n${rows}\n\nAdvisor brief:\n${result.brief}\n\n${result.disclaimer}`;
    try{await navigator.clipboard.writeText(text);event.currentTarget.textContent='Copied';setTimeout(()=>event.currentTarget.textContent='Copy comparison',1600);}catch{window.prompt('Copy comparison:',text);}
  });

  document.querySelector('#year').textContent=new Date().getFullYear();
  loadCatalog();
})();
