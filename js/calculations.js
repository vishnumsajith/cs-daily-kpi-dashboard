import { CONFIG } from "./config.js";

export function normalizeRows(rows = []) {
  return rows.map((row) =>
    Object.entries(row).reduce((acc, [key, value]) => {
      acc[normalizeKey(key)] = cleanValue(value);
      return acc;
    }, {})
  );
}

export function buildKpiModel(interactions = [], sheetSources = {}) {
  const rules = mergeBusinessRules(sheetSources.kpiRules);
  const master = buildMaster(sheetSources.agentMaster || []);
  const disputeAgents = new Set((sheetSources.disputeTeam || []).map((row) => getValue(row, ["agent name", "agent", "name"])).filter(Boolean).map(normalizeName));
  const tlEligibleAgents = new Set((sheetSources.tlReviewEligible || []).map((row) => getValue(row, ["agent name", "agent", "name"])).filter(Boolean).map(normalizeName));
  const agentMap = new Map();

  const ensureAgent = (agentName) => {
    const normalized = normalizeName(agentName);
    if (!normalized) return null;
    if (!agentMap.has(normalized)) {
      const profile = master.get(normalized) || {};
      agentMap.set(normalized, emptyAgent(agentName, profile));
    }
    return agentMap.get(normalized);
  };

  interactions.forEach((row) => {
    const agentName = getValue(row, CONFIG.columnAliases.agent);
    const interactionType = normalizeInteraction(getValue(row, CONFIG.columnAliases.interactionType));
    const date = parseDate(getValue(row, CONFIG.columnAliases.createdDate));
    const agent = ensureAgent(agentName);
    if (!agent || !interactionType) return;
    hydrateAgentFromInteraction(agent, row);

    if (interactionType === "call") addInteractionMetric(agent, "calls", 1, rules.interactionPoints.call, date);
    if (interactionType === "email") addInteractionMetric(agent, "emails", 1, rules.interactionPoints.email, date);
    if (interactionType === "chat") addInteractionMetric(agent, "chats", 1, rules.interactionPoints.chat, date);
    if (interactionType === "tl review" && tlEligibleAgents.has(normalizeName(agentName))) {
      addInteractionMetric(agent, "tlReviews", 1, rules.interactionPoints["tl review"], date, "tlReviewPoints");
    }
  });

  applyReviewKpi(sheetSources.reviewKpi || [], ensureAgent, rules);
  applyQcKpi(sheetSources.qcKpi || [], ensureAgent, rules);
  applyAdHocHours(sheetSources.adHocHours || [], ensureAgent, rules);
  applyDisputeKpi(sheetSources.disputeKpi || [], ensureAgent, disputeAgents, rules);

  master.forEach((profile, key) => {
    if (!agentMap.has(key) && profile.status !== "inactive") {
      agentMap.set(key, emptyAgent(profile.agent, profile));
    }
  });

  const agents = [...agentMap.values()].sort((a, b) => b.totalPoints - a.totalPoints);
  const summary = summarize(agents);
  return { agents, summary, interactions };
}

export function applyFilters(model, filters) {
  const agents = model.agents.filter((agent) => {
    if (filters.agent && agent.agent !== filters.agent) return false;
    if (filters.tl && agent.tl !== filters.tl) return false;
    if (filters.team && agent.team !== filters.team) return false;
    return true;
  }).map((agent) => filterAgentByDateAndType(agent, filters));

  return { ...model, agents, summary: summarize(agents) };
}

function filterAgentByDateAndType(agent, filters) {
  if (!filters.date && !filters.month && !filters.type) return agent;

  const filteredDaily = agent.daily.filter((item) => {
    if (filters.date && item.date !== filters.date) return false;
    if (filters.month && !item.date.startsWith(filters.month)) return false;
    if (filters.type && item.type !== filters.type) return false;
    return true;
  });

  const clone = emptyAgent(agent.agent, agent);
  clone.daily = filteredDaily;

  filteredDaily.forEach((item) => {
    if (item.type === "call") clone.calls += item.count;
    if (item.type === "email") clone.emails += item.count;
    if (item.type === "chat") clone.chats += item.count;
    if (item.type === "tl review") clone.tlReviews += item.count;
    if (item.type === "countered dispute") clone.disputes += item.count;
    if (item.type === "review") {
      clone.reviews += item.count;
      clone.reviewPoints += item.points;
    }
    if (item.type === "qc audit") {
      clone.qcAudits += item.count;
      clone.qcPoints += item.points;
      clone.auditedCalls += item.auditedCalls || 0;
      clone.auditedEmails += item.auditedEmails || 0;
    }
    if (item.type === "ad hoc") clone.adHocHours += item.count;
    clone.interactions += item.count;
    clone.totalPoints += item.points;
    clone.tlReviewPoints += item.type === "tl review" ? item.points : 0;
    clone.disputePoints += item.type === "countered dispute" ? item.points : 0;
  });

  return clone;
}

