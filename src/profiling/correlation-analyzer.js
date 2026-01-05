/**
 * Correlation Analyzer
 * Analyzes correlations between numeric columns
 * With modular helper functions for extraction, matrix building, and classification
 */

/** Minimum number of paired values required for correlation calculation */
const MIN_PAIRS_FOR_CORRELATION = 10;

/**
 * Calculate Pearson correlation coefficient between two arrays
 * @param {Array<number>} x - First array
 * @param {Array<number>} y - Second array
 * @returns {number|null} Correlation coefficient (-1 to 1)
 */
function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n < 3) return null;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denominator = Math.sqrt(sumX2 * sumY2);
  if (denominator === 0) return 0;

  return sumXY / denominator;
}

/**
 * Extract numeric column names from headers based on column types
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @returns {Array} Array of numeric column names
 */
function extractNumericColumns(headers, columnTypes) {
  return headers.filter((header) => {
    const colDef = columnTypes[header];
    return colDef && ["number", "integer"].includes(colDef.type);
  });
}

/**
 * Get paired values from two columns (excluding rows with NaN)
 * @param {Array} rows - Data rows
 * @param {string} col1 - First column name
 * @param {string} col2 - Second column name
 * @returns {Array<[number, number]>} Array of paired values
 */
function getPairedValues(rows, col1, col2) {
  const pairs = [];
  for (let k = 0; k < rows.length; k++) {
    const v1 = parseFloat(rows[k][col1]);
    const v2 = parseFloat(rows[k][col2]);
    if (!isNaN(v1) && !isNaN(v2)) {
      pairs.push([v1, v2]);
    }
  }
  return pairs;
}

/**
 * Build correlation matrix between numeric columns
 * @param {Array} rows - Data rows
 * @param {Array} numericColumns - Numeric column names
 * @returns {Object} Correlation matrix
 */
function buildCorrelationMatrix(rows, numericColumns) {
  const matrix = {};

  for (let i = 0; i < numericColumns.length; i++) {
    const col1 = numericColumns[i];
    matrix[col1] = {};

    for (let j = 0; j < numericColumns.length; j++) {
      const col2 = numericColumns[j];

      if (i === j) {
        matrix[col1][col2] = 1.0;
        continue;
      }

      const pairs = getPairedValues(rows, col1, col2);

      // Require minimum pairs for meaningful correlation
      if (pairs.length < MIN_PAIRS_FOR_CORRELATION) {
        matrix[col1][col2] = null;
        continue;
      }

      const x = pairs.map((p) => p[0]);
      const y = pairs.map((p) => p[1]);
      const correlation = pearsonCorrelation(x, y);

      matrix[col1][col2] =
        correlation !== null ? parseFloat(correlation.toFixed(4)) : null;
    }
  }

  return matrix;
}

/**
 * Classify correlations into strong and perfect categories
 * @param {Object} matrix - Correlation matrix
 * @param {Array} numericColumns - Numeric column names
 * @returns {{strongCorrelations: Array, perfectCorrelations: Array}}
 */
function classifyCorrelations(matrix, numericColumns) {
  const strongCorrelations = [];
  const perfectCorrelations = [];

  for (let i = 0; i < numericColumns.length; i++) {
    const col1 = numericColumns[i];
    for (let j = i + 1; j < numericColumns.length; j++) {
      const col2 = numericColumns[j];
      const correlation = matrix[col1][col2];

      if (correlation === null) continue;

      const absCorr = Math.abs(correlation);

      if (absCorr > 0.99) {
        perfectCorrelations.push({
          columns: [col1, col2],
          correlation: correlation,
          message: `Perfect ${
            correlation > 0 ? "positive" : "negative"
          } correlation detected`,
          suggestion: "One column may be redundant or derived from the other",
        });
      } else if (absCorr > 0.7) {
        strongCorrelations.push({
          columns: [col1, col2],
          correlation: correlation,
          strength: absCorr > 0.9 ? "very strong" : "strong",
          direction: correlation > 0 ? "positive" : "negative",
        });
      }
    }
  }

  return { strongCorrelations, perfectCorrelations };
}

/**
 * Analyze correlations between numeric columns
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @returns {Object} Correlation analysis results
 */
export function analyzeCorrelations(rows, headers, columnTypes) {
  // Step 1: Extract numeric columns (no columnData needed)
  const numericColumns = extractNumericColumns(headers, columnTypes);

  if (numericColumns.length < 2) {
    return {
      matrix: {},
      strongCorrelations: [],
      perfectCorrelations: [],
    };
  }

  // Step 2: Build correlation matrix
  const matrix = buildCorrelationMatrix(rows, numericColumns);

  // Step 3: Classify correlations
  const { strongCorrelations, perfectCorrelations } = classifyCorrelations(
    matrix,
    numericColumns
  );

  return {
    matrix,
    strongCorrelations,
    perfectCorrelations,
  };
}

export { pearsonCorrelation };
