/**
 * HTML Report Generator
 * Generates shareable HTML validation reports
 * With modular section builder functions
 */
import { Actor } from "apify";

/**
 * Build summary cards HTML section
 * @param {Object} summary - Summary data
 * @returns {string} HTML string
 */
function buildSummaryCards(summary) {
  return `
    <div class="grid">
      <div class="card">
        <div class="score-ring">
          <div class="inner">${summary.qualityScore}</div>
        </div>
        <h3 style="text-align:center">Quality Score</h3>
      </div>
      <div class="card success">
        <h3>Total Rows</h3>
        <div class="value">${summary.totalRows?.toLocaleString() || 0}</div>
      </div>
      <div class="card success">
        <h3>Valid Rows</h3>
        <div class="value">${summary.validRows?.toLocaleString() || 0}</div>
      </div>
      <div class="card ${summary.invalidRows > 0 ? "error" : "success"}">
        <h3>Invalid Rows</h3>
        <div class="value">${summary.invalidRows?.toLocaleString() || 0}</div>
      </div>
    </div>`;
}

/**
 * Build metrics section HTML
 * @param {Object} dataQuality - Data quality metrics
 * @returns {string} HTML string
 */
function buildMetricsSection(dataQuality) {
  return `
    <div class="card" style="margin-bottom: 2rem;">
      <h2 style="margin-bottom: 1rem;">📊 Data Quality Metrics</h2>
      <div class="metrics-bar">
        <div class="metric">
          <label>Completeness</label>
          <span>${dataQuality?.completeness || 0}%</span>
        </div>
        <div class="metric">
          <label>Validity</label>
          <span>${dataQuality?.validity || 0}%</span>
        </div>
        <div class="metric">
          <label>Uniqueness</label>
          <span>${dataQuality?.uniqueness || 0}%</span>
        </div>
        <div class="metric">
          <label>Consistency</label>
          <span>${dataQuality?.consistency || 0}%</span>
        </div>
      </div>
    </div>`;
}

/**
 * Build column analysis table HTML
 * @param {Array} columnAnalysis - Column analysis data
 * @returns {string} HTML string
 */
