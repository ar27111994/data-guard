/**
 * Google Sheets Integration
 * Parse and validate Google Sheets data
 */

/**
 * Parse Google Sheets URL to extract spreadsheet ID and sheet info
 * @param {string} url - Google Sheets URL
 * @returns {Object} Parsed sheet info
 */
export function parseGoogleSheetsUrl(url) {
  // Format: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=SHEET_ID
  // Or: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/export?format=csv
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /key=([a-zA-Z0-9-_]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        spreadsheetId: match[1],
        isGoogleSheets: true,
      };
    }
  }

  return { isGoogleSheets: false };
}

/**
 * Convert Google Sheets URL to export URL
 * @param {string} url - Google Sheets URL
 * @param {string} format - Export format (csv, xlsx)
 * @param {string|number} sheetId - Optional sheet ID or name
 * @returns {string} Export URL
 */
export function getGoogleSheetsExportUrl(url, format = "csv", sheetId = null) {
  const parsed = parseGoogleSheetsUrl(url);

  if (!parsed.isGoogleSheets) {
    return url; // Return original URL if not Google Sheets
  }

  let exportUrl = `https://docs.google.com/spreadsheets/d/${parsed.spreadsheetId}/export?format=${format}`;

  if (sheetId !== null) {
    exportUrl += `&gid=${sheetId}`;
  }

  return exportUrl;
}

/**
 * Check if URL is a Google Sheets URL
 * @param {string} url - URL to check
 * @returns {boolean}
 */
export function isGoogleSheetsUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }
  return (
    url.includes("docs.google.com/spreadsheets") ||
    url.includes("sheets.googleapis.com")
  );
}

/**
 * Fetch Google Sheets data as CSV
 * Note: Sheet must be publicly accessible or use API key
 * @param {string} url - Google Sheets URL
 * @param {Object} options - Options (sheetId, apiKey)
 * @returns {Promise<string>} CSV data
 */
export async function fetchGoogleSheetsData(url, options = {}) {
  const { sheetId = null, apiKey = null } = options;

  // Convert to export URL
  let fetchUrl = getGoogleSheetsExportUrl(url, "csv", sheetId);

  // Add API key if provided
  if (apiKey) {
    fetchUrl += `&key=${apiKey}`;
  }

  console.log(`   Fetching Google Sheets: ${fetchUrl.substring(0, 80)}...`);

  const response = await fetch(fetchUrl, {
    headers: {
      Accept: "text/csv",
    },
  });

  if (!response.ok) {
    // Check for common errors
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Google Sheets access denied. Ensure the sheet is publicly accessible or provide an API key."
      );
    }
    throw new Error(
      `Failed to fetch Google Sheets: ${response.status} ${response.statusText}`
    );
  }

  return response.text();
}

/**
 * Data source integration config
 */
export const DATA_SOURCE_INTEGRATIONS = {
  googleSheets: {
    name: "Google Sheets",
    urlPattern: /docs\.google\.com\/spreadsheets/,
    handler: fetchGoogleSheetsData,
    description: "Validate data directly from Google Sheets",
  },
  // Future integrations can be added here
  salesforce: {
    name: "Salesforce",
    urlPattern: null, // Requires OAuth
    handler: null,
    description: "Validate Salesforce data exports (requires API credentials)",
  },
  hubspot: {
    name: "HubSpot",
    urlPattern: null, // Requires OAuth
    handler: null,
    description: "Validate HubSpot data exports (requires API credentials)",
  },
};

/**
 * Detect data source type from URL
 */
export function detectDataSource(url) {
  for (const [key, integration] of Object.entries(DATA_SOURCE_INTEGRATIONS)) {
    if (integration.urlPattern && integration.urlPattern.test(url)) {
      return { type: key, integration };
    }
  }
  return { type: "generic", integration: null };
}
