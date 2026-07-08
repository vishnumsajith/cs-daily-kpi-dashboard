export function initFilters(elements, onChange) {
  Object.values(elements).forEach((element) => {
    if (element) element.addEventListener("change", onChange);
  });
}

export function populateFilters(model, elements) {
  fillSelect(elements.agent, unique(model.agents.map((agent) => agent.agent)), "All Agents");
  fillSelect(elements.tl, unique(model.agents.map((agent) => agent.tl)), "All TLs");
  fillSelect(elements.team, unique(model.agents.map((agent) => agent.team)), "All Teams");

  const types = unique(model.agents.flatMap((agent) => agent.daily.map((day) => day.type)));
  fillSelect(elements.type, types, "All Types");
}

export function getFilters(elements) {
  return {
    agent: elements.agent.value,
    tl: elements.tl.value,
    team: elements.team.value,
    date: elements.date.value,
    month: elements.month.value,
    type: elements.type.value
  };
}

export function resetFilters(elements) {
  Object.values(elements).forEach((element) => {
    if (element) element.value = "";
  });
}

function fillSelect(select, values, label) {
  const current = select.value;
  select.innerHTML = `<option value="">${label}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  if (values.includes(current)) select.value = current;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