function buildColumnAnalysisTable(columnAnalysis) {
  if (!columnAnalysis || columnAnalysis.length === 0) return "";

  const rows = columnAnalysis
    .map(
      (col) => `
      <tr>
        <td><strong>${col.column}</strong></td>
        <td>${col.type}</td>
        <td>${col.stats?.nullPercent || 0}%</td>
        <td>${col.stats?.uniqueCount || 0}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="card" style="margin-bottom: 2rem;">
      <h2 style="margin-bottom: 1rem;">📋 Column Analysis</h2>
      <table>
        <thead>
          <tr>
            <th>Column</th>
            <th>Type</th>
            <th>Null %</th>
            <th>Unique</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/**
 * Build issues table HTML
 * @param {Array} issues - Issues array
 * @returns {string} HTML string
 */
function buildIssuesTable(issues) {
  if (!issues || issues.length === 0) return "";

  const rows = issues
    .slice(0, 50)
    .map(
      (issue) => `
      <tr>
        <td>${issue.rowNumber}</td>
        <td>${issue.column}</td>
        <td>${issue.message || issue.issueType}</td>
        <td><span class="badge badge-${
          issue.severity === "error"
            ? "error"
            : issue.severity === "warning"
            ? "warning"
            : "info"
        }">${issue.severity}</span></td>
      </tr>`
    )
    .join("");

  const truncationNote =
    issues.length > 50
      ? `<p style="margin-top: 1rem; color: var(--muted);">Showing first 50 of ${issues.length} issues</p>`
      : "";

  return `
    <div class="card" style="margin-bottom: 2rem;">
      <h2 style="margin-bottom: 1rem;">⚠️ Issues Found (${issues.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Row</th>
            <th>Column</th>
            <th>Issue</th>
            <th>Severity</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${truncationNote}
    </div>`;
}

/**
 * Build recommendations section HTML
 * @param {Array} recommendations - Recommendations array
 * @returns {string} HTML string
 */
function buildRecommendationsSection(recommendations) {
  if (!recommendations || recommendations.length === 0) return "";

  const items = (Array.isArray(recommendations) ? recommendations : [])
    .slice(0, 10)
    .map(
      (rec) => `
      <li style="padding: 0.75rem; background: #f0f9ff; border-radius: 8px; margin-bottom: 0.5rem;">
        ${typeof rec === "string" ? rec : rec.description || rec.title}
      </li>`
    )
    .join("");

  return `
    <div class="card">
      <h2 style="margin-bottom: 1rem;">💡 Recommendations</h2>
      <ul style="list-style: none;">${items}</ul>
    </div>`;
}

/**
 * Build CSS styles for the report
 * @param {number} qualityScore - Quality score for the ring gradient
 * @returns {string} CSS string
 */
function buildStyles(qualityScore) {
  return `
    :root {
      --primary: #2563eb;
      --success: #16a34a;
      --warning: #d97706;
      --error: #dc2626;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #1e293b;
      --muted: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      background: linear-gradient(135deg, var(--primary), #1d4ed8);
      color: white;
      padding: 2rem;
      border-radius: 12px;
      margin-bottom: 2rem;
    }
    header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    header p { opacity: 0.9; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .card {
      background: var(--card);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .card h3 { color: var(--muted); font-size: 0.875rem; text-transform: uppercase; margin-bottom: 0.5rem; }
    .card .value { font-size: 2rem; font-weight: bold; }
    .card.success .value { color: var(--success); }
    .card.warning .value { color: var(--warning); }
    .card.error .value { color: var(--error); }
    .score-ring {
      width: 120px; height: 120px;
      border-radius: 50%;
      background: conic-gradient(var(--primary) ${qualityScore}%, #e2e8f0 0);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1rem;
    }
    .score-ring .inner {
      width: 100px; height: 100px;
      border-radius: 50%;
      background: var(--card);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; font-weight: bold;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:hover { background: #f8fafc; }
    .badge {
      display: inline-block; padding: 0.25rem 0.75rem;
      border-radius: 9999px; font-size: 0.75rem; font-weight: 500;
    }
    .badge-error { background: #fee2e2; color: var(--error); }
    .badge-warning { background: #fef3c7; color: var(--warning); }
    .badge-info { background: #dbeafe; color: var(--primary); }
    .metrics-bar { display: flex; gap: 0.5rem; margin-top: 1rem; }
    .metric {
      flex: 1; text-align: center; padding: 1rem;
      background: #f1f5f9; border-radius: 8px;
    }
    .metric label { display: block; font-size: 0.75rem; color: var(--muted); }
    .metric span { font-size: 1.25rem; font-weight: bold; }
    footer {
      margin-top: 2rem; padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
      text-align: center; color: var(--muted); font-size: 0.875rem;
    }`;
}

/**
 * Generate HTML validation report
 * @param {Object} qualityReport - Complete quality report object
 * @param {Object} config - Configuration
 * @returns {Promise<string>} Key name where report is saved
 */
export async function generateHTMLReport(qualityReport, config) {
  const {
    summary,
    dataQuality,
    columnAnalysis,
    issues,
    recommendations,
    metadata,
  } = qualityReport;

  const timestamp = metadata?.validatedAt || new Date().toISOString();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Quality Report - ${timestamp}</title>
  <style>${buildStyles(summary.qualityScore)}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🛡️ DataGuard Quality Report</h1>
      <p>Generated: ${timestamp}</p>
    </header>

    ${buildSummaryCards(summary)}
    ${buildMetricsSection(dataQuality)}
    ${buildColumnAnalysisTable(columnAnalysis)}
    ${buildIssuesTable(issues)}
    ${buildRecommendationsSection(recommendations)}

    <footer>
      <p>Generated by DataGuard • Apify Actor</p>
      <p>Processing time: ${summary.processingTimeMs}ms</p>
    </footer>
  </div>
</body>
</html>`.trim();

  await Actor.setValue("QUALITY_REPORT_HTML", html, {
    contentType: "text/html",
  });

  return "QUALITY_REPORT_HTML";
}
