/**
 * ML-Based Pattern Detector
 * Detects anomalous patterns in data using statistical methods
 * (Lightweight ML-inspired approach without heavy dependencies)
 */

/**
 * Detect anomalous patterns in data
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @param {Object} config - Configuration
 * @returns {Object} Pattern detection results
 */
export function detectPatterns(rows, headers, columnTypes, config) {
  const results = {
    anomalies: [],
    patterns: [],
    summary: {
      columnsAnalyzed: 0,
      patternsFound: 0,
      anomaliesFound: 0,
    },
  };

  headers.forEach((header) => {
    const colDef = columnTypes[header];
    const values = rows
      .map((r) => r[header])
      .filter((v) => v !== null && v !== undefined && v !== "");

    if (values.length < 10) return;
    results.summary.columnsAnalyzed++;

    // Pattern 1: Detect repeating sequences
    const repeatingPattern = detectRepeatingSequences(values, header);
    if (repeatingPattern) {
      results.patterns.push(repeatingPattern);
      results.summary.patternsFound++;
    }

    // Pattern 2: Detect sudden value shifts (for numeric columns)
    if (colDef && ["number", "integer"].includes(colDef.type)) {
      const numericValues = values
        .map((v) => parseFloat(v))
        .filter((v) => !isNaN(v));
      const shiftAnomaly = detectSuddenShifts(numericValues, header);
      if (shiftAnomaly) {
        results.anomalies.push(shiftAnomaly);
        results.summary.anomaliesFound++;
      }

      // Pattern 3: Detect monotonic trends
      const trend = detectMonotonicTrend(numericValues, header);
      if (trend) {
        results.patterns.push(trend);
        results.summary.patternsFound++;
      }
    }

    // Pattern 4: Detect unusual frequency distributions
    const frequencyAnomaly = detectFrequencyAnomalies(values, header);
    if (frequencyAnomaly) {
      results.anomalies.push(frequencyAnomaly);
      results.summary.anomaliesFound++;
    }
  });

  return results;
}

/**
 * Detect repeating sequences in values
 */
function detectRepeatingSequences(values, column) {
  // Look for exact repeating patterns
  const windowSize = Math.min(10, Math.floor(values.length / 4));

  for (let size = 2; size <= windowSize; size++) {
    let repeats = 0;
    const pattern = values.slice(0, size);

    for (let i = size; i < values.length - size; i += size) {
      const window = values.slice(i, i + size);
      if (pattern.every((v, idx) => v === window[idx])) {
        repeats++;
      }
    }

    if (repeats >= 3) {
      return {
        column,
        type: "repeating-sequence",
        confidence: Math.min(0.95, 0.5 + repeats / 10),
        message: `Repeating pattern of ${size} values detected (${repeats} repetitions)`,
        suggestion: "This may indicate synthetic data or copy-paste errors",
      };
    }
  }

  return null;
}

/**
 * Detect sudden shifts in numeric values (change point detection)
 */
function detectSuddenShifts(values, column) {
  if (values.length < 20) return null;

  const windowSize = Math.max(5, Math.floor(values.length / 10));
  const means = [];

  // Calculate rolling means
  for (let i = 0; i <= values.length - windowSize; i++) {
    const window = values.slice(i, i + windowSize);
    means.push(window.reduce((a, b) => a + b, 0) / windowSize);
  }

  // Detect large jumps in rolling mean
  const jumps = [];
  for (let i = 1; i < means.length; i++) {
    const change = Math.abs(means[i] - means[i - 1]);
    const avgMean = (Math.abs(means[i]) + Math.abs(means[i - 1])) / 2;
    const changePercent = avgMean > 0 ? (change / avgMean) * 100 : 0;

    if (changePercent > 50) {
      // 50% change threshold
      jumps.push({
        position: i + windowSize,
        changePercent: changePercent.toFixed(1),
      });
    }
  }

  if (jumps.length > 0 && jumps.length <= 5) {
    return {
      column,
      type: "sudden-shift",
      confidence: 0.7,
      positions: jumps.map((j) => j.position),
      message: `Detected ${jumps.length} sudden shift(s) in values`,
      suggestion:
        "Review these positions for data quality issues or legitimate changes",
    };
  }

  return null;
}

/**
 * Detect monotonic trends (always increasing or decreasing)
 */
function detectMonotonicTrend(values, column) {
  if (values.length < 10) return null;

  let increasing = 0;
  let decreasing = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) increasing++;
    else if (values[i] < values[i - 1]) decreasing++;
  }

  const total = values.length - 1;
  const increasingRatio = increasing / total;
  const decreasingRatio = decreasing / total;

  if (increasingRatio > 0.9) {
    return {
      column,
      type: "monotonic-trend",
      direction: "increasing",
      confidence: increasingRatio,
      message: `Column shows strong increasing trend (${(
        increasingRatio * 100
      ).toFixed(0)}% of values increase)`,
      suggestion: "This may be a sequence ID, timestamp, or accumulating value",
    };
  }

  if (decreasingRatio > 0.9) {
    return {
      column,
      type: "monotonic-trend",
      direction: "decreasing",
      confidence: decreasingRatio,
      message: `Column shows strong decreasing trend (${(
        decreasingRatio * 100
      ).toFixed(0)}% of values decrease)`,
      suggestion:
        "This may indicate countdown, depreciation, or declining metric",
    };
  }

  return null;
}

/**
 * Detect unusual frequency distributions (e.g., too uniform or too concentrated)
 */
function detectFrequencyAnomalies(values, column) {
  const counts = {};
  values.forEach((v) => {
    counts[v] = (counts[v] || 0) + 1;
  });

  const frequencies = Object.values(counts);
  const uniqueCount = frequencies.length;
  const avgFrequency = values.length / uniqueCount;

  // Check for perfectly uniform distribution (suspicious)
  const isUniform = frequencies.every((f) => f === frequencies[0]);
  if (isUniform && uniqueCount > 5 && values.length > 50) {
    return {
      column,
      type: "uniform-distribution",
      confidence: 0.8,
      message:
        "Perfectly uniform distribution detected (each value appears exactly the same number of times)",
      suggestion:
        "This is statistically unlikely and may indicate synthetic data",
    };
  }

  // Check for extreme concentration (one value dominates)
  const maxFrequency = frequencies.reduce((a, b) => Math.max(a, b), 0);
  const dominationRatio = maxFrequency / values.length;
  if (dominationRatio > 0.9 && uniqueCount > 1) {
    return {
      column,
      type: "concentrated-distribution",
      confidence: dominationRatio,
      message: `One value accounts for ${(dominationRatio * 100).toFixed(
        0
      )}% of all values`,
      suggestion: "Consider if this column provides meaningful variance",
    };
  }

  return null;
}

export {
  detectRepeatingSequences,
  detectSuddenShifts,
  detectMonotonicTrend,
  detectFrequencyAnomalies,
};
