/**
 * Column Profiler
 * Generates statistics and distribution for each column
 */

/**
 * Profile a single column
 * @param {string} columnName - Column name
 * @param {Array} values - Column values
 * @returns {Object} Column profile
 */
export function profileColumn(columnName, values) {
  const profile = {
    name: columnName,
    totalCount: values.length,
    nullCount: 0,
    uniqueCount: 0,
    mostCommonValues: [],
    detectedType: "unknown",
  };

  // Count nulls
  const nonNullValues = values.filter((v) => {
    if (v === null || v === undefined || v === "") {
      profile.nullCount++;
      return false;
    }
    return true;
  });

  profile.nullPercent = ((profile.nullCount / values.length) * 100).toFixed(2);
  profile.completeness = (100 - parseFloat(profile.nullPercent)).toFixed(2);

  // Count unique values
  const uniqueSet = new Set(nonNullValues.map((v) => String(v)));
  profile.uniqueCount = uniqueSet.size;
  profile.uniquePercent = (
    (profile.uniqueCount / Math.max(nonNullValues.length, 1)) *
    100
  ).toFixed(2);

  // Most common values (top 10)
  const valueCounts = {};
  nonNullValues.forEach((v) => {
    const key = String(v);
    valueCounts[key] = (valueCounts[key] || 0) + 1;
  });

  profile.mostCommonValues = Object.entries(valueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({
      value: value.substring(0, 50),
      count,
      percent: ((count / nonNullValues.length) * 100).toFixed(2),
    }));

  // Detect if numeric
  const numericValues = nonNullValues
    .map((v) => parseFloat(v))
    .filter((v) => !isNaN(v) && isFinite(v));

  if (numericValues.length > nonNullValues.length * 0.9) {
    profile.detectedType = "numeric";
    profile.numericStats = calculateNumericStats(numericValues);
  } else {
    profile.detectedType = "string";
    profile.stringStats = calculateStringStats(nonNullValues);
  }

  return profile;
}

/**
 * Calculate statistics for numeric column
 */
function calculateNumericStats(values) {
  if (values.length === 0) {
    return { min: null, max: null, mean: null, median: null, stdDev: null };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  // Median
  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

  // Standard deviation
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Quartiles
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];

  return {
    min: sorted[0],
    max: sorted[n - 1],
    mean: parseFloat(mean.toFixed(4)),
    median: parseFloat(median.toFixed(4)),
    stdDev: parseFloat(stdDev.toFixed(4)),
    q1: parseFloat(q1.toFixed(4)),
    q3: parseFloat(q3.toFixed(4)),
    sum: parseFloat(sum.toFixed(4)),
  };
}

/**
 * Calculate statistics for string column
 */
function calculateStringStats(values) {
  if (values.length === 0) {
    return { minLength: 0, maxLength: 0, avgLength: 0 };
  }

  // Use reduce instead of spread to avoid stack overflow on large arrays
  let minLength = Infinity;
  let maxLength = 0;
  let totalLength = 0;

  for (const v of values) {
    const len = String(v).length;
    if (len < minLength) minLength = len;
    if (len > maxLength) maxLength = len;
    totalLength += len;
  }

  const avgLength = totalLength / values.length;

  return {
    minLength: minLength === Infinity ? 0 : minLength,
    maxLength,
    avgLength: parseFloat(avgLength.toFixed(2)),
  };
}
