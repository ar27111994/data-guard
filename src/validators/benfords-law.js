/**
 * Benford's Law Validator
 * Detects potential fraud or data manipulation using Benford's Law
 * (First digit distribution in natural datasets)
 */

/**
 * Expected Benford's Law distribution for first digits (1-9)
 */
const BENFORD_DISTRIBUTION = {
  1: 0.301,
  2: 0.176,
  3: 0.125,
  4: 0.097,
  5: 0.079,
  6: 0.067,
  7: 0.058,
  8: 0.051,
  9: 0.046,
};

/**
 * Analyze numeric column for Benford's Law compliance
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @param {Object} config - Validation config
 * @returns {Object} Benford analysis results
 */
export function analyzeBenfordsLaw(rows, headers, columnTypes, config) {
  const results = {
    columnsAnalyzed: 0,
    violations: [],
    details: [],
  };

  // Find numeric columns
  const numericColumns = headers.filter((header) => {
    const colDef = columnTypes[header];
    return colDef && ["number", "integer"].includes(colDef.type);
  });

  numericColumns.forEach((column) => {
    // Extract positive numeric values
    const values = rows
      .map((row) => parseFloat(row[column]))
      .filter((v) => !isNaN(v) && v > 0);

    if (values.length < 100) {
      return; // Need at least 100 values for meaningful analysis
    }

    // Count first digits
    const digitCounts = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
    };

    values.forEach((value) => {
      const firstDigit = parseInt(String(value).replace(/[^0-9]/g, "")[0], 10);
      if (firstDigit >= 1 && firstDigit <= 9) {
        digitCounts[firstDigit]++;
      }
    });

    const totalCount = Object.values(digitCounts).reduce((a, b) => a + b, 0);

    if (totalCount === 0) return;

    // Calculate observed distribution
    const observedDistribution = {};
    for (let d = 1; d <= 9; d++) {
      observedDistribution[d] = digitCounts[d] / totalCount;
    }

    // Chi-squared test for goodness of fit
    let chiSquared = 0;
    for (let d = 1; d <= 9; d++) {
      const expected = BENFORD_DISTRIBUTION[d];
      const observed = observedDistribution[d];
      chiSquared += Math.pow(observed - expected, 2) / expected;
    }

    // Multiply by sample size for proper chi-squared statistic
    chiSquared *= totalCount;

    // Critical value for df=8 at α=0.05 is 15.51
    const criticalValue = 15.51;
    const isCompliant = chiSquared < criticalValue;

    // Calculate deviation percentage
    let totalDeviation = 0;
    for (let d = 1; d <= 9; d++) {
      totalDeviation += Math.abs(
        observedDistribution[d] - BENFORD_DISTRIBUTION[d]
      );
    }
    const deviationPercent = (totalDeviation / 2) * 100; // Normalize to 0-100

    results.columnsAnalyzed++;
    results.details.push({
      column,
      sampleSize: totalCount,
      chiSquared: parseFloat(chiSquared.toFixed(2)),
      criticalValue,
      isCompliant,
      deviationPercent: parseFloat(deviationPercent.toFixed(2)),
      observedDistribution: Object.fromEntries(
        Object.entries(observedDistribution).map(([k, v]) => [
          k,
          parseFloat(v.toFixed(4)),
        ])
      ),
      expectedDistribution: BENFORD_DISTRIBUTION,
    });

    if (!isCompliant && deviationPercent > 15) {
      results.violations.push({
        column,
        severity: deviationPercent > 30 ? "high" : "medium",
        message: `Column '${column}' deviates ${deviationPercent.toFixed(
          1
        )}% from Benford's Law distribution`,
        suggestion:
          "Review this data for potential manipulation, synthetic generation, or non-natural origin",
      });
    }
  });

  return results;
}

export { BENFORD_DISTRIBUTION };
