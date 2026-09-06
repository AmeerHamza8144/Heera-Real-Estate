(() => {
  'use strict';

  const routeMap = {
    bootstrap: 'bootstrap',
    csrf: 'csrf',
    session: 'session',
    logout: 'logout',
    admin_dashboard: 'dashboard',
    admin_properties: 'properties',
    save_property: 'properties/save',
    delete_property: 'properties/delete',
    admin_projects: 'projects',
    save_project: 'projects/save',
    delete_project: 'projects/delete',
    admin_sub_projects: 'sub-projects',
    save_sub_project: 'sub-projects/save',
    delete_sub_project: 'sub-projects/delete',
    admin_payment_plans: 'payment-plans',
    admin_enquiries: 'crm/leads',
    admin_crm_leads: 'crm/leads',
    crm_stats: 'crm/stats',
    crm_create_lead: 'crm/leads/create',
    save_enquiry_status: 'crm/leads/update',
    save_crm_lead: 'crm/leads/update',
    admin_submissions: 'submissions',
    save_submission: 'submissions/save',
    approve_submission: 'submissions/approve',
    admin_digital_maps: 'maps',
    save_digital_map: 'maps/save',
    delete_digital_map: 'maps/delete',
    save_digital_map_block: 'maps/blocks/save',
    delete_digital_map_block: 'maps/blocks/delete',
    admin_home_gallery: 'gallery',
    save_home_gallery: 'gallery/save',
    delete_home_gallery: 'gallery/delete',
    admin_popups: 'popups',
    save_popup: 'popups/save',
    delete_popup: 'popups/delete',
    admin_agents: 'agents',
    save_agent: 'agents/save',
    delete_agent: 'agents/delete',
    ai_advisor_recommend: 'advisor/recommend',
    ai_advisor_history: 'advisor/history',
    admin_office_addresses: 'offices',
    save_office_address: 'offices/save',
    delete_office_address: 'offices/delete',
    admin_login_users: 'users',
    save_login_user: 'users/save',
    delete_login_user: 'users/delete',
    admin_role_options: 'role-options',
    admin_roles: 'roles',
    save_role: 'roles/save',
    delete_role: 'roles/delete',
    upload: 'upload',
    health: 'health'
  };

  let csrfToken = '';
  let prettyRoutesAvailable = true;

  function routeFor(action) {
    return routeMap[action] || String(action || '').replace(/^\/+|\/+$/g, '');
  }

  async function parseResponse(response) {
    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; }
    catch {
      const error = new Error('The Admin API returned an invalid response. Check PHP/server logs.');
      error.status = response.status;
      throw error;
    }
    if (!response.ok) {
      const error = new Error(result.error || `Admin API request failed (${response.status}).`);
      error.status = response.status;
      error.payload = result;
      throw error;
    }
    if (result.csrf_token) csrfToken = result.csrf_token;
    return result;
  }

  function buildOptions(data, isUpload) {
    const hasBody = data !== null && data !== undefined;
    const options = {
      method: hasBody ? 'POST' : 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store'
    };
    if (hasBody && csrfToken) options.headers['X-CSRF-Token'] = csrfToken;
    if (hasBody && isUpload) {
      options.body = data;
    } else if (hasBody) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
    return options;
  }

  async function directFetch(route, options, query = '') {
    const qs = query ? (query.startsWith('?') ? query : `?${query}`) : '';
    return fetch(`admin-api.php?route=${encodeURIComponent(route)}${query ? `&${query.replace(/^\?/, '')}` : ''}`, options);
  }

  async function routedFetch(route, options, query = '') {
    const suffix = query ? (query.startsWith('?') ? query : `?${query}`) : '';
    if (!prettyRoutesAvailable) return directFetch(route, options, query);
    const response = await fetch(`api/v1/admin/${route}${suffix}`, options);
    const version = response.headers.get('X-Heera-Admin-API-Version');
    if (response.status === 404 && !version) {
      prettyRoutesAvailable = false;
      return directFetch(route, options, query);
    }
    return response;
  }

  async function ensureCsrf() {
    if (csrfToken) return csrfToken;
    const response = await routedFetch('csrf', buildOptions(null, false));
    const result = await parseResponse(response);
    csrfToken = result.csrf_token || '';
    if (!csrfToken) throw new Error('Could not create a secure admin session.');
    return csrfToken;
  }

  async function request(action, data = null, isUpload = false, query = '') {
    const route = routeFor(action);
    if (data !== null && data !== undefined) await ensureCsrf();
    const response = await routedFetch(route, buildOptions(data, isUpload), query);
    return parseResponse(response);
  }

  async function get(action, params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(action, null, false, query);
  }

  async function bootstrap() { return request('bootstrap'); }
  async function health() { return request('health'); }

  window.HeeraAdminAPI = {
    version: 'v1',
    request,
    get,
    bootstrap,
    health,
    setCsrfToken(value) { csrfToken = String(value || ''); },
    getCsrfToken() { return csrfToken; },
    routeFor
  };
})();
