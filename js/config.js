export const CONFIG = {
  appName: "CS Daily KPI Dashboard",
  googleSheets: {
    // Option A: publish each Google Sheet tab to CSV and paste the CSV URL.
    // Option B: use a Google Sheets API key and sheetId/range below.
    apiKey: "",
    sources: {
      agentMaster: { csvUrl: "", sheetId: "", range: "Agent Master!A:D" },
      reviewKpi: { csvUrl: "", sheetId: "", range: "Review KPI!A:G" },
      qcKpi: { csvUrl: "", sheetId: "", range: "QC KPI!A:C" },
      adHocHours: { csvUrl: "", sheetId: "", range: "Ad Hoc Hours!A:C" },
      disputeTeam: { csvUrl: "", sheetId: "", range: "Dispute Team List!A:A" },
      tlReviewEligible: { csvUrl: "", sheetId: "", range: "TL Review Eligible!A:A" }
    }
  },
  businessRules: {
    interactionPoints: {
      call: 1,
      email: 1,
      chat: 1.5,
      "tl review": 2,
      "countered dispute": 5
    },
    reviewPoints: {
      "1 star reviews": 3,
      "2 star reviews": 3,
      "3 star reviews": 3,
      "4 star reviews": 1,
      "5 star reviews": 1,
      "bbb reviews": 3
    },
    qcPoints: {
      "audited calls": 2,
      "audited emails": 2
    },
    adHocPointMultiplier: 9
  },
  columnAliases: {
    agent: ["interaction created by", "created by", "agent", "agent name", "name"],
    interactionType: ["interaction type (call, email/chat)", "interaction type", "type", "category"],
    createdDate: ["date worked for", "created date", "date", "interaction created date", "created at"]
  }
};
