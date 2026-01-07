/**
 * Value Distribution Histogram
 * Generates distribution histograms for data profiling
 */

/**
 * Generate histogram for numeric values
 * @param {Array<number>} values - Numeric values
 * @param {number} bins - Number of bins (default: 10)
 * @returns {Object} Histogram data
 */
export function generateNumericHistogram(values, bins = 10) {
  const numericValues = values.filter(
    (v) => typeof v === "number" && !isNaN(v) && isFinite(v)
  );

  if (numericValues.length === 0) {
    return { bins: [], min: null, max: null, binWidth: null };
  }

  // Use iterative approach to avoid stack overflow on large arrays
  let min = Infinity;
  let max = -Infinity;
  for (const v of numericValues) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  // Handle case where all values are the same
  if (min === max) {
    return {
      bins: [
        { start: min, end: max, count: numericValues.length, percent: 100 },
      ],
      min,
      max,
      binWidth: 0,
    };
  }

  const binWidth = (max - min) / bins;
  const histogram = Array(bins)
    .fill(0)
    .map((_, i) => ({
      start: min + i * binWidth,
      end: min + (i + 1) * binWidth,
      count: 0,
      percent: 0,
    }));

  // Count values in each bin
  numericValues.forEach((value) => {
    let binIndex = Math.floor((value - min) / binWidth);
    if (binIndex >= bins) binIndex = bins - 1; // Handle max value
    histogram[binIndex].count++;
  });

  // Calculate percentages
  histogram.forEach((bin) => {
    bin.percent = parseFloat(
      ((bin.count / numericValues.length) * 100).toFixed(2)
    );
  });

  return {
    bins: histogram,
    min,
    max,
    binWidth: parseFloat(binWidth.toFixed(4)),
    totalValues: numericValues.length,
  };
}

/**
 * Generate frequency distribution for categorical values
 * @param {Array} values - Values (strings or categories)
 * @param {number} topN - Number of top values to include (default: 20)
 * @returns {Object} Distribution data
 */
export function generateCategoricalDistribution(values, topN = 20) {
  const nonNullValues = values.filter(
    (v) => v !== null && v !== undefined && v !== ""
  );

  if (nonNullValues.length === 0) {
    return { distribution: [], totalUnique: 0, totalValues: 0 };
  }

  // Count frequencies
  const counts = {};
  nonNullValues.forEach((v) => {
    const key = String(v);
    counts[key] = (counts[key] || 0) + 1;
  });

  // Sort by frequency
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  const distribution = sorted.map(([value, count]) => ({
    value: value.length > 50 ? value.substring(0, 47) + "..." : value,
    count,
    percent: parseFloat(((count / nonNullValues.length) * 100).toFixed(2)),
  }));

  // Calculate "others" if there are more unique values than topN
  const uniqueCount = Object.keys(counts).length;
  if (uniqueCount > topN) {
    const topCount = sorted.reduce((sum, [, count]) => sum + count, 0);
    const othersCount = nonNullValues.length - topCount;
    distribution.push({
      value: `[${uniqueCount - topN} others]`,
      count: othersCount,
      percent: parseFloat(
        ((othersCount / nonNullValues.length) * 100).toFixed(2)
      ),
    });
  }

  return {
    distribution,
    totalUnique: uniqueCount,
    totalValues: nonNullValues.length,
    cardinality: parseFloat((uniqueCount / nonNullValues.length).toFixed(4)),
  };
}

/**
 * Generate cardinality analysis
 * @param {Array} values - Column values
 * @returns {Object} Cardinality metrics
 */
export function analyzeCardinality(values) {
  const nonNullValues = values.filter(
    (v) => v !== null && v !== undefined && v !== ""
  );
  const uniqueValues = new Set(nonNullValues.map(String));

  const cardinality =
    nonNullValues.length > 0 ? uniqueValues.size / nonNullValues.length : 0;

  let cardinalityType;
  if (cardinality === 0) {
    cardinalityType = "empty";
  } else if (cardinality < 0.01) {
    cardinalityType = "very_low"; // Likely categorical with few values
  } else if (cardinality < 0.1) {
    cardinalityType = "low"; // Categorical
  } else if (cardinality < 0.5) {
    cardinalityType = "medium"; // Mixed
  } else if (cardinality < 0.95) {
    cardinalityType = "high"; // Mostly unique
  } else {
    cardinalityType = "unique"; // All or nearly all unique (like IDs)
  }

  return {
    uniqueCount: uniqueValues.size,
    totalCount: nonNullValues.length,
    nullCount: values.length - nonNullValues.length,
    cardinality: parseFloat(cardinality.toFixed(4)),
    cardinalityType,
    recommendation: getCardinalityRecommendation(cardinalityType),
  };
}

/**
 * Get recommendation based on cardinality type
 */
function getCardinalityRecommendation(type) {
  const recommendations = {
    empty: "Column is empty - consider removing or investigating data source",
    very_low: "Very low cardinality - ideal for enum/categorical constraints",
    low: "Low cardinality - suitable for indexing and categorical analysis",
    medium: "Medium cardinality - may contain meaningful categories",
    high: "High cardinality - typical for descriptive text fields",
    unique: "Near-unique values - likely an ID or key field",
  };
  return recommendations[type] || "";
}
