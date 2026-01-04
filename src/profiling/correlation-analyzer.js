/**
 * Correlation Analyzer
 * Analyzes correlations between numeric columns
 */

/**
 * Calculate Pearson correlation coefficient between two arrays
 * @param {Array<number>} x - First array
 * @param {Array<number>} y - Second array
 * @returns {number} Correlation coefficient (-1 to 1)
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
 * Analyze correlations between numeric columns
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @returns {Object} Correlation analysis results
 */
export function analyzeCorrelations(rows, headers, columnTypes) {
  const results = {
    matrix: {},
    strongCorrelations: [],
    perfectCorrelations: [],
  };

  // Find numeric columns
  const numericColumns = headers.filter((header) => {
    const colDef = columnTypes[header];
    return colDef && ["number", "integer"].includes(colDef.type);
  });

  if (numericColumns.length < 2) {
    return results;
  }

  // Extract numeric values for each column
  const columnData = {};
  numericColumns.forEach((col) => {
    columnData[col] = rows
      .map((row) => parseFloat(row[col]))
      .filter((v) => !isNaN(v));
  });

  // Calculate correlation matrix
  for (let i = 0; i < numericColumns.length; i++) {
    const col1 = numericColumns[i];
    results.matrix[col1] = {};

    for (let j = 0; j < numericColumns.length; j++) {
      const col2 = numericColumns[j];

      if (i === j) {
        results.matrix[col1][col2] = 1.0;
        continue;
      }

      // Get paired values (exclude rows with NaN in either column)
      const pairs = [];
      for (let k = 0; k < rows.length; k++) {
        const v1 = parseFloat(rows[k][col1]);
        const v2 = parseFloat(rows[k][col2]);
        if (!isNaN(v1) && !isNaN(v2)) {
          pairs.push([v1, v2]);
        }
      }

      if (pairs.length < 10) {
        results.matrix[col1][col2] = null;
        continue;
      }

      const x = pairs.map((p) => p[0]);
      const y = pairs.map((p) => p[1]);
      const correlation = pearsonCorrelation(x, y);

      results.matrix[col1][col2] =
        correlation !== null ? parseFloat(correlation.toFixed(4)) : null;

      // Track strong correlations (|r| > 0.7, i < j to avoid duplicates)
      if (i < j && correlation !== null) {
        const absCorr = Math.abs(correlation);

        if (absCorr > 0.99) {
          results.perfectCorrelations.push({
            columns: [col1, col2],
            correlation: parseFloat(correlation.toFixed(4)),
            message: `Perfect ${
              correlation > 0 ? "positive" : "negative"
            } correlation detected`,
            suggestion: "One column may be redundant or derived from the other",
          });
        } else if (absCorr > 0.7) {
          results.strongCorrelations.push({
            columns: [col1, col2],
            correlation: parseFloat(correlation.toFixed(4)),
            strength: absCorr > 0.9 ? "very strong" : "strong",
            direction: correlation > 0 ? "positive" : "negative",
          });
        }
      }
    }
  }

  return results;
}

export { pearsonCorrelation };
