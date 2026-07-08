import { CONFIG } from "./config.js";
import { normalizeRows } from "./calculations.js";

export async function loadGoogleSheetSources() {
  const entries = Object.entries(CONFIG.googleSheets.sources);
  const results = await Promise.allSettled(entries.map(([key, source]) => loadSource(key, source)));

  return results.reduce((acc, result, index) => {
    const key = entries[index][0];
    acc[key] = result.status === "fulfilled" ? result.value : [];
    return acc;
  }, {});
}

async function loadSource(key, source) {
  if (source.csvUrl) {
    const response = await fetch(source.csvUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load ${key}`);
    const csv = await response.text();
    return normalizeRows(csvToRows(csv));
  }

  if (CONFIG.googleSheets.apiKey && source.sheetId && source.range) {
    const range = encodeURIComponent(source.range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${source.sheetId}/values/${range}?key=${CONFIG.googleSheets.apiKey}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load ${key}`);
    const payload = await response.json();
    return normalizeRows(valuesToRows(payload.values || []));
  }

  return [];
}

function valuesToRows(values) {
  const [headers = [], ...rows] = values;
  return rows.map((row) =>
    headers.reduce((record, header, index) => {
      record[header] = row[index] ?? "";
      return record;
    }, {})
  );
}

function csvToRows(csv) {
  const workbook = XLSX.read(csv, { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
}
