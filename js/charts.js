const palette = ["#2563eb", "#0f766e", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#65a30d", "#be185d"];
const charts = new Map();

export function renderCharts(model) {
  renderPointsMix(model);
  renderTrend(model);
  renderTeamStack(model);
}

export function renderMiniChart(canvas, labels, data, type = "doughnut") {
  destroy(canvas.id);
  charts.set(canvas.id, new Chart(canvas, {
    type,
    data: { labels, datasets: [{ data, backgroundColor: palette, borderWidth: 0 }] },
    options: compactOptions()
  }));
}

function renderPointsMix(model) {
  const summary = model.summary;
  createChart("pointsMixChart", {
    type: "doughnut",
    data: {
      labels: ["Calls", "Chats", "Emails", "Reviews", "Disputes", "QC", "Ad Hoc"],
      datasets: [{
        data: [summary.calls, summary.chats * 1.5, summary.emails, summary.reviews, summary.disputes * 5, summary.qcAudits, summary.adHocHours],
        backgroundColor: palette,
        borderWidth: 0
      }]
    },
    options: standardOptions()
  });
}

function renderTrend(model) {
  const byDate = new Map();
  model.agents.flatMap((agent) => agent.daily).forEach((item) => {
    byDate.set(item.date, (byDate.get(item.date) || 0) + item.points);
  });
  const labels = [...byDate.keys()].sort();
  createChart("trendChart", {
    type: "line",
    data: {
      labels,
      datasets: [{ label: "KPI Points", data: labels.map((date) => byDate.get(date)), borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,.14)", tension: 0.35, fill: true }]
    },
    options: standardOptions()
  });
}

function renderTeamStack(model) {
  const teams = [...new Set(model.agents.map((agent) => agent.team))].sort();
  const fields = [
    ["Calls", "calls"],
    ["Chats", "chats"],
    ["Emails", "emails"],
    ["Reviews", "reviewPoints"],
    ["Disputes", "disputePoints"],
    ["QC", "qcPoints"]
  ];
  createChart("teamStackChart", {
    type: "bar",
    data: {
      labels: teams,
      datasets: fields.map(([label, field], index) => ({
        label,
        data: teams.map((team) => model.agents.filter((agent) => agent.team === team).reduce((sum, agent) => sum + agent[field], 0)),
        backgroundColor: palette[index]
      }))
    },
    options: { ...standardOptions(), scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
  });
}

function createChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  destroy(id);
  charts.set(id, new Chart(canvas, config));
}

function destroy(id) {
  if (charts.has(id)) {
    charts.get(id).destroy();
    charts.delete(id);
  }
}

function standardOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" } }
  };
}

function compactOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    cutout: "72%"
  };
}
