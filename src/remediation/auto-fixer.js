/**
 * Auto-Fixer / Remediation
 * Automatically fixes common data quality issues
 */
import { Actor } from "apify";
import Papa from "papaparse";

/**
 * Generate cleaned data with fixes applied
 * @param {Array} rows - Original data rows
 * @param {Array} headers - Column headers
 * @param {Object} validationResult - Validation results
 * @param {Object} config - Configuration
 * @returns {Promise<string>} URL to cleaned data
 */
export async function generateCleanedData(
  rows,
  headers,
  validationResult,
  config
) {
  const { cleaningActions = [] } = config;
  let cleanedRows = [...rows];

  // Apply cleaning actions
  cleaningActions.forEach((action) => {
    switch (action) {
      case "trim":
        cleanedRows = applyTrim(cleanedRows, headers);
        break;
      case "lowercase":
        cleanedRows = applyCase(cleanedRows, headers, "lower");
        break;
      case "uppercase":
        cleanedRows = applyCase(cleanedRows, headers, "upper");
        break;
      case "removeEmpty":
        cleanedRows = removeEmptyRows(cleanedRows, headers);
        break;
      case "removeDuplicates":
        cleanedRows = removeDuplicateRows(cleanedRows, headers);
        break;
    }
  });

  // Convert to CSV
  const csv = Papa.unparse(cleanedRows, {
    columns: headers,
  });

  // Save to key-value store
  await Actor.setValue("CLEANED_DATA", csv, { contentType: "text/csv" });

  console.log(`   Cleaned ${rows.length} → ${cleanedRows.length} rows`);

  return "CLEANED_DATA";
}

/**
 * Trim whitespace from all values
 */
function applyTrim(rows, headers) {
  return rows.map((row) => {
    const newRow = { ...row };
    headers.forEach((h) => {
      if (typeof newRow[h] === "string") {
        newRow[h] = newRow[h].trim();
      }
    });
    return newRow;
  });
}

/**
 * Apply case transformation
 */
function applyCase(rows, headers, caseType) {
  return rows.map((row) => {
    const newRow = { ...row };
    headers.forEach((h) => {
      if (typeof newRow[h] === "string") {
        newRow[h] =
          caseType === "lower"
            ? newRow[h].toLowerCase()
            : newRow[h].toUpperCase();
      }
    });
    return newRow;
  });
}

/**
 * Remove empty rows
 */
function removeEmptyRows(rows, headers) {
  return rows.filter((row) => {
    return headers.some((h) => {
      const val = row[h];
      return val !== null && val !== undefined && val !== "";
    });
  });
}

/**
 * Remove duplicate rows
 */
function removeDuplicateRows(rows, headers) {
  const seen = new Set();
  return rows.filter((row) => {
    const signature = headers.map((h) => String(row[h] ?? "")).join("|");
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
}

/**
 * Impute missing values
 * @param {Array} rows - Data rows
 * @param {string} column - Column to impute
 * @param {string} strategy - Imputation strategy (mean, median, mode, constant)
 * @param {*} constantValue - Value to use for constant strategy
 */
export function imputeMissingValues(
  rows,
  column,
  strategy,
  constantValue = null
) {
  const nonNullValues = rows
    .map((r) => r[column])
    .filter((v) => v !== null && v !== undefined && v !== "");

  let imputeValue;

  switch (strategy) {
    case "mean":
      const numVals = nonNullValues.map(Number).filter((v) => !isNaN(v));
      imputeValue = numVals.reduce((a, b) => a + b, 0) / numVals.length;
      break;
    case "median":
      const sorted = nonNullValues
        .map(Number)
        .filter((v) => !isNaN(v))
        .sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      imputeValue =
        sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      break;
    case "mode":
      const counts = {};
      nonNullValues.forEach((v) => {
        counts[v] = (counts[v] || 0) + 1;
      });
      imputeValue = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      break;
    case "constant":
      imputeValue = constantValue;
      break;
  }

  return rows.map((row) => {
    if (
      row[column] === null ||
      row[column] === undefined ||
      row[column] === ""
    ) {
      return { ...row, [column]: imputeValue };
    }
    return row;
  });
}