function buildMaster(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const agent = getValue(row, ["agent name", "agent", "name"]);
    if (!agent) return;
    map.set(normalizeName(agent), {
      agent,
      tl: getValue(row, ["tl name", "team leader", "tl"]) || "Unassigned",
      team: getValue(row, ["team"]) || "Normal Agents",
      status: normalizeName(getValue(row, ["status"]) || "active")
    });
  });
  return map;
}

function mergeBusinessRules(uploadedRules = {}) {
  return {
    interactionPoints: {
      ...CONFIG.businessRules.interactionPoints,
      ...(uploadedRules.interactionPoints || {})
    },
    reviewPoints: {
      ...CONFIG.businessRules.reviewPoints,
      ...(uploadedRules.reviewPoints || {})
    },
    qcPoints: {
      ...CONFIG.businessRules.qcPoints,
      ...(uploadedRules.qcPoints || {})
    },
    adHocPointMultiplier: uploadedRules.adHocPointMultiplier || CONFIG.businessRules.adHocPointMultiplier
  };
}

function hydrateAgentFromInteraction(agent, row) {
  if (agent.tl === "Unassigned") {
    agent.tl = getValue(row, ["tl name", "team lead name", "team leader"]) || agent.tl;
  }
  if (agent.team === "Unassigned") {
    agent.team = "Normal Agents";
  }
}

function applyReviewKpi(rows, ensureAgent, rules) {
  rows.forEach((row) => {
    const agent = ensureAgent(getValue(row, ["agent name", "agent", "name"]));
    if (!agent) return;
    const date = parseDate(getValue(row, ["date", "date worked for"]));
    let rowCount = 0;
    let rowPoints = 0;
    Object.entries(rules.reviewPoints).forEach(([column, points]) => {
      const count = toNumber(getValue(row, [column]));
      agent.reviews += count;
      agent.reviewPoints += count * points;
      agent.totalPoints += count * points;
      rowCount += count;
      rowPoints += count * points;
    });
    addSupplementalDaily(agent, date, "review", rowCount, rowPoints);
  });
}

function applyQcKpi(rows, ensureAgent, rules) {
  rows.forEach((row) => {
    const agent = ensureAgent(getValue(row, ["agent name", "agent", "name"]));
    if (!agent) return;
    const date = parseDate(getValue(row, ["date", "date worked for"]));
    let rowCount = 0;
    let rowPoints = 0;
    Object.entries(rules.qcPoints).forEach(([column, points]) => {
      const count = toNumber(getValue(row, [column]));
      if (column === "audited calls") agent.auditedCalls += count;
      if (column === "audited emails") agent.auditedEmails += count;
      agent.qcAudits += count;
      agent.qcPoints += count * points;
      agent.totalPoints += count * points;
      rowCount += count;
      rowPoints += count * points;
    });
    addSupplementalDaily(agent, date, "qc audit", rowCount, rowPoints, {
      auditedCalls: toNumber(getValue(row, ["audited calls"])),
      auditedEmails: toNumber(getValue(row, ["audited emails"]))
    });
  });
}

function applyAdHocHours(rows, ensureAgent, rules) {
  rows.forEach((row) => {
    const agent = ensureAgent(getValue(row, ["agent name", "agent", "name"]));
    if (!agent) return;
    const date = parseDate(getValue(row, ["date", "date worked for"]));
    const hours = toNumber(getValue(row, ["hours", "ad hoc hours"]));
    const points = hours * rules.adHocPointMultiplier;
    agent.adHocHours += hours;
    agent.totalPoints += points;
    addSupplementalDaily(agent, date, "ad hoc", hours, points);
  });
}

function applyDisputeKpi(rows, ensureAgent, disputeAgents, rules) {
  rows.forEach((row) => {
    const agentName = getValue(row, ["agent name", "agent", "name"]);
    if (!disputeAgents.has(normalizeName(agentName))) return;
    const agent = ensureAgent(agentName);
    if (!agent) return;
    const disputes = toNumber(getValue(row, ["disputes", "disputes handled"]));
    const points = disputes * rules.interactionPoints["countered dispute"];
    const date = parseDate(getValue(row, ["date", "date worked for"]));
    agent.disputes += disputes;
    agent.disputePoints += points;
    agent.totalPoints += points;
    addSupplementalDaily(agent, date, "countered dispute", disputes, points);
  });
}

