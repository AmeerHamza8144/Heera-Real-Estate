(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const coreWorkspaceTabs = {
    appHomeWorkspace: 'home',
    propertiesWorkspace: 'properties',
    appLeadsWorkspace: 'leads',
    digitalMapsWorkspace: 'maps',
    appMoreWorkspace: 'more',
    aiAdvisorWorkspace: 'more'
  };
  const titles = {
    appHomeWorkspace: ['Admin dashboard', 'Home'],
    propertiesWorkspace: ['Property management', 'Properties'],
    appLeadsWorkspace: ['Lead generation CRM', 'CRM Leads'],
    digitalMapsWorkspace: ['Maps & plot tools', 'Maps'],
    appMoreWorkspace: ['All modules', 'More'],
    aiAdvisorWorkspace: ['Agent tools', 'AI Property Advisor'],
    projectsWorkspace: ['Projects', 'Projects'],
    subProjectsWorkspace: ['Projects & structure', 'Sub-Projects'],
    galleryWorkspace: ['Website content', 'Home Gallery'],
    popupsWorkspace: ['Website content', 'Popups'],
    agentsWorkspace: ['Team management', 'Agents'],
    addressesWorkspace: ['Business settings', 'Office Addresses'],
    loginUsersWorkspace: ['Access management', 'Login Users'],
    rolesWorkspace: ['Access management', 'Roles & Permissions'],
    submissionsWorkspace: ['Customer properties', 'Client Submissions']
  };
  let leads = [];
  let crmAgents = [];
  let leadFilter = 'all';
  let dashboardData = null;
  let adminAppStarted = false;
  let adminAppReady = false;
  const workspaceRefreshes = new Map();

  function safe(value = '') {
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function toast(message) {
    const el = $('#appToast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 2300);
  }

  function setTopbar(workspaceId) {
    const [eyebrow, title] = titles[workspaceId] || ['Admin', 'Heera Estate'];
    const eyebrowEl = $('#appTopEyebrow');
    const titleEl = $('#appPageTitle');
    if (eyebrowEl) eyebrowEl.textContent = eyebrow;
    if (titleEl) titleEl.textContent = title;
  }

  function setActiveNav(tab) {
    $$('.bottom-nav__item').forEach(item => {
      if (item.dataset.appTab === tab) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function showWorkspace(workspaceId, options = {}) {
    const target = document.getElementById(workspaceId);
    if (!target) return;
    if (target.dataset.permissionAllowed === 'false') { toast('Your role does not have access to this module.'); workspaceId='appHomeWorkspace'; return showWorkspace(workspaceId,{tab:'home',noRefresh:false}); }
    $$('.admin-workspace').forEach(workspace => { workspace.hidden = workspace !== target; });
    const tab = options.tab || coreWorkspaceTabs[workspaceId] || 'more';
    setActiveNav(tab);
    setTopbar(workspaceId);

    // Keep legacy tab state synchronized with the app shell. This prevents the old
    // admin controller from hiding a workspace again after the app nav opens it.
    $$('.admin-tab').forEach(item => {
      const active = item.dataset.workspace === workspaceId;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
      item.closest('.admin-menu-group')?.classList.toggle('open', active);
    });

    if (workspaceId === 'propertiesWorkspace' && typeof setAdminSubview === 'function' && !options.keepSubview) setAdminSubview('propertiesWorkspace', options.subview || 'list');
    if (workspaceId === 'projectsWorkspace' && typeof setAdminSubview === 'function' && !options.keepSubview) setAdminSubview('projectsWorkspace', options.subview || 'list');
    if (workspaceId === 'subProjectsWorkspace' && typeof setAdminSubview === 'function' && !options.keepSubview) setAdminSubview('subProjectsWorkspace', options.subview || 'list');
    if (workspaceId === 'agentsWorkspace' && typeof setAdminSubview === 'function' && !options.keepSubview) setAdminSubview('agentsWorkspace', options.subview || 'list');
    if (workspaceId === 'addressesWorkspace' && typeof setAdminSubview === 'function' && !options.keepSubview) setAdminSubview('addressesWorkspace', options.subview || 'list');
    if (workspaceId === 'loginUsersWorkspace' && typeof setAdminSubview === 'function' && !options.keepSubview) setAdminSubview('loginUsersWorkspace', options.subview || 'list');

    if (adminAppReady && !options.noRefresh) refreshWorkspaceData(workspaceId);
    if (workspaceId === 'propertiesWorkspace') setTimeout(syncPropertyFilters, 0);
    if (!options.noScroll) window.scrollTo({top: 0, behavior: 'smooth'});
    if (history.replaceState) history.replaceState(null, '', `#${workspaceId}`);
  }

  async function refreshWorkspaceData(workspaceId) {
    const loaders = {
      appHomeWorkspace: loadDashboard,
      propertiesWorkspace: window.loadProperties,
      appLeadsWorkspace: loadLeads,
      digitalMapsWorkspace: window.loadDigitalMaps,
      projectsWorkspace: window.loadProjects,
      subProjectsWorkspace: window.loadSubProjects,
      galleryWorkspace: window.loadHomeGallery,
      popupsWorkspace: window.loadAdminPopups,
      agentsWorkspace: window.loadAgents,
      addressesWorkspace: window.loadOfficeAddresses,
      loginUsersWorkspace: window.loadLoginUsers,
      rolesWorkspace: window.loadRoles,
      submissionsWorkspace: window.loadSubmissions,
      aiAdvisorWorkspace: window.HeeraAIAdvisor?.refresh
    };
    const loader = loaders[workspaceId];
    if (typeof loader !== 'function') return;
    if (workspaceRefreshes.has(workspaceId)) return workspaceRefreshes.get(workspaceId);
    const task = Promise.resolve().then(() => loader()).catch(error => {
      toast(error?.message || 'This module could not be refreshed.');
      throw error;
    }).finally(() => workspaceRefreshes.delete(workspaceId));
    workspaceRefreshes.set(workspaceId, task);
    return task;
  }

  async function loadDashboard() {
    try {
      dashboardData = await api('admin_dashboard');
      const counts = dashboardData.counts || {};
      $('#appNewLeadCount').textContent = Number(counts.new_leads || 0).toLocaleString();
      $('#appPendingSubmissionCount').textContent = Number(counts.pending_submissions || 0).toLocaleString();
      $('#appActiveProjectCount').textContent = Number(counts.active_projects || 0).toLocaleString();
      updateNotifications(counts);
      renderActivity(dashboardData.recent_activity || []);
    } catch (error) {
      const feed = $('#recentActivityFeed');
      if (feed) feed.innerHTML = `<li class="app-empty">${safe(error.message || 'Dashboard data could not be loaded.')}</li>`;
    }
  }

  function updateNotifications(counts) {
    const newLeads = Number(counts.new_leads || 0);
    const pending = Number(counts.pending_submissions || 0);
    const total = newLeads + pending;
    const badge = $('#appNotificationBadge');
    const dot = $('#appLeadsDot');
    if (badge) {
      badge.hidden = total < 1;
      badge.textContent = total > 99 ? '99+' : String(total);
    }
    if (dot) dot.hidden = newLeads < 1;
  }

  function renderActivity(items) {
    const feed = $('#recentActivityFeed');
    if (!feed) return;
    if (!items.length) {
      feed.innerHTML = '<li class="app-empty">No recent activity yet.</li>';
      return;
    }
    const icons = {lead:'ti-phone',submission:'ti-inbox',project:'ti-building-community',property:'ti-home-edit'};
    feed.innerHTML = items.map(item => `<li class="activity-item">
      <span class="activity-item__icon"><i class="ti ${icons[item.type] || 'ti-activity'}" aria-hidden="true"></i></span>
      <div><strong>${safe(item.title || 'Activity')}</strong><p>${safe(item.note || '')}</p></div>
      <time datetime="${safe(item.timestamp || '')}">${safe(relativeTime(item.timestamp))}</time>
    </li>`).join('');
  }

  function relativeTime(value) {
    if (!value) return '';
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return '';
    const seconds = Math.round((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return date.toLocaleDateString(undefined, {month:'short', day:'numeric'});
  }

  async function loadLeads() {
    const list = $('#appLeadList');
    if (list) list.innerHTML = '<p class="app-empty">Loading CRM leads…</p>';
    try {
      const [leadRows, stats, agentRows] = await Promise.all([api('admin_crm_leads'), api('crm_stats'), api('admin_agents')]);
      leads = Array.isArray(leadRows) ? leadRows : [];
      crmAgents = Array.isArray(agentRows) ? agentRows : [];
      renderLeads();
      if ($('#crmNewCount')) $('#crmNewCount').textContent = Number(stats.new || 0).toLocaleString();
      if ($('#crmHotCount')) $('#crmHotCount').textContent = Number(stats.hot || 0).toLocaleString();
      if ($('#crmQualifiedCount')) $('#crmQualifiedCount').textContent = Number(stats.qualified || 0).toLocaleString();
      if ($('#crmWonCount')) $('#crmWonCount').textContent = Number(stats.won || 0).toLocaleString();
      const newCount = Number(stats.new || 0);
      if (dashboardData?.counts) {
        dashboardData.counts.new_leads = newCount;
        updateNotifications(dashboardData.counts);
      }
    } catch (error) {
      if (list) list.innerHTML = `<p class="app-empty">${safe(error.message)}</p>`;
    }
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '?';
  }

  function leadSource(lead) {
    const source = String(lead.source || '').replace(/_/g, ' ').trim();
    if (source) return source.replace(/\b\w/g, char => char.toUpperCase());
    if (String(lead.email || '').toLowerCase() === 'chatbot@heera-estate.local' || /chatbot lead/i.test(lead.message || '')) return 'Chatbot';
    if (lead.property_title) return `Property: ${lead.property_title}`;
    return `${lead.interest || 'Website'} enquiry`;
  }

  function badgeClass(status) {
    if (['hot','lost'].includes(status)) return 'badge--danger';
    if (['new','high','qualified','negotiation'].includes(status)) return 'badge--warning';
    if (['won','available','published','approved'].includes(status)) return 'badge--success';
    if (['nurturing','viewing','medium'].includes(status)) return 'badge--neutral';
    return 'badge--neutral';
  }

  function renderLeads() {
    const list = $('#appLeadList');
    if (!list) return;
    const filtered = leadFilter === 'all' ? leads : leads.filter(item => String(item.lead_stage || 'new') === leadFilter);
    $('#appLeadTotal').textContent = `${filtered.length} lead${filtered.length === 1 ? '' : 's'}`;
    if (!filtered.length) {
      list.innerHTML = '<p class="app-empty">No CRM leads in this pipeline stage.</p>';
      return;
    }
    list.innerHTML = filtered.map(lead => {
      const stage = String(lead.lead_stage || 'new');
      const priority = String(lead.priority || 'medium');
      const score = Number(lead.lead_score || 0);
      const requirement = [lead.preferred_location, lead.preferred_project, lead.budget_max ? `Budget ${Number(lead.budget_max).toLocaleString('en-PK')}` : ''].filter(Boolean).join(' · ');
      return `<article class="list-row" data-lead-id="${Number(lead.enquiry_id)}">
        <span class="avatar-initials" aria-hidden="true">${safe(initials(lead.name))}</span>
        <div class="list-row__body"><strong>${safe(lead.name || 'Unknown lead')}</strong><p>${safe(leadSource(lead))}${requirement ? ` · ${safe(requirement)}` : ''}</p><div class="crm-lead-badges"><span class="badge ${badgeClass(stage)}">${safe(stage)}</span><span class="badge ${badgeClass(priority)} crm-priority">${safe(priority)}</span><span class="crm-score">${score}/100</span></div></div>
        <div class="list-row__meta crm-lead-controls">
          ${lead.phone ? `<a class="tap-call" href="tel:${safe(String(lead.phone).replace(/[^+0-9]/g,''))}" aria-label="Call ${safe(lead.name)}"><i class="ti ti-phone" aria-hidden="true"></i></a>` : ''}
          <select class="crm-stage-control" data-id="${Number(lead.enquiry_id)}" aria-label="Pipeline stage">
            ${['new','qualified','nurturing','viewing','negotiation','won','lost'].map(value => `<option value="${value}"${stage===value?' selected':''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}
          </select>
          <select class="crm-priority-control" data-id="${Number(lead.enquiry_id)}" aria-label="Lead priority">
            ${['low','medium','high','hot'].map(value => `<option value="${value}"${priority===value?' selected':''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}
          </select>
          <select class="crm-agent-control" data-id="${Number(lead.enquiry_id)}" aria-label="Assigned agent">
            <option value="">Unassigned</option>
            ${crmAgents.map(agent => `<option value="${Number(agent.agent_id)}"${Number(lead.assigned_agent_id)===Number(agent.agent_id)?' selected':''}>${safe(agent.name)}</option>`).join('')}
          </select>
        </div>
      </article>`;
    }).join('');
  }

  async function updateCrmLead(id, changes) {
    try {
      await api('save_crm_lead', {enquiry_id: id, ...changes});
      toast('CRM lead updated');
      await Promise.allSettled([loadDashboard(), loadLeads()]);
    } catch (error) {
      toast(error.message || 'CRM lead could not be updated');
      loadLeads();
    }
  }

  function syncPropertyFilters() {
    const cards = $$('#adminPropertyList .admin-property[data-property-id]');
    if (!cards.length) return;
    const selects = {
      project: $('#appPropertyProject'), block: $('#appPropertyBlock'), size: $('#appPropertySize'),
      type: $('#appPropertyType'), facing: $('#appPropertyFacing')
    };
    Object.entries(selects).forEach(([key, select]) => {
      if (!select) return;
      const current = select.value;
      const values = [...new Set(cards.map(card => card.dataset[key] || '').filter(Boolean))].sort((a,b) => a.localeCompare(b, undefined, {numeric:true}));
      const label = select.dataset.label || key;
      select.innerHTML = `<option value="">${safe(label)}</option>` + values.map(v => `<option value="${safe(v)}">${safe(v)}</option>`).join('');
      if (values.includes(current)) select.value = current;
    });
    filterProperties();
  }

  function filterProperties() {
    const filters = {
      project: $('#appPropertyProject')?.value || '', block: $('#appPropertyBlock')?.value || '', size: $('#appPropertySize')?.value || '',
      type: $('#appPropertyType')?.value || '', facing: $('#appPropertyFacing')?.value || ''
    };
    const price = $('#appPropertyPrice')?.value || '';
    const query = ($('#appPropertySearch')?.value || '').trim().toLowerCase();
    let shown = 0;
    $$('#adminPropertyList .admin-property[data-property-id]').forEach(card => {
      let match = Object.entries(filters).every(([key, value]) => !value || card.dataset[key] === value);
      const amount = Number(card.dataset.price || 0);
      if (match && price === 'under1') match = amount > 0 && amount < 1000000;
      if (match && price === '1to3') match = amount >= 1000000 && amount <= 3000000;
      if (match && price === '3to10') match = amount > 3000000 && amount <= 10000000;
      if (match && price === 'over10') match = amount > 10000000;
      if (match && query) match = (card.dataset.search || '').includes(query);
      card.hidden = !match;
      if (match) shown++;
    });
    const count = $('#listingCount');
    if (count && $$('#adminPropertyList .admin-property[data-property-id]').length) count.textContent = `${shown} shown`;
  }

  function resetPropertyFilters() {
    $$('#propertyAppFilter select').forEach(el => { el.value = ''; });
    const search = $('#appPropertySearch'); if (search) search.value = '';
    filterProperties();
  }

  function openCommandSheet() {
    const sheet = $('#adminCommandSheet');
    if (!sheet) return;
    sheet.hidden = false;
    const input = $('#adminCommandSearch');
    if (input) { input.value = ''; filterCommands(''); setTimeout(() => input.focus(), 0); }
  }

  function closeCommandSheet() { const sheet = $('#adminCommandSheet'); if (sheet) sheet.hidden = true; }
  function filterCommands(query) {
    query = String(query || '').toLowerCase();
    $$('.command-item').forEach(item => { item.hidden = query && !item.textContent.toLowerCase().includes(query); });
  }

  async function executeAction(action, anchor) {
    if (action === 'add-property') { if (typeof resetEditor === 'function') resetEditor(); showWorkspace('propertiesWorkspace', {tab:'properties', subview:'form', keepSubview:true}); if (typeof setAdminSubview === 'function') setAdminSubview('propertiesWorkspace','form'); }
    if (action === 'add-project') { if (typeof resetProjectEditor === 'function') resetProjectEditor(); showWorkspace('projectsWorkspace', {tab:'more', keepSubview:true}); if (typeof setAdminSubview === 'function') setAdminSubview('projectsWorkspace','form'); }
    if (action === 'add-map') { if (typeof resetDigitalMapEditor === 'function') resetDigitalMapEditor(); showWorkspace('digitalMapsWorkspace', {tab:'maps'}); setTimeout(() => $('#digitalMapForm')?.scrollIntoView({behavior:'smooth',block:'start'}), 100); }
    if (action === 'add-agent') { if (typeof resetAgentEditor === 'function') resetAgentEditor(); showWorkspace('agentsWorkspace', {tab:'more', keepSubview:true}); if (typeof setAdminSubview === 'function') setAdminSubview('agentsWorkspace','form'); }
    if (action === 'toggle-theme') { const toggle = $('.theme-toggle'); if (toggle) toggle.click(); else toast('Theme switch is available in the page header/footer.'); }
    if (action === 'api-health') {
      const status = $('#appApiHealthStatus');
      const text = $('#appApiHealthText');
      if (status) status.textContent = 'Checking…';
      try {
        const health = await window.HeeraAdminAPI?.health?.();
        const relations = Object.values(health?.foreign_keys || {});
        const relationsReady = !relations.length || relations.every(Boolean);
        const ready = health?.database === 'connected' && health?.schema_ready && relationsReady;
        if (status) status.textContent = ready ? 'Online' : 'Needs attention';
        if (text) text.textContent = ready ? `Admin API ${health.api_version || 'v1'} · database connected · schema + ${relations.length} core relationships ready` : 'API connected, but one or more database tables/relationships need attention';
        toast(ready ? 'Admin API and database are healthy.' : 'API is online, but the database schema needs attention.');
      } catch (error) {
        if (status) status.textContent = 'Offline';
        if (text) text.textContent = error.message || 'Admin API connection failed';
        toast(error.message || 'Admin API connection failed.');
      }
    }
    if (action === 'planned') toast(anchor?.dataset.message || 'This settings screen is planned for a later update.');
  }

  function wireEvents() {
    $$('.bottom-nav__item').forEach(item => item.addEventListener('click', event => {
      event.preventDefault();
      showWorkspace(item.dataset.appWorkspace, {tab:item.dataset.appTab});
    }));

    $$('.admin-tab').forEach(tab => tab.addEventListener('click', () => {
      const workspaceId = tab.dataset.workspace;
      setTopbar(workspaceId);
      setActiveNav(coreWorkspaceTabs[workspaceId] || 'more');
      if (adminAppReady) setTimeout(() => refreshWorkspaceData(workspaceId), 0);
    }));

    document.addEventListener('click', event => {
      const targetLink = event.target.closest('[data-app-target]');
      if (targetLink) {
        event.preventDefault();
        closeCommandSheet();
        const workspace = targetLink.dataset.appTarget;
        const subview = targetLink.dataset.subview;
        showWorkspace(workspace, {tab:targetLink.dataset.appTab || 'more', keepSubview:!!subview});
        if (subview && typeof setAdminSubview === 'function') setAdminSubview(workspace, subview);
        const scrollTarget = targetLink.dataset.scroll;
        if (scrollTarget) setTimeout(() => document.querySelector(scrollTarget)?.scrollIntoView({behavior:'smooth',block:'start'}), 120);
      }
      const actionLink = event.target.closest('[data-app-action]');
      if (actionLink) { event.preventDefault(); closeCommandSheet(); executeAction(actionLink.dataset.appAction, actionLink); }
    });

    $$('.app-lead-filter[data-stage]').forEach(button => button.addEventListener('click', () => {
      leadFilter = button.dataset.stage || 'all';
      $$('.app-lead-filter[data-stage]').forEach(b => b.classList.toggle('active', b === button));
      renderLeads();
    }));
    $('#appLeadList')?.addEventListener('change', event => {
      const stage = event.target.closest('.crm-stage-control');
      if (stage) updateCrmLead(Number(stage.dataset.id), {lead_stage: stage.value});
      const priority = event.target.closest('.crm-priority-control');
      if (priority) updateCrmLead(Number(priority.dataset.id), {priority: priority.value});
      const agent = event.target.closest('.crm-agent-control');
      if (agent) updateCrmLead(Number(agent.dataset.id), {assigned_agent_id: agent.value});
    });
    $('#crmCreateLeadForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = form.elements;
      const status = $('#crmCreateLeadStatus');
      if (status) status.textContent = 'Creating lead…';
      try {
        await api('crm_create_lead', {
          name: fields.name.value.trim(), phone: fields.phone.value.trim(), email: fields.email.value.trim(),
          interest: fields.interest.value, budget_max: fields.budget_max.value,
          preferred_location: fields.preferred_location.value.trim(), priority: fields.priority.value,
          message: fields.message.value.trim(), source: 'admin_manual'
        });
        form.reset();
        if (status) status.textContent = 'CRM lead created.';
        await Promise.allSettled([loadLeads(), loadDashboard()]);
        toast('Lead added to CRM');
      } catch (error) { if (status) status.textContent = error.message; }
    });

    $('#propertyAppFilter')?.addEventListener('change', filterProperties);
    $('#appPropertySearch')?.addEventListener('input', filterProperties);
    $('#appPropertyFilterClear')?.addEventListener('click', resetPropertyFilters);

    $('#appGlobalSearch')?.addEventListener('click', openCommandSheet);
    $('#commandSheetClose')?.addEventListener('click', closeCommandSheet);
    $('#adminCommandSheet')?.addEventListener('click', event => { if (event.target.id === 'adminCommandSheet') closeCommandSheet(); });
    $('#adminCommandSearch')?.addEventListener('input', event => filterCommands(event.target.value));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeCommandSheet(); });

    $('#appNotifications')?.addEventListener('click', () => {
      const newLeads = Number(dashboardData?.counts?.new_leads || 0);
      const pending = Number(dashboardData?.counts?.pending_submissions || 0);
      if (newLeads) showWorkspace('appLeadsWorkspace', {tab:'leads'});
      else if (pending) showWorkspace('submissionsWorkspace', {tab:'leads'});
      else toast('You are all caught up.');
    });

    $('#appMapFinderForm')?.addEventListener('submit', event => {
      event.preventDefault();
      const plot = $('#appPlotNumber')?.value.trim() || '';
      const block = $('#appPlotBlock')?.value.trim() || '';
      const params = new URLSearchParams();
      if (plot) params.set('plot_number', plot);
      if (block) params.set('block', block);
      window.location.href = `plot-finder.html${params.toString() ? `?${params}` : ''}`;
    });

    const propertyList = $('#adminPropertyList');
    if (propertyList) new MutationObserver(syncPropertyFilters).observe(propertyList, {childList:true, subtree:false});
  }

  function initialWorkspace() {
    const hash = location.hash.replace('#','');
    const allowed = new Set($$('.admin-workspace').map(el => el.id));
    if (hash && allowed.has(hash)) showWorkspace(hash, {tab:coreWorkspaceTabs[hash] || 'more', noScroll:true});
    else showWorkspace('appHomeWorkspace', {tab:'home', noScroll:true});
  }

  function applyCapabilities(session) {
    const caps = session?.capabilities || {};
    const workspaceCaps = {
      propertiesWorkspace: 'properties', projectsWorkspace: 'projects', subProjectsWorkspace: 'subprojects',
      appLeadsWorkspace: 'leads', digitalMapsWorkspace: 'digital_maps', galleryWorkspace: 'gallery',
      popupsWorkspace: 'popups', agentsWorkspace: 'agents', addressesWorkspace: 'offices',
      loginUsersWorkspace: 'users', rolesWorkspace: 'roles', submissionsWorkspace: 'submissions',
      aiAdvisorWorkspace: 'ai_property_advisor'
    };
    Object.entries(workspaceCaps).forEach(([workspaceId, cap]) => {
      const allowed = caps[cap] !== false;
      const workspace = document.getElementById(workspaceId);
      if (workspace) workspace.dataset.permissionAllowed = String(allowed);
      $$('.admin-menu-group').forEach(group => {
        const button = group.querySelector(`.admin-tab[data-workspace="${workspaceId}"]`);
        if (button) group.hidden = !allowed;
      });
      $$(`[data-app-target="${workspaceId}"],[data-app-workspace="${workspaceId}"]`).forEach(link => { link.hidden = !allowed; });
    });
    const bottomRules = {properties:'properties',leads:'leads',maps:'digital_maps'};
    Object.entries(bottomRules).forEach(([tab,cap]) => $$('.bottom-nav__item').filter(item => item.dataset.appTab===tab).forEach(item => { item.hidden = caps[cap] === false; }));
    document.documentElement.dataset.adminRole = session?.user?.role || 'admin';
    document.documentElement.dataset.canManageProperties = String(caps.properties_manage !== false);
    document.documentElement.dataset.canManageProjects = String(caps.projects_manage !== false);
    document.documentElement.dataset.canManageSubprojects = String(caps.subprojects_manage !== false);
  }

  function applyBootstrap(session) {
    if (!session?.authenticated) return;
    adminAppReady = true;
    applyCapabilities(session);
    if (session.dashboard) {
      dashboardData = session.dashboard;
      const counts = dashboardData.counts || {};
      if ($('#appNewLeadCount')) $('#appNewLeadCount').textContent = Number(counts.new_leads || 0).toLocaleString();
      if ($('#appPendingSubmissionCount')) $('#appPendingSubmissionCount').textContent = Number(counts.pending_submissions || 0).toLocaleString();
      if ($('#appActiveProjectCount')) $('#appActiveProjectCount').textContent = Number(counts.active_projects || 0).toLocaleString();
      updateNotifications(counts);
      renderActivity(dashboardData.recent_activity || []);
    }
    if (!adminAppStarted) {
      adminAppStarted = true;
      initialWorkspace();
    } else {
      const visible = $$('.admin-workspace').find(el => !el.hidden);
      if (visible) refreshWorkspaceData(visible.id);
    }
  }

  wireEvents();
  window.addEventListener('heera:admin-ready', event => applyBootstrap(event.detail));
  window.addEventListener('heera:admin-api-error', event => toast(event.detail?.message || 'Admin API connection failed.'));
  if (window.__HEERA_ADMIN_BOOTSTRAP__) applyBootstrap(window.__HEERA_ADMIN_BOOTSTRAP__);
})();
