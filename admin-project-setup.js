(() => {
  'use strict';

  const state = { projects: [], subProjects: [], blocks: [], marlaCategories: [] };
  const byId = (id) => document.getElementById(id);
  const safe = (value = '') => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);

  function projectOptions(selected = '') {
    return '<option value="">Choose project</option>' + state.projects.map(project =>
      `<option value="${Number(project.project_id)}"${String(project.project_id) === String(selected) ? ' selected' : ''}>${safe(project.title)}</option>`
    ).join('');
  }

  function subProjectOptions(projectId, selected = '', emptyLabel = 'No subproject') {
    const items = state.subProjects.filter(item => Number(item.project_id) === Number(projectId));
    return `<option value="">${safe(emptyLabel)}</option>` + items.map(item =>
      `<option value="${Number(item.sub_project_id)}"${String(item.sub_project_id) === String(selected) ? ' selected' : ''}>${safe(item.name)}</option>`
    ).join('');
  }

  function setMessage(form, message, isError = false) {
    const output = form?.querySelector('.property-message');
    if (!output) return;
    output.textContent = message;
    output.classList.toggle('error', isError);
  }

  function resetForm(form) {
    if (!form) return;
    form.reset();
    [...form.querySelectorAll('input[type="hidden"]')].forEach(input => { input.value = ''; });
    const cancel = form.querySelector('.setup-cancel');
    if (cancel) cancel.hidden = true;
    setMessage(form, '');
    syncSetupFormOptions();
  }

  function syncSetupFormOptions() {
    const subForm = byId('setupSubProjectForm');
    const blockForm = byId('setupBlockForm');
    if (subForm) {
      const selected = subForm.elements.project_id.value;
      subForm.elements.project_id.innerHTML = projectOptions(selected);
    }
    if (blockForm) {
      const projectId = blockForm.elements.project_id.value;
      const selectedProject = projectId;
      const selectedSubProject = blockForm.elements.sub_project_id.value;
      blockForm.elements.project_id.innerHTML = projectOptions(selectedProject);
      blockForm.elements.sub_project_id.innerHTML = subProjectOptions(projectId, selectedSubProject, 'All project');
      blockForm.elements.sub_project_id.disabled = !projectId;
    }
  }

  function row(title, subtitle, type, id) {
    return `<div class="setup-row"><div><strong>${safe(title)}</strong><small>${safe(subtitle)}</small></div><div class="setup-row__actions"><button type="button" class="setup-edit" data-type="${type}" data-id="${Number(id)}">Edit</button><button type="button" class="setup-delete" data-type="${type}" data-id="${Number(id)}">Delete</button></div></div>`;
  }

  function render() {
    byId('setupProjectCount').textContent = String(state.projects.length);
    byId('setupSubProjectCount').textContent = String(state.subProjects.length);
    byId('setupBlockCount').textContent = String(state.blocks.length);
    byId('setupMarlaCount').textContent = String(state.marlaCategories.length);

    byId('setupProjectList').innerHTML = state.projects.length ? state.projects.map(item =>
      row(item.title, `${item.status} · ${Number(item.property_count || 0)} properties · ${Number(item.sub_project_count || 0)} subprojects`, 'project', item.project_id)
    ).join('') : '<p class="setup-empty">No projects yet.</p>';
    byId('setupSubProjectList').innerHTML = state.subProjects.length ? state.subProjects.map(item =>
      row(item.name, `${item.project_title} · ${Number(item.property_count || 0)} properties`, 'subproject', item.sub_project_id)
    ).join('') : '<p class="setup-empty">No subprojects yet.</p>';
    byId('setupBlockList').innerHTML = state.blocks.length ? state.blocks.map(item =>
      row(item.name, `${item.project_title}${item.sub_project_name ? ` · ${item.sub_project_name}` : ''} · ${Number(item.property_count || 0)} properties`, 'block', item.block_id)
    ).join('') : '<p class="setup-empty">No blocks yet.</p>';
    byId('setupMarlaList').innerHTML = state.marlaCategories.length ? state.marlaCategories.map(item =>
      row(item.name, `${item.marla_value ? `${Number(item.marla_value)} Marla · ` : ''}${Number(item.usage_count || 0)} uses`, 'marla', item.marla_category_id)
    ).join('') : '<p class="setup-empty">No Marla categories yet.</p>';

    syncSetupFormOptions();
    syncProjectCatalogSelect();
    syncPropertyMarlaOptions();
    syncPropertyBlockOptions();
  }

  async function loadProjectSetup() {
    const result = await api('admin_project_setup');
    state.projects = Array.isArray(result.projects) ? result.projects : [];
    state.subProjects = Array.isArray(result.sub_projects) ? result.sub_projects : [];
    state.blocks = Array.isArray(result.blocks) ? result.blocks : [];
    state.marlaCategories = Array.isArray(result.marla_categories) ? result.marla_categories : [];
    render();
    return result;
  }

  function syncProjectCatalogSelect(preferredId = null) {
    const select = byId('projectCatalogSelect');
    const hiddenId = document.querySelector('#projectForm [name="project_id"]');
    if (!select || !hiddenId) return;
    const currentId = preferredId !== null ? String(preferredId || '') : String(hiddenId.value || '');
    const projects = (adminState.projects || []).length ? adminState.projects : state.projects;
    select.innerHTML = '<option value="">Choose a name from Project Setup</option>' + projects.map(project =>
      `<option value="${safe(project.title)}" data-project-id="${Number(project.project_id)}">${safe(project.title)}${project.status !== 'published' ? ' (Draft)' : ''}</option>`
    ).join('');
    const match = [...select.options].find(option => option.dataset.projectId === currentId);
    if (match) select.value = match.value;
  }

  function syncPropertyBlockOptions(preferredName = null) {
    const select = byId('propertyBlockSelect');
    const projectId = byId('propertyProjectSelect')?.value || '';
    const subProjectId = byId('propertySubProjectId')?.value || '';
    if (!select) return;
    const currentName = preferredName !== null ? String(preferredName || '') : String(select.selectedOptions[0]?.dataset.name || '');
    if (!projectId) {
      select.innerHTML = '<option value="">Choose a project first</option>';
      select.disabled = true;
      return;
    }
    const items = state.blocks.filter(item =>
      Number(item.project_id) === Number(projectId) &&
      String(item.status) === 'active' &&
      (!item.sub_project_id || (subProjectId && Number(item.sub_project_id) === Number(subProjectId)))
    );
    select.innerHTML = '<option value="">No block selected</option>' + items.map(item =>
      `<option value="${Number(item.block_id)}" data-name="${safe(item.name)}">${safe(item.name)}${item.sub_project_name ? ` — ${safe(item.sub_project_name)}` : ''}</option>`
    ).join('');
    const match = [...select.options].find(option => String(option.dataset.name || '').localeCompare(currentName, undefined, { sensitivity: 'accent' }) === 0);
    if (match) select.value = match.value;
    select.disabled = items.length < 1;
  }

  function syncPropertyMarlaOptions(preferredName = null) {
    const select = byId('propertyMarlaSelect');
    if (!select) return;
    const currentName = preferredName !== null ? String(preferredName || '') : String(select.selectedOptions[0]?.dataset.name || '');
    const items = state.marlaCategories.filter(item => String(item.status) === 'active');
    select.innerHTML = '<option value="">Choose size</option>' + items.map(item =>
      `<option value="${Number(item.marla_category_id)}" data-name="${safe(item.name)}">${safe(item.name)}</option>`
    ).join('');
    const match = [...select.options].find(option => String(option.dataset.name || '').localeCompare(currentName, undefined, { sensitivity: 'accent' }) === 0);
    if (match) select.value = match.value;
  }

  function edit(type, id) {
    const maps = {
      project: [state.projects, 'project_id', 'setupProjectForm'],
      subproject: [state.subProjects, 'sub_project_id', 'setupSubProjectForm'],
      block: [state.blocks, 'block_id', 'setupBlockForm'],
      marla: [state.marlaCategories, 'marla_category_id', 'setupMarlaForm']
    };
    const config = maps[type];
    if (!config) return;
    const item = config[0].find(entry => Number(entry[config[1]]) === Number(id));
    const form = byId(config[2]);
    if (!item || !form) return;
    if (type === 'project') {
      form.elements.project_id.value = item.project_id;
      form.elements.title.value = item.title;
    } else if (type === 'subproject') {
      form.elements.sub_project_id.value = item.sub_project_id;
      form.elements.project_id.value = item.project_id;
      form.elements.name.value = item.name;
    } else if (type === 'block') {
      form.elements.block_id.value = item.block_id;
      form.elements.project_id.value = item.project_id;
      syncSetupFormOptions();
      form.elements.sub_project_id.value = item.sub_project_id || '';
      form.elements.name.value = item.name;
    } else {
      form.elements.marla_category_id.value = item.marla_category_id;
      form.elements.name.value = item.name;
      form.elements.marla_value.value = item.marla_value || '';
    }
    form.querySelector('.setup-cancel').hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function remove(type, id) {
    const actions = {
      project: ['delete_project_name', 'project_id'],
      subproject: ['delete_sub_project', 'sub_project_id'],
      block: ['delete_project_block', 'block_id'],
      marla: ['delete_marla_category', 'marla_category_id']
    };
    const [action, key] = actions[type] || [];
    if (!action || !confirm('Delete this saved option? In-use options must be reassigned first.')) return;
    try {
      await api(action, { [key]: id });
      await Promise.allSettled([loadProjectSetup(), loadProjects(), loadSubProjects()]);
    } catch (error) {
      alert(error.message);
    }
  }

  function bindForm(formId, action, fields) {
    const form = byId(formId);
    if (!form) return;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const body = {};
      fields.forEach(name => { body[name] = form.elements[name]?.value?.trim?.() ?? form.elements[name]?.value ?? ''; });
      setMessage(form, 'Saving…');
      try {
        await api(action, body);
        resetForm(form);
        await Promise.allSettled([loadProjectSetup(), loadProjects(), loadSubProjects()]);
        setMessage(form, 'Saved. The option is now available in selection lists.');
      } catch (error) {
        setMessage(form, error.message, true);
      }
    });
    form.querySelector('.setup-cancel')?.addEventListener('click', () => resetForm(form));
  }

  byId('setupBlockForm')?.elements.project_id.addEventListener('change', syncSetupFormOptions);
  byId('projectSetupWorkspace')?.addEventListener('click', event => {
    const button = event.target.closest('[data-type][data-id]');
    if (!button) return;
    if (button.classList.contains('setup-edit')) edit(button.dataset.type, button.dataset.id);
    if (button.classList.contains('setup-delete')) remove(button.dataset.type, button.dataset.id);
  });
  byId('propertySubProjectId')?.addEventListener('change', () => {
    syncPropertyBlockOptions();
    if (typeof syncPropertyPaymentPlanOptions === 'function') syncPropertyPaymentPlanOptions(null);
  });
  byId('projectCatalogSelect')?.addEventListener('change', event => {
    const id = Number(event.target.selectedOptions[0]?.dataset.projectId || 0);
    const hidden = document.querySelector('#projectForm [name="project_id"]');
    if (hidden) hidden.value = id || '';
    const project = (adminState.projects || []).find(item => Number(item.project_id) === id);
    if (project && typeof populateProjectEditor === 'function') populateProjectEditor(project);
  });

  bindForm('setupProjectForm', 'save_project_name', ['project_id', 'title']);
  bindForm('setupSubProjectForm', 'save_sub_project', ['sub_project_id', 'project_id', 'name']);
  bindForm('setupBlockForm', 'save_project_block', ['block_id', 'project_id', 'sub_project_id', 'name']);
  bindForm('setupMarlaForm', 'save_marla_category', ['marla_category_id', 'name', 'marla_value']);

  window.loadProjectSetup = loadProjectSetup;
  window.syncProjectCatalogSelect = syncProjectCatalogSelect;
  window.syncPropertyBlockOptions = syncPropertyBlockOptions;
  window.syncPropertyMarlaOptions = syncPropertyMarlaOptions;
  window.HeeraProjectSetup = {
    state,
    blocksFor(projectId, subProjectId = '') {
      return state.blocks.filter(item => Number(item.project_id) === Number(projectId) && (!item.sub_project_id || (subProjectId && Number(item.sub_project_id) === Number(subProjectId))));
    },
    marlaCategories() { return state.marlaCategories.slice(); }
  };
})();
