export function exportCsv(agents) {
  const rows = tableRows(agents);
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename("csv"));
}

export function exportExcel(agents) {
  const worksheet = XLSX.utils.aoa_to_sheet(tableRows(agents));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Daily KPI");
  XLSX.writeFile(workbook, filename("xlsx"));
}

export function exportPdf(agents, summary) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("CS Daily KPI Dashboard", 14, 16);
  doc.setFontSize(10);
  doc.text(`Agents: ${summary.totalAgents}  Interactions: ${summary.totalInteractions}  Points: ${summary.totalPoints.toFixed(1)}`, 14, 24);
  let y = 34;
  tableRows(agents).slice(0, 26).forEach((row, index) => {
    doc.text(row.map((cell) => String(cell).slice(0, 18)).join("   "), 14, y);
    y += index === 0 ? 8 : 7;
  });
  doc.save(filename("pdf"));
}

function tableRows(agents) {
  const header = ["Agent", "Calls", "Chats", "Emails", "TL Reviews", "TL Review Points", "Reviews Handled", "Review Points", "Disputes Handled", "Dispute Points", "Call Audits", "Email Audits", "QC Points", "Ad Hoc Hours", "Total KPI Points"];
  const body = agents.map((agent) => [
    agent.agent,
    agent.calls,
    agent.chats,
    agent.emails,
    agent.tlReviews,
    round(agent.tlReviewPoints),
    agent.reviews,
    round(agent.reviewPoints),
    agent.disputes,
    round(agent.disputePoints),
    agent.auditedCalls,
    agent.auditedEmails,
    round(agent.qcPoints),
    round(agent.adHocHours),
    round(agent.totalPoints)
  ]);
  return [header, ...body];
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function filename(extension) {
  return `cs-daily-kpi-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function round(value) {
  return Number(value || 0).toFixed(1);
}
