/**
 * Outlier Detector
 * Detects statistical outliers using IQR and Z-Score methods
 */

/**
 * Detect outliers in numeric columns
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @param {Object} config - Validation config
 * @returns {Array} Outlier issues
 */
export function detectOutliers(rows, headers, columnTypes, config) {
  const issues = [];
  const { detectOutliers: method, zscoreThreshold, maxIssuesPerType } = config;
  const maxIssues = maxIssuesPerType || 100;

  // Find numeric columns
  const numericColumns = headers.filter((header) => {
    const colDef = columnTypes[header];
    return colDef && ["number", "integer"].includes(colDef.type);
  });

  numericColumns.forEach((column) => {
    // Extract numeric values with row indices
    const valuesWithIndex = rows
      .map((row, index) => ({ value: parseFloat(row[column]), index }))
      .filter(({ value }) => !isNaN(value) && isFinite(value));

    if (valuesWithIndex.length < 10) {
      return; // Not enough data for meaningful outlier detection
    }

    const values = valuesWithIndex.map((v) => v.value);

    let outlierIndices;
    if (method === "iqr") {
      outlierIndices = detectOutliersIQR(values);
    } else if (method === "zscore") {
      outlierIndices = detectOutliersZScore(values, zscoreThreshold);
    }

    // Create issues for outliers
    const columnIssues = [];
    outlierIndices.forEach((i) => {
      const { value, index } = valuesWithIndex[i];
      columnIssues.push({
        rowNumber: index + 1,
        column,
        value: String(value),
        issueType: "outlier",
        severity: "warning",
        message: `Value ${value} is a statistical outlier (${method.toUpperCase()} method)`,
        suggestion:
          "Verify this value is correct or consider capping/removing it",
      });
    });

    // Add limited issues
    issues.push(...columnIssues.slice(0, maxIssues));
  });

  return issues;
}

/**
 * Detect outliers using IQR (Interquartile Range) method
 * @param {Array<number>} values - Numeric values
 * @returns {Array<number>} Indices of outliers
 */
function detectOutliersIQR(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);

  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const outlierIndices = [];
  values.forEach((value, index) => {
    if (value < lowerBound || value > upperBound) {
      outlierIndices.push(index);
    }
  });

  return outlierIndices;
}

/**
 * Detect outliers using Z-Score method
 * @param {Array<number>} values - Numeric values
 * @param {number} threshold - Z-score threshold (default: 3)
 * @returns {Array<number>} Indices of outliers
 */
function detectOutliersZScore(values, threshold = 3) {
  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return []; // All values are the same
  }

  const outlierIndices = [];
  values.forEach((value, index) => {
    const zScore = Math.abs((value - mean) / stdDev);
    if (zScore > threshold) {
      outlierIndices.push(index);
    }
  });

  return outlierIndices;
}

export { detectOutliersIQR, detectOutliersZScore };
