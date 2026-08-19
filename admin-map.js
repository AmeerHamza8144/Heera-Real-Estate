(function () {
  "use strict";
  const elements = {
    workspace: document.querySelector("#plotMapWorkspace"), project: document.querySelector("#adminMapProject"), block: document.querySelector("#adminMapBlock"),
    form: document.querySelector("#mapPlotForm"), message: document.querySelector("#mapManagerMessage"), list: document.querySelector("#mappedPlotList"),
    search: document.querySelector("#mappedPlotSearch"), coordinate: document.querySelector("#mapCoordinateText"), hint: document.querySelector("#adminMapHint")
  };
  if (!elements.workspace) return;
  const state = { map: null, polygonMode: false, polygon: [], loaded: false };

  function message(text, error = false) { elements.message.textContent = text; elements.message.classList.toggle("error", error); }
  function currentProject() { return adminState.mapProjects.find((item) => Number(item.id) === Number(elements.project.value)); }
  function currentProjectPlots() { return adminState.mapPlots.filter((item) => Number(item.project_id) === Number(elements.project.value)); }

  function refreshPropertyOptions() {
    const select = elements.form.elements.property_id;
    const selected = select.value;
    select.innerHTML = '<option value="">No linked listing</option>' + (adminState.properties || []).map((property) => `<option value="${Number(property.property_id)}">#${Number(property.property_id)} · ${escapeHtml(property.title)}</option>`).join("");
    select.value = selected;
  }
  window.refreshMapPropertyOptions = refreshPropertyOptions;

  function renderProjectOptions() {
    const selected = elements.project.value;
    elements.project.innerHTML = adminState.mapProjects.length ? adminState.mapProjects.map((project) => `<option value="${Number(project.id)}">${escapeHtml(project.name)}</option>`).join("") : '<option value="">No map project</option>';
    if (adminState.mapProjects.some((project) => String(project.id) === selected)) elements.project.value = selected;
  }

  function renderBlockOptions() {
    const selected = elements.block.value;
    const blocks = adminState.mapBlocks.filter((block) => Number(block.project_id) === Number(elements.project.value));
    elements.block.innerHTML = blocks.length ? `<option value="">Choose block</option>${blocks.map((block) => `<option value="${Number(block.id)}">${escapeHtml(block.name)}</option>`).join("")}` : '<option value="">Create a block first</option>';
    if (blocks.some((block) => String(block.id) === selected)) elements.block.value = selected;
  }

  function initializeMap() {
    const project = currentProject();
    if (!project) return;
    if (!state.map) {
      state.map = new HeeraImageMap(document.querySelector("#adminPlotMap"), { image: project.map_image, width: project.original_width, height: project.original_height, alt: `${project.name} editable map` });
      document.querySelector("#adminPlotMap").addEventListener("mapclick", (event) => {
        const point = { x: Number(event.detail.x.toFixed(8)), y: Number(event.detail.y.toFixed(8)) };
        if (state.polygonMode) {
          state.polygon.push(point); state.map.setPolygonDraft(state.polygon);
          elements.hint.textContent = `${state.polygon.length} boundary point${state.polygon.length === 1 ? "" : "s"}. Continue clicking, then finish.`;
        } else {
          elements.form.elements.normalized_x.value = point.x;
          elements.form.elements.normalized_y.value = point.y;
          elements.coordinate.textContent = `${point.x.toFixed(6)}, ${point.y.toFixed(6)}`;
          elements.hint.textContent = "Marker position selected. Complete the plot details and save.";
          renderMapMarkers();
        }
      });
    } else state.map.setImage(project.map_image, project.original_width, project.original_height, `${project.name} editable map`);
    renderMapMarkers();
  }

  function draftPlot() {
    const x = Number(elements.form.elements.normalized_x.value), y = Number(elements.form.elements.normalized_y.value);
    if (!Number.isFinite(x) || !Number.isFinite(y) || elements.form.elements.normalized_x.value === "") return null;
    return { id: 0, normalized_x: x, normalized_y: y, marker_size: Number(elements.form.elements.marker_size.value), status: elements.form.elements.status.value, plot_number: elements.form.elements.plot_number.value || "New", block_name: "Unsaved", polygon_coordinates: state.polygon };
  }

  function renderMapMarkers() {
    if (!state.map) return;
    const plots = currentProjectPlots();
    const draft = draftPlot();
    state.map.setMarkers(draft ? [...plots, draft] : plots, { onMarkerClick: (plot) => { if (Number(plot.id)) editPlot(plot); } });
    state.map.setPolygonDraft(state.polygon);
  }

  function renderPlotList() {
    const query = elements.search.value.trim().toLowerCase();
    const plots = currentProjectPlots().filter((plot) => !query || `${plot.block_name} ${plot.plot_number} ${plot.plot_size || ""}`.toLowerCase().includes(query));
    document.querySelector("#mappedPlotCount").textContent = `${currentProjectPlots().length} plot${currentProjectPlots().length === 1 ? "" : "s"}`;
    elements.list.innerHTML = plots.length ? plots.map((plot) => `<article class="mapped-plot-item"><span class="plot-status-dot ${escapeHtml(plot.status)}"></span><div><h3>${escapeHtml(plot.block_name)} · Plot ${escapeHtml(plot.plot_number)}</h3><p>${escapeHtml(plot.plot_size || "Size not provided")} · ${escapeHtml(plot.status)}</p></div><button class="edit-map-plot" data-id="${Number(plot.id)}" type="button">Edit</button></article>`).join("") : '<p class="empty-list">No mapped plots match this project and search.</p>';
  }

  function resetPlotEditor() {
    elements.form.reset(); elements.form.elements.id.value = ""; elements.form.elements.normalized_x.value = ""; elements.form.elements.normalized_y.value = ""; elements.form.elements.polygon_coordinates.value = "";
    elements.form.elements.marker_size.value = 24; document.querySelector("#mapMarkerSizeOutput").textContent = "24 px";
    state.polygon = []; state.polygonMode = false; elements.coordinate.textContent = "Click the map to choose"; elements.hint.textContent = "Click the exact centre of a plot to set its marker.";
    document.querySelector("#mapPlotEditorTitle").textContent = "Register a plot"; document.querySelector("#cancelMapPlotEdit").hidden = true; document.querySelector("#deleteMapPlot").hidden = true; document.querySelector("#finishPolygon").hidden = true; document.querySelector("#startPolygon").hidden = false;
    renderMapMarkers();
  }

  function editPlot(plot) {
    if (Number(elements.project.value) !== Number(plot.project_id)) { elements.project.value = String(plot.project_id); projectChanged(false); }
    renderBlockOptions(); elements.block.value = String(plot.block_id);
    ["id","plot_number","plot_size","plot_type","facing","status","price","normalized_x","normalized_y","marker_size","property_id"].forEach((name) => { elements.form.elements[name].value = plot[name] ?? ""; });
    state.polygon = Array.isArray(plot.polygon_coordinates) ? plot.polygon_coordinates.map((point) => ({ x: Number(point.x), y: Number(point.y) })) : [];
    elements.form.elements.polygon_coordinates.value = JSON.stringify(state.polygon);
    elements.coordinate.textContent = `${Number(plot.normalized_x).toFixed(6)}, ${Number(plot.normalized_y).toFixed(6)}`;
    document.querySelector("#mapMarkerSizeOutput").textContent = `${Number(plot.marker_size)} px`;
    document.querySelector("#mapPlotEditorTitle").textContent = `${plot.block_name} · Plot ${plot.plot_number}`; document.querySelector("#cancelMapPlotEdit").hidden = false; document.querySelector("#deleteMapPlot").hidden = false;
    elements.hint.textContent = "Click a new position to move this marker, or edit its details.";
    renderMapMarkers(); state.map.focus(Number(plot.normalized_x), Number(plot.normalized_y), 7); state.map.pulsePlot(plot.id);
    document.querySelector(".map-plot-editor").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function projectChanged(reset = true) {
    renderBlockOptions(); initializeMap(); renderPlotList(); if (reset) resetPlotEditor();
  }

  async function loadManager() {
    try {
      message("Loading plot map data…");
      const data = await api("admin_map_data");
      adminState.mapProjects = data.projects || []; adminState.mapBlocks = data.blocks || []; adminState.mapPlots = data.plots || []; adminState.csrfToken = data.csrf_token || adminState.csrfToken;
      renderProjectOptions(); renderBlockOptions(); refreshPropertyOptions(); initializeMap(); renderPlotList(); state.loaded = true; message("Plot Map Manager is ready.");
    } catch (error) { message(error.message, true); }
  }
  window.loadPlotMapManager = loadManager;

  document.querySelectorAll('.admin-tab[data-workspace="plotMapWorkspace"]').forEach((tab) => tab.addEventListener("click", () => setTimeout(() => state.map?.fit(false), 80)));
  elements.project.addEventListener("change", () => projectChanged());
  elements.search.addEventListener("input", renderPlotList);
  elements.list.addEventListener("click", (event) => { const plot = adminState.mapPlots.find((item) => Number(item.id) === Number(event.target.dataset.id)); if (event.target.classList.contains("edit-map-plot") && plot) editPlot(plot); });

  document.querySelector("#mapProjectForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const fields=event.currentTarget.elements; message("Creating map project…");
    try { const result=await api("save_map_project",{name:fields.name.value.trim(),map_image:fields.map_image.value.trim(),original_width:fields.original_width.value,original_height:fields.original_height.value}); await loadManager(); elements.project.value=String(result.id); projectChanged(); event.currentTarget.reset(); message("Map project created."); }
    catch(error){message(error.message,true);}
  });

  document.querySelector("#mapBlockForm").addEventListener("submit", async (event) => {
    event.preventDefault(); if(!elements.project.value)return message("Choose a map project first.",true); message("Creating block…");
    try { const result=await api("save_map_block",{project_id:elements.project.value,name:event.currentTarget.elements.name.value.trim()}); await loadManager(); elements.block.value=String(result.id); event.currentTarget.reset(); message("Block created. Click the exact plot centre on the map."); }
    catch(error){message(error.message,true);}
  });

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault(); const fields=event.currentTarget.elements;
    if(!elements.project.value||!elements.block.value)return message("Choose a project and block first.",true);
    if(fields.normalized_x.value===""||fields.normalized_y.value==="")return message("Click the exact centre of the plot on the map first.",true);
    const body={id:fields.id.value,project_id:elements.project.value,block_id:elements.block.value,plot_number:fields.plot_number.value.trim(),plot_size:fields.plot_size.value.trim(),plot_type:fields.plot_type.value.trim(),facing:fields.facing.value.trim(),status:fields.status.value,price:fields.price.value,normalized_x:fields.normalized_x.value,normalized_y:fields.normalized_y.value,marker_size:fields.marker_size.value,polygon_coordinates:state.polygon,property_id:fields.property_id.value};
    message("Saving mapped plot…");
    try { await api("save_map_plot",body); await loadManager(); resetPlotEditor(); message("Plot location and details saved."); }
    catch(error){message(error.message,true);}
  });

  document.querySelector("#cancelMapPlotEdit").addEventListener("click",resetPlotEditor);
  document.querySelector("#deleteMapPlot").addEventListener("click",async()=>{const id=Number(elements.form.elements.id.value);if(!id||!confirm("Delete this mapped plot?"))return;try{await api("delete_map_plot",{id});await loadManager();resetPlotEditor();message("Mapped plot deleted.");}catch(error){message(error.message,true);}});
  elements.form.elements.marker_size.addEventListener("input",()=>{document.querySelector("#mapMarkerSizeOutput").textContent=`${elements.form.elements.marker_size.value} px`;renderMapMarkers();});
  elements.form.elements.status.addEventListener("change",renderMapMarkers);

  document.querySelector("#startPolygon").addEventListener("click",()=>{state.polygon=[];state.polygonMode=true;document.querySelector("#startPolygon").hidden=true;document.querySelector("#finishPolygon").hidden=false;elements.hint.textContent="Boundary drawing: click each corner of the plot, then choose Finish boundary.";state.map?.setPolygonDraft([]);});
  document.querySelector("#finishPolygon").addEventListener("click",()=>{if(state.polygon.length<3)return message("Add at least three boundary points.",true);state.polygonMode=false;elements.form.elements.polygon_coordinates.value=JSON.stringify(state.polygon);document.querySelector("#finishPolygon").hidden=true;document.querySelector("#startPolygon").hidden=false;elements.hint.textContent="Plot boundary saved in the editor. Save the mapped plot to keep it.";renderMapMarkers();message("Boundary ready to save.");});
  document.querySelector("#clearPolygon").addEventListener("click",()=>{state.polygon=[];state.polygonMode=false;elements.form.elements.polygon_coordinates.value="";document.querySelector("#finishPolygon").hidden=true;document.querySelector("#startPolygon").hidden=false;state.map?.setPolygonDraft([]);message("Plot boundary cleared.");});
  document.querySelector("#adminMapZoomIn").addEventListener("click",()=>state.map?.zoomBy(1.4));document.querySelector("#adminMapZoomOut").addEventListener("click",()=>state.map?.zoomBy(.72));document.querySelector("#adminMapFit").addEventListener("click",()=>state.map?.fit());document.querySelector("#adminMapFullscreen").addEventListener("click",()=>state.map?.toggleFullscreen());

  function csvCell(value){const string=String(value??"");return /[",\n]/.test(string)?`"${string.replace(/"/g,'""')}"`:string;}
  document.querySelector("#mapCsvExport").addEventListener("click",()=>{
    const columns=["block","plot_number","plot_size","plot_type","facing","status","price","normalized_x","normalized_y","marker_size","polygon_coordinates","property_id"];
    const lines=[columns.join(","),...currentProjectPlots().map(plot=>columns.map(column=>csvCell(column==="block"?plot.block_name:column==="polygon_coordinates"?(plot.polygon_coordinates?.length?JSON.stringify(plot.polygon_coordinates):""):plot[column])).join(","))];
    const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`${(currentProject()?.name||"plot-map").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}-plots.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),500);message(`${currentProjectPlots().length} mapped plots exported.`);
  });

  function parseCsv(text){const rows=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const char=text[i];if(quoted){if(char==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(char==='"')quoted=false;else cell+=char;}else if(char==='"')quoted=true;else if(char===','){row.push(cell);cell="";}else if(char==='\n'){row.push(cell);rows.push(row);row=[];cell="";}else if(char!=='\r')cell+=char;}row.push(cell);if(row.some(value=>value!==""))rows.push(row);const headers=(rows.shift()||[]).map(value=>value.trim().replace(/^\uFEFF/,""));return rows.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??""])));}
  document.querySelector("#mapCsvImport").addEventListener("change",async(event)=>{const file=event.target.files[0];if(!file)return;if(!elements.project.value){message("Choose a map project before importing.",true);event.target.value="";return;}try{const rows=parseCsv(await file.text());message(`Importing ${rows.length} CSV row${rows.length===1?"":"s"}…`);const result=await api("import_map_plots",{project_id:elements.project.value,rows});await loadManager();message(`${result.imported} plot row${result.imported===1?"":"s"} imported or updated.`);}catch(error){message(error.message,true);}event.target.value="";});
  if (!document.querySelector("#dashboard")?.hidden) loadManager();
})();
