import { readWorkbookFile } from "./upload.js";
import { loadGoogleSheetSources } from "./googleSheets.js";
import { buildKpiModel, applyFilters } from "./calculations.js";
import { initFilters, populateFilters, getFilters, resetFilters } from "./filters.js";
import { renderCharts } from "./charts.js";
import { exportCsv, exportExcel, exportPdf } from "./export.js";
import { renderKpiCards, renderAgentTable, openAgentDrawer, closeAgentDrawer, setBanner, toast } from "./ui.js";

const state = {
  interactions: [],
  sheetSources: {},
  model: buildKpiModel([], {}),
  filteredModel: buildKpiModel([], {})
};

const filterElements = {
  agent: document.getElementById("agentFilter"),
  tl: document.getElementById("tlFilter"),
  team: document.getElementById("teamFilter"),
  date: document.getElementById("dateFilter"),
  month: document.getElementById("monthFilter"),
  type: document.getElementById("typeFilter")
};

boot();

async function boot() {
  bindEvents();
  render();
  await refreshSheets();
}

function bindEvents() {
  document.getElementById("reportUpload").addEventListener("change", handleUpload);
  document.getElementById("refreshSheets").addEventListener("click", refreshSheets);
  document.getElementById("resetFilters").addEventListener("click", () => {
    resetFilters(filterElements);
    applyAndRender();
  });
  document.getElementById("closeDrawer").addEventListener("click", closeAgentDrawer);
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
  document.getElementById("exportCsv").addEventListener("click", () => exportCsv(state.filteredModel.agents));
  document.getElementById("exportExcel").addEventListener("click", () => exportExcel(state.filteredModel.agents));
  document.getElementById("exportPdf").addEventListener("click", () => exportPdf(state.filteredModel.agents, state.filteredModel.summary));
  initFilters(filterElements, applyAndRender);
}

async function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    setBanner("loading", "Reading report", "The interaction report is being validated and processed.");
    const payload = await readWorkbookFile(file);
    state.interactions = payload.interactions || [];
    state.sheetSources = { ...state.sheetSources, ...(payload.sheetSources || {}) };
    rebuildModel();
    const sourceLabel = payload.mode === "daily-kpi-workbook" ? "Daily KPI workbook" : "interaction report";
    setBanner("success", "Report loaded", `${state.interactions.length.toLocaleString()} interaction rows processed from ${sourceLabel}: ${file.name}.`);
    toast("Daily KPI workbook loaded.");
  } catch (error) {
    console.error(error);
    setBanner("error", "Upload failed", "Check that the workbook has interaction creator, interaction type, and created date columns.");
  }
}

async function refreshSheets() {
  try {
    setBanner("loading", "Refreshing Google Sheets", "Agent master and supplemental KPI sources are loading.");
    state.sheetSources = await loadGoogleSheetSources();
    rebuildModel();
    const loaded = Object.values(state.sheetSources).reduce((sum, rows) => sum + rows.length, 0);
    setBanner("success", "Google Sheets refreshed", `${loaded.toLocaleString()} supplemental rows are available.`);
    toast("Google Sheet sources refreshed.");
  } catch (error) {
    console.error(error);
    setBanner("error", "Sheet refresh failed", "Review config.js for published CSV URLs or Google Sheets API credentials.");
  }
}

function rebuildModel() {
  state.model = buildKpiModel(state.interactions, state.sheetSources);
  populateFilters(state.model, filterElements);
  applyAndRender();
  document.getElementById("lastRefresh").textContent = new Date().toLocaleString();
}

function applyAndRender() {
  state.filteredModel = applyFilters(state.model, getFilters(filterElements));
  render();
}

function render() {
  renderKpiCards(state.filteredModel.summary);
  renderCharts(state.filteredModel);
  renderAgentTable(state.filteredModel.agents, (agentName) => {
    const agent = state.filteredModel.agents.find((item) => item.agent === agentName);
    if (agent) openAgentDrawer(agent);
  });
}

function toggleTheme() {
  document.documentElement.classList.toggle("dark");
  document.getElementById("themeIcon").textContent = document.documentElement.classList.contains("dark") ? "☀" : "☾";
}
