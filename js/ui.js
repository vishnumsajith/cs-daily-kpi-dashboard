import { renderMiniChart } from "./charts.js";

let dataTable = null;

export function renderKpiCards(summary) {
  const cards = [
    ["Total Agents", summary.totalAgents, [summary.totalAgents, 1]],
    ["Total Interactions", summary.totalInteractions, [summary.calls, summary.chats, summary.emails]],
    ["Total KPI Points", summary.totalPoints.toFixed(1), [summary.totalPoints, 1]],
    ["Chats", summary.chats, [summary.chats, Math.max(summary.totalInteractions - summary.chats, 0)]],
    ["Calls", summary.calls, [summary.calls, Math.max(summary.totalInteractions - summary.calls, 0)]],
    ["Emails", summary.emails, [summary.emails, Math.max(summary.totalInteractions - summary.emails, 0)]],
    ["Reviews", summary.reviews, [summary.reviews, 1]],
    ["Disputes", summary.disputes, [summary.disputes, 1]],
    ["QC Audits", summary.qcAudits, [summary.qcAudits, 1]],
    ["Ad Hoc Hours", summary.adHocHours.toFixed(1), [summary.adHocHours, 1]]
  ];

  const grid = document.getElementById("kpiGrid");
  grid.innerHTML = cards.map((card, index) => `
    <article class="kpi-card">
      <div>
        <span>${card[0]}</span>
        <strong>${card[1]}</strong>
      </div>
      <div class="mini-chart"><canvas id="miniChart${index}"></canvas></div>
    </article>
  `).join("");

  cards.forEach((card, index) => renderMiniChart(document.getElementById(`miniChart${index}`), ["Selected", "Other", "Third"], card[2]));
}

export function renderAgentTable(agents, onAgentClick) {
  if (dataTable) {
    dataTable.destroy();
    dataTable = null;
  }

  const tbody = document.querySelector("#agentTable tbody");
  tbody.innerHTML = agents.map((agent) => `
    <tr data-agent="${escapeHtml(agent.agent)}">
      <td>${escapeHtml(agent.agent)}</td>
      <td>${agent.calls}</td>
      <td>${agent.chats}</td>
      <td>${agent.emails}</td>
      <td>${agent.tlReviews}</td>
      <td>${round(agent.tlReviewPoints)}</td>
      <td>${agent.reviews}</td>
      <td>${round(agent.reviewPoints)}</td>
      <td>${agent.disputes}</td>
      <td>${round(agent.disputePoints)}</td>
      <td>${agent.auditedCalls}</td>
      <td>${agent.auditedEmails}</td>
      <td>${round(agent.qcPoints)}</td>
      <td>${round(agent.adHocHours)}</td>
      <td>${round(agent.totalPoints)}</td>
    </tr>
  `).join("");

  if (window.DataTable) {
    dataTable = new DataTable("#agentTable", { pageLength: 25, order: [[14, "desc"]], responsive: true });
  }

  document.querySelectorAll("#agentTable tbody tr").forEach((row) => {
    row.addEventListener("click", () => onAgentClick(row.dataset.agent));
  });
}

export function openAgentDrawer(agent) {
  const drawer = document.getElementById("agentDrawer");
  const content = document.getElementById("drawerContent");
  const dailyRows = [...agent.daily].sort((a, b) => a.date.localeCompare(b.date)).map((item) => `
    <tr><td>${item.date}</td><td>${titleCase(item.type)}</td><td>${item.count}</td><td>${round(item.points)}</td></tr>
  `).join("");

  content.innerHTML = `
    <p class="eyebrow">Agent detail</p>
    <h2>${escapeHtml(agent.agent)}</h2>
    <div class="drawer-summary">
      <span>${escapeHtml(agent.team)}</span>
      <span>${escapeHtml(agent.tl)}</span>
      <strong>${round(agent.totalPoints)} pts</strong>
    </div>
    <div class="drawer-metrics">
      <div><span>Calls</span><strong>${agent.calls}</strong></div>
      <div><span>Chats</span><strong>${agent.chats}</strong></div>
      <div><span>Emails</span><strong>${agent.emails}</strong></div>
      <div><span>Reviews</span><strong>${agent.reviews}</strong></div>
      <div><span>Disputes</span><strong>${agent.disputes}</strong></div>
      <div><span>Call Audits</span><strong>${agent.auditedCalls}</strong></div>
      <div><span>Email Audits</span><strong>${agent.auditedEmails}</strong></div>
    </div>
    <h3>Daily KPI Breakdown</h3>
    <table class="detail-table">
      <thead><tr><th>Date</th><th>Type</th><th>Count</th><th>Points</th></tr></thead>
      <tbody>${dailyRows || `<tr><td colspan="4">No daily interaction rows in the current filter.</td></tr>`}</tbody>
    </table>
  `;
  drawer.setAttribute("aria-hidden", "false");
}

export function closeAgentDrawer() {
  document.getElementById("agentDrawer").setAttribute("aria-hidden", "true");
}

export function setBanner(type, title, message) {
  const banner = document.getElementById("stateBanner");
  banner.className = `state-banner ${type}`;
  banner.innerHTML = `<div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
}

export function toast(message) {
  const region = document.getElementById("toastRegion");
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  region.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function round(value) {
  return Number(value || 0).toFixed(1);
}

function titleCase(value) {
  return String(value).replace(/\b\w/g, (char) => char.toUpperCase());
}
