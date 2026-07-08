import { renderMiniChart } from "./charts.js";

let dataTable = null;

const ALL_TABLE_COLUMNS = [
  "calls",
  "chats",
  "emails",
  "tl-reviews",
  "tl-review-points",
  "reviews",
  "review-points",
  "disputes",
  "dispute-points",
  "call-audits",
  "email-audits",
  "qc-points",
  "ad-hoc"
];

const TABLE_VIEW_COLUMNS = {
  publish: ["calls", "chats", "emails", "tl-reviews", "tl-review-points", "reviews", "disputes", "call-audits", "email-audits", "ad-hoc"],
  raw: ["calls", "chats", "emails", "tl-reviews", "tl-review-points"],
  reviews: ["reviews", "review-points"],
  disputes: ["disputes", "dispute-points"],
  qc: ["call-audits", "email-audits", "qc-points"],
  all: ALL_TABLE_COLUMNS
};

export function initTableViewControl() {
  const control = document.getElementById("tableViewFilter");
  const wrap = document.querySelector(".table-wrap");
  const checkboxes = [...document.querySelectorAll("[data-column-toggle]")];
  if (!control || !wrap) return;

  const applyColumnVisibility = () => {
    checkboxes.forEach((checkbox) => {
      document.querySelectorAll(`.col-${checkbox.dataset.columnToggle}`).forEach((cell) => {
        cell.classList.toggle("is-hidden-column", !checkbox.checked);
      });
    });
    if (dataTable) dataTable.columns.adjust();
  };

  const applyPreset = (view) => {
    const selectedColumns = TABLE_VIEW_COLUMNS[view] || TABLE_VIEW_COLUMNS.publish;
    checkboxes.forEach((checkbox) => {
      checkbox.checked = selectedColumns.includes(checkbox.dataset.columnToggle);
    });
    wrap.dataset.tableView = view;
    applyColumnVisibility();
  };

  control.addEventListener("change", () => {
    if (control.value !== "custom") applyPreset(control.value);
  });

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      control.value = "custom";
      wrap.dataset.tableView = "custom";
      applyColumnVisibility();
    });
  });

  applyPreset(control.value);
}

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
      <td class="col-raw col-calls">${agent.calls}</td>
      <td class="col-raw col-chats">${agent.chats}</td>
      <td class="col-raw col-emails">${agent.emails}</td>
      <td class="col-raw col-tl-reviews">${agent.tlReviews}</td>
      <td class="col-raw col-tl-points col-tl-review-points">${round(agent.tlReviewPoints)}</td>
      <td class="col-review col-reviews">${agent.reviews}</td>
      <td class="col-review col-review-points">${round(agent.reviewPoints)}</td>
      <td class="col-dispute col-disputes">${agent.disputes}</td>
      <td class="col-dispute col-dispute-points">${round(agent.disputePoints)}</td>
      <td class="col-qc col-call-audits">${agent.auditedCalls}</td>
      <td class="col-qc col-email-audits">${agent.auditedEmails}</td>
      <td class="col-qc col-qc-points">${round(agent.qcPoints)}</td>
      <td class="col-adhoc col-ad-hoc">${round(agent.adHocHours)}</td>
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
