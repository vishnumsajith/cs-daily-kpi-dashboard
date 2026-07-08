import { normalizeRows } from "./calculations.js";

export async function readWorkbookFile(file) {
  if (!file) return [];
  const extension = file.name.split(".").pop().toLowerCase();
  const buffer = await file.arrayBuffer();

  if (extension === "csv") {
    const text = new TextDecoder().decode(buffer);
    const workbook = XLSX.read(text, { type: "string" });
    return { interactions: sheetToRows(workbook), sheetSources: {}, mode: "csv" };
  }

  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  return extractDailyKpiWorkbook(workbook);
}

function sheetToRows(workbook) {
  const firstSheet = workbook.SheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
    defval: "",
    raw: true
  });
  return normalizeRows(rawRows);
}

function extractDailyKpiWorkbook(workbook) {
  const sheet = (name) => workbook.Sheets[name];
  const rows = (name, requiredHeaders = []) => (sheet(name) ? readTableRows(sheet(name), requiredHeaders) : []);

  const interactions = rows("Interaction Report", ["Interaction Created By", "Date Worked For"]);
  const additionalTasks = rows("Additional Tasks", ["Name of Agent", "Date Worked For"]);
  const tlList = rows("TL List", ["Agent Name", "Team Lead Name"]);
  const teamBreakup = rows("Team Breakup + KPI Points", ["Team Name", "Team Members"]);

  if (!interactions.length) {
    return { interactions: sheetToRows(workbook), sheetSources: {}, mode: "generic" };
  }

  const teamProfiles = buildTeamProfiles(teamBreakup);
  const agentMaster = buildAgentMaster(tlList, teamProfiles);
  const kpiRules = buildKpiRules(teamBreakup);

  return {
    interactions,
    sheetSources: {
      agentMaster,
      kpiRules,
      reviewKpi: mapReviewRows(additionalTasks),
      qcKpi: mapQcRows(additionalTasks),
      adHocHours: mapAdHocRows(additionalTasks),
      disputeKpi: mapDisputeRows(additionalTasks),
      disputeTeam: [...teamProfiles.values()].filter((item) => item.team === "Dispute Team").map((item) => ({ "agent name": item.agent })),
      tlReviewEligible: [...teamProfiles.values()].filter((item) => item.tlReviewEligible).map((item) => ({ "agent name": item.agent }))
    },
    mode: "daily-kpi-workbook"
  };
}

function buildTeamProfiles(rows) {
  const profiles = new Map();
  let currentTeam = "";
  rows.forEach((row) => {
    const team = row["team name"];
    const agent = row["team members"];
    const kpiCard = String(row["kpi card"] || "").toLowerCase();
    if (team) currentTeam = team;
    if (!agent || agent === "Team Members") return;
    profiles.set(normalizeName(agent), {
      agent,
      team: currentTeam || "Unassigned",
      tlReviewEligible: kpiCard.includes("tl review")
    });
  });
  return profiles;
}

function buildAgentMaster(tlList, teamProfiles) {
  const master = new Map();

  teamProfiles.forEach((profile, key) => {
    master.set(key, {
      "agent name": profile.agent,
      "tl name": "Unassigned",
      team: profile.team,
      status: "Active"
    });
  });

  tlList.forEach((row) => {
    const agent = row["agent name"];
    if (!agent || agent === "Agent Name") return;
    const key = normalizeName(agent);
    const existing = master.get(key) || {};
    master.set(key, {
      "agent name": agent,
      "tl name": row["team lead name"] || existing["tl name"] || "Unassigned",
      team: existing.team || "Normal Agents",
      status: "Active"
    });
  });

  return [...master.values()];
}

function buildKpiRules(rows) {
  const rules = {
    interactionPoints: {},
    reviewPoints: {},
    qcPoints: {},
    adHocPointMultiplier: 9
  };

  rows.forEach((row) => {
    const kpiCard = String(row["kpi card"] || "").toLowerCase();
    if (!kpiCard) return;

    const firstPoint = firstNumberBeforePoint(kpiCard);
    if (kpiCard.includes("1* review")) rules.reviewPoints["1 star reviews"] = firstPoint || 3;
    if (kpiCard.includes("2* review")) rules.reviewPoints["2 star reviews"] = firstPoint || 3;
    if (kpiCard.includes("3* review")) rules.reviewPoints["3 star reviews"] = firstPoint || 3;
    if (kpiCard.includes("bbb review")) rules.reviewPoints["bbb reviews"] = firstPoint || 3;
    if (kpiCard.includes("4&5")) {
      const match = kpiCard.match(/(\d+(?:\.\d+)?)\s*point[s]?\s*for\s*4&5/);
      rules.reviewPoints["4 star reviews"] = match ? Number(match[1]) : 1;
      rules.reviewPoints["5 star reviews"] = match ? Number(match[1]) : 1;
    }
    if (kpiCard.includes("disputes handled")) rules.interactionPoints["countered dispute"] = firstPoint || 5;
    if (kpiCard.includes("call audited") || kpiCard.includes("email audited")) {
      rules.qcPoints["audited calls"] = firstPoint || 2;
      rules.qcPoints["audited emails"] = firstPoint || 2;
    }
    if (kpiCard.includes("tl review")) rules.interactionPoints["tl review"] = firstPoint || 2;
  });

  return rules;
}

function firstNumberBeforePoint(text) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*point/);
  return match ? Number(match[1]) : 0;
}

function readTableRows(sheet, requiredHeaders) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const headerIndex = findHeaderIndex(matrix, requiredHeaders);
  const [headers = [], ...dataRows] = matrix.slice(headerIndex);
  const records = dataRows.map((row) =>
    headers.reduce((record, header, index) => {
      if (header) record[header] = row[index] ?? "";
      return record;
    }, {})
  );
  return normalizeRows(records);
}

function findHeaderIndex(matrix, requiredHeaders) {
  if (!requiredHeaders.length) return 0;
  const normalizedRequired = requiredHeaders.map(normalizeName);
  const found = matrix.findIndex((row) => {
    const values = row.map(normalizeName);
    return normalizedRequired.every((header) => values.includes(header));
  });
  return found >= 0 ? found : 0;
}

function mapReviewRows(rows) {
  return rows.map((row) => ({
    "agent name": row["name of agent"],
    date: row["date worked for"],
    "1 star reviews": row["1* review"],
    "2 star reviews": row["2* review"],
    "3 star reviews": row["3* review"],
    "4 star reviews": row["4&5 * review"],
    "5 star reviews": 0,
    "bbb reviews": row["bbb review"]
  }));
}

function mapQcRows(rows) {
  return rows.map((row) => ({
    "agent name": row["name of agent"],
    date: row["date worked for"],
    "audited calls": row["call audits completed"],
    "audited emails": row["email audits completed"]
  }));
}

function mapAdHocRows(rows) {
  return rows.map((row) => ({
    "agent name": row["name of agent"],
    date: row["date worked for"],
    hours: row["ad hoc hours (*9)"]
  }));
}

function mapDisputeRows(rows) {
  return rows.map((row) => ({
    "agent name": row["name of agent"],
    date: row["date worked for"],
    disputes: row["disputes handled"]
  }));
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}