function addMetric(agent, field, count, points, date, pointsField) {
  agent[field] += count;
  agent.totalPoints += count * points;
  if (pointsField) agent[pointsField] += count * points;
  if (date) {
    const dailyItem = agent.daily.find((item) => item.date === date && item.type === normalizeMetricType(field));
    if (dailyItem) dailyItem.points += count * points;
  }
}

function addInteractionMetric(agent, field, count, points, date, pointsField) {
  const type = normalizeMetricType(field);
  agent.interactions += count;
  addDaily(agent, date, type);
  addMetric(agent, field, count, points, date, pointsField);
}

function addDaily(agent, date, type) {
  if (!date) return;
  const existing = agent.daily.find((item) => item.date === date && item.type === type);
  if (existing) existing.count += 1;
  else agent.daily.push({ date, type, count: 1, points: 0 });
}

function addSupplementalDaily(agent, date, type, count, points, extras = {}) {
  if (!date || !count) return;
  const existing = agent.daily.find((item) => item.date === date && item.type === type);
  if (existing) {
    existing.count += count;
    existing.points += points;
    Object.entries(extras).forEach(([key, value]) => {
      existing[key] = (existing[key] || 0) + value;
    });
  } else {
    agent.daily.push({ date, type, count, points, ...extras });
  }
}

function summarize(agents) {
  return agents.reduce(
    (acc, agent) => {
      acc.totalAgents += 1;
      acc.totalInteractions += countKpiTransactions(agent);
      acc.totalPoints += agent.totalPoints;
      acc.chats += agent.chats;
      acc.calls += agent.calls;
      acc.emails += agent.emails;
      acc.reviews += agent.reviews;
      acc.disputes += agent.disputes;
      acc.qcAudits += agent.qcAudits;
      acc.adHocHours += agent.adHocHours;
      return acc;
    },
    { totalAgents: 0, totalInteractions: 0, totalPoints: 0, chats: 0, calls: 0, emails: 0, reviews: 0, disputes: 0, qcAudits: 0, adHocHours: 0 }
  );
}

function countKpiTransactions(agent) {
  return agent.calls + agent.chats + agent.emails + agent.tlReviews + agent.reviews + agent.disputes + agent.qcAudits;
}

function emptyAgent(agent, profile = {}) {
  return {
    agent,
    team: profile.team || "Normal Agents",
    tl: profile.tl || "Unassigned",
    status: profile.status || "active",
    calls: 0,
    chats: 0,
    emails: 0,
    tlReviews: 0,
    tlReviewPoints: 0,
    reviews: 0,
    reviewPoints: 0,
    disputes: 0,
    disputePoints: 0,
    auditedCalls: 0,
    auditedEmails: 0,
    qcAudits: 0,
    qcPoints: 0,
    adHocHours: 0,
    interactions: 0,
    totalPoints: 0,
    daily: []
  };
}

function normalizeMetricType(field) {
  return { calls: "call", emails: "email", chats: "chat", tlReviews: "tl review", disputes: "countered dispute" }[field] || field;
}

export function getValue(row, keys) {
  const normalized = Array.isArray(keys) ? keys.map(normalizeKey) : [normalizeKey(keys)];
  const found = normalized.find((key) => Object.prototype.hasOwnProperty.call(row, key));
  return found ? row[found] : "";
}

export function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeName(value) {
  return normalizeKey(value);
}

function normalizeInteraction(value) {
  const clean = normalizeKey(value);
  if (clean.includes("tl") && clean.includes("review")) return "tl review";
  if (clean.includes("escalation handled by escalation team")) return "tl review";
  if (clean.includes("call")) return "call";
  if (clean.includes("email")) return "email";
  if (clean.includes("chat")) return "chat";
  return clean;
}

function parseDate(value) {
  if (!value) return "";
  if (typeof value === "number") return excelSerialToDate(value);
  if (/^\d{5}$/.test(String(value).trim())) return excelSerialToDate(Number(value));
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const date = new Date(utcValue * 1000);
  return date.toISOString().slice(0, 10);
}

function cleanValue(value) {
  return typeof value === "string" ? value.trim() : value;
}

function toNumber(value) {
  const number = Number(String(value || "0").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}
