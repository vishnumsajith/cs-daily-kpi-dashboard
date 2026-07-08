# CS Daily KPI Dashboard

A complete static web application for daily customer support KPI publishing. It runs fully in the browser and can be hosted on GitHub Pages.

## What it does

- Uploads the daily Interaction Report as `.xlsx`, `.xls`, or `.csv`
- Loads supplemental KPI data from Google Sheets
- Applies isolated business-rule calculations
- Filters by Agent, TL, Team, Date, Month, and Interaction Type
- Displays KPI cards, contribution charts, trends, stacked team output, and an agent table
- Opens an agent detail drawer with daily breakdowns
- Exports filtered results to CSV, Excel, and PDF
- Supports responsive layout, sticky header, dark mode, loading states, empty states, and error states

## File Structure

```text
index.html
css/styles.css
js/app.js
js/upload.js
js/googleSheets.js
js/calculations.js
js/charts.js
js/filters.js
js/ui.js
js/export.js
js/config.js
README.md
```

## Google Sheets Setup

Open `js/config.js` and configure each source.

Recommended for GitHub Pages:

1. Publish the needed Google Sheet tab to CSV.
2. Paste the published CSV URL into the matching `csvUrl`.
3. Leave `apiKey`, `sheetId`, and `range` blank.

API option:

1. Create a Google Cloud API key with Google Sheets API access.
2. Paste the key into `googleSheets.apiKey`.
3. Add each `sheetId` and `range`.

## Required Source Columns

Daily Interaction Report:

- `Interaction Created By`
- `Interaction Type`
- `Created Date`

Agent Master:

- `Agent Name`
- `TL Name`
- `Team`
- `Status`

Review KPI:

- `Agent Name`
- `1 Star Reviews`
- `2 Star Reviews`
- `3 Star Reviews`
- `4 Star Reviews`
- `5 Star Reviews`
- `BBB Reviews`

QC KPI:

- `Agent Name`
- `Audited Calls`
- `Audited Emails`

Ad Hoc Hours:

- `Agent Name`
- `Date`
- `Hours`

Dispute Team List:

- `Agent Name`

TL Review Eligible:

- `Agent Name`

## Deployment

Push the folder contents to a GitHub repository and enable GitHub Pages for the branch/folder that contains `index.html`.

No build step and no backend server are required.
