/**
 * Historical Trend Analyzer
 * Tracks validation metrics over time and detects trends/anomalies
 * Uses statistical methods for ML-like anomaly detection
 */

import { Actor } from "apify";

/** Maximum history entries to retain per data source */
const MAX_HISTORY_ENTRIES = 100;

/** Z-score threshold for anomaly detection */
const ANOMALY_ZSCORE_THRESHOLD = 2.5;

/** Minimum history entries needed for trend analysis */
const MIN_HISTORY_FOR_TRENDS = 3;

/**
 * Generate a unique identifier for a data source
 * @param {Object} config - Input configuration
 * @returns {string} Data source identifier
 */
export function generateDataSourceId(config) {
  if (config.dataSourceIdentifier) {
    return sanitizeId(config.dataSourceIdentifier);
  }

  // Generate from URL
  if (config.dataSourceUrl) {
    try {
      const url = new URL(config.dataSourceUrl);
      // Use hostname + pathname as identifier
      return sanitizeId(`${url.hostname}${url.pathname}`);
    } catch {
      return sanitizeId(config.dataSourceUrl.substring(0, 100));
    }
  }

  // Generate from inline data hash
  if (config.dataSourceInline) {
    return `inline_${hashString(config.dataSourceInline.substring(0, 1000))}`;
  }

  return `unknown_${Date.now()}`;
}

/**
 * Sanitize identifier for use as storage key
 * @param {string} id - Raw identifier
 * @returns {string} Sanitized identifier
 */
function sanitizeId(id) {
  const sanitized = id
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 100);

  // Return fallback if sanitized result is empty
  if (!sanitized) {
    return `id_${hashString(id || "unknown")}`;
  }

  return sanitized;
}

/**
 * Simple hash function for strings
 * @param {string} str - String to hash
 * @returns {string} Hash string
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract key metrics from validation result
 * @param {Object} validationResult - Validation output
 * @param {Object} profileResult - Profiling output
 * @param {Object} qualityScore - Quality score output
 * @returns {Object} Metrics to store
 */
export function extractMetrics(validationResult, profileResult, qualityScore) {
  const issues = validationResult?.issues || [];
  const breakdown = validationResult?.issueBreakdown || {};

  return {
    timestamp: new Date().toISOString(),
    qualityScore: qualityScore?.overall ?? 0,
    grade: qualityScore?.grade ?? "F",
    totalRows: profileResult?.totalRows ?? 0,
    totalIssues: issues.length,
    issueBreakdown: {
      typeErrors: breakdown.typeErrors ?? 0,
      missingValues: breakdown.missingValues ?? 0,
      duplicates: breakdown.duplicates ?? 0,
      outliers: breakdown.outliers ?? 0,
      constraintViolations: breakdown.constraintViolations ?? 0,
    },
    dataQuality: {
      completeness: qualityScore?.completeness ?? 0,
      validity: qualityScore?.validity ?? 0,
      uniqueness: qualityScore?.uniqueness ?? 0,
      consistency: qualityScore?.consistency ?? 0,
    },
  };
}

/**
 * Load historical run data from Key-Value Store
 * @param {string} dataSourceId - Data source identifier
 * @param {number} limit - Maximum entries to load
 * @returns {Promise<Array>} Historical metrics
 */
export async function loadRunHistory(dataSourceId, limit = 30) {
  try {
    const store = await Actor.openKeyValueStore("historical-metrics");
    const key = `history_${dataSourceId}`;
    const history = await store.getValue(key);

    if (!history || !Array.isArray(history)) {
      return [];
    }

    // Return most recent entries up to limit
    return history.slice(-limit);
  } catch (error) {
    console.warn(`   Failed to load history: ${error.message}`);
    return [];
  }
}

/**
 * Store current run metrics
 * @param {string} dataSourceId - Data source identifier
 * @param {Object} metrics - Current run metrics
 * @returns {Promise<void>}
 */
export async function storeRunMetrics(dataSourceId, metrics) {
  try {
    const store = await Actor.openKeyValueStore("historical-metrics");
    const key = `history_${dataSourceId}`;

    // Load existing history
    let history = (await store.getValue(key)) || [];

    // Validate history is an array
    if (!Array.isArray(history)) {
      history = [];
    }

    // Add current metrics
    history.push({
      ...metrics,
      runId: Actor.getEnv().actorRunId || `local_${Date.now()}`,
    });

    // Trim to maximum entries
    if (history.length > MAX_HISTORY_ENTRIES) {
      history = history.slice(-MAX_HISTORY_ENTRIES);
    }

    // Save updated history
    await store.setValue(key, history);
    console.log(
      `   Stored metrics for ${dataSourceId} (${history.length} total runs)`
    );
  } catch (error) {
    console.warn(`   Failed to store metrics: ${error.message}`);
  }
}

/**
 * Calculate statistical measures for a numeric array
 * @param {Array<number>} values - Numeric values
 * @returns {Object} Statistical measures
 */
function calculateStats(values) {
  if (!values || values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, median: 0 };
  }

  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);

  // Mean
  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  // Standard deviation
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Median
  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

  return {
    mean: parseFloat(mean.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    min: sorted[0],
    max: sorted[n - 1],
    median: parseFloat(median.toFixed(2)),
  };
}

/**
 * Calculate moving average
 * @param {Array<number>} values - Numeric values
 * @param {number} window - Window size
 * @returns {Array<number>} Moving averages
 */
function calculateMovingAverage(values, window = 3) {
  if (values.length < window) {
    return values;
  }

  const result = [];
  for (let i = window - 1; i < values.length; i++) {
    const windowValues = values.slice(i - window + 1, i + 1);
    const avg = windowValues.reduce((sum, v) => sum + v, 0) / window;
    result.push(parseFloat(avg.toFixed(2)));
  }
  return result;
}

/**
 * Determine trend direction
 * @param {Array<number>} values - Historical values (oldest to newest)
 * @returns {Object} Trend information
 */
function determineTrend(values) {
  if (values.length < MIN_HISTORY_FOR_TRENDS) {
    return { direction: "insufficient_data", change: 0, confidence: 0 };
  }

  // Use linear regression to determine trend
  const n = values.length;
  const indices = values.map((_, i) => i);

  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, v) => sum + v, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (i - meanX) * (values[i] - meanY);
    denominator += Math.pow(i - meanX, 2);
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;

  // Calculate R-squared for confidence
  const predictions = indices.map((x) => meanY + slope * (x - meanX));
  const ssRes = values.reduce(
    (sum, v, i) => sum + Math.pow(v - predictions[i], 2),
    0
  );
  const ssTot = values.reduce((sum, v) => sum + Math.pow(v - meanY, 2), 0);
  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  // Determine direction
  let direction;
  const changePercent = meanY !== 0 ? ((slope * n) / meanY) * 100 : 0;

  if (Math.abs(changePercent) < 1) {
    direction = "stable";
  } else if (slope > 0) {
    direction = "improving";
  } else {
    direction = "declining";
  }

  return {
    direction,
    change: parseFloat(changePercent.toFixed(2)),
    confidence: parseFloat(Math.max(0, rSquared).toFixed(2)),
    slope: parseFloat(slope.toFixed(4)),
  };
}

/**
 * Detect anomalies in current metrics compared to history
 * @param {Array} history - Historical metrics
 * @param {Object} current - Current metrics
 * @returns {Array} Detected anomalies
 */
export function detectAnomalies(history, current) {
  const anomalies = [];

  if (history.length < MIN_HISTORY_FOR_TRENDS) {
    return anomalies;
  }

  // Metrics to check for anomalies
  const metricsToCheck = [
    { key: "qualityScore", name: "Quality Score", higherBetter: true },
    { key: "totalIssues", name: "Total Issues", higherBetter: false },
    { key: "totalRows", name: "Total Rows", higherBetter: null },
  ];

  for (const metric of metricsToCheck) {
    const historicalValues = history
      .map((h) => h[metric.key])
      .filter((v) => typeof v === "number" && !isNaN(v));

    if (historicalValues.length < MIN_HISTORY_FOR_TRENDS) continue;

    const stats = calculateStats(historicalValues);
    const currentValue = current[metric.key];

    if (typeof currentValue !== "number" || isNaN(currentValue)) continue;

    // Calculate Z-score
    const zscore =
      stats.stdDev !== 0 ? (currentValue - stats.mean) / stats.stdDev : 0;

    // Check if anomalous
    if (Math.abs(zscore) >= ANOMALY_ZSCORE_THRESHOLD) {
      let severity;
      if (Math.abs(zscore) >= 4) {
        severity = "critical";
      } else if (Math.abs(zscore) >= 3) {
        severity = "high";
      } else {
        severity = "medium";
      }

      // Determine if this is good or bad
      let impact;
      if (metric.higherBetter === null) {
        impact = "neutral";
      } else if (
        (metric.higherBetter && zscore > 0) ||
        (!metric.higherBetter && zscore < 0)
      ) {
        impact = "positive";
      } else {
        impact = "negative";
      }

      anomalies.push({
        metric: metric.name,
        key: metric.key,
        currentValue,
        expectedValue: stats.mean,
        zscore: parseFloat(zscore.toFixed(2)),
        deviation: parseFloat((currentValue - stats.mean).toFixed(2)),
        percentDeviation: parseFloat(
          (((currentValue - stats.mean) / stats.mean) * 100).toFixed(2)
        ),
        severity,
        impact,
        message: generateAnomalyMessage(
          metric.name,
          currentValue,
          stats.mean,
          impact
        ),
      });
    }
  }

  return anomalies;
}

/**
 * Generate human-readable anomaly message
 */
function generateAnomalyMessage(metricName, current, expected, impact) {
  const direction = current > expected ? "higher" : "lower";
  const impactText =
    impact === "positive"
      ? "This is a positive deviation."
      : impact === "negative"
      ? "This may indicate a data quality issue."
      : "Monitor this metric for consistency.";

  return `${metricName} is significantly ${direction} than expected (${current} vs ${expected}). ${impactText}`;
}

/**
 * Predict next run metrics using simple linear extrapolation
 * @param {Array} history - Historical metrics
 * @returns {Object} Predictions
 */
export function predictNextRun(history) {
  if (history.length < MIN_HISTORY_FOR_TRENDS) {
    return null;
  }

  const qualityScores = history.map((h) => h.qualityScore);
  const trend = determineTrend(qualityScores);

  if (trend.direction === "insufficient_data") {
    return null;
  }

  const stats = calculateStats(qualityScores);
  const predictedScore = stats.mean + trend.slope;

  // Clamp to valid range
  const clampedScore = Math.max(0, Math.min(100, predictedScore));

  return {
    qualityScore: parseFloat(clampedScore.toFixed(1)),
    confidence: trend.confidence,
    basedOnRuns: history.length,
    trend: trend.direction,
  };
}

/**
 * Calculate comprehensive trends from history
 * @param {Array} history - Historical metrics
 * @returns {Object} Trend analysis
 */
export function calculateTrends(history) {
  if (history.length < MIN_HISTORY_FOR_TRENDS) {
    return {
      hasEnoughData: false,
      message: `Need at least ${MIN_HISTORY_FOR_TRENDS} runs for trend analysis`,
    };
  }

  const qualityScores = history.map((h) => h.qualityScore);
  const totalIssues = history.map((h) => h.totalIssues);
  const totalRows = history.map((h) => h.totalRows);

  return {
    hasEnoughData: true,
    runCount: history.length,
    qualityScore: {
      ...determineTrend(qualityScores),
      stats: calculateStats(qualityScores),
      movingAverage: calculateMovingAverage(qualityScores, 3),
    },
    issueCount: {
      ...determineTrend(totalIssues),
      stats: calculateStats(totalIssues),
    },
    rowCount: {
      ...determineTrend(totalRows),
      stats: calculateStats(totalRows),
    },
    timespan: {
      firstRun: history[0]?.timestamp,
      lastRun: history[history.length - 1]?.timestamp,
    },
  };
}

/**
 * Generate complete historical analysis report
 * @param {string} dataSourceId - Data source identifier
 * @param {Object} currentMetrics - Current run metrics
 * @param {number} compareCount - Number of runs to compare
 * @returns {Promise<Object>} Historical analysis report
 */
export async function analyzeHistoricalTrends(
  dataSourceId,
  currentMetrics,
  compareCount = 10
) {
  console.log(`📊 Analyzing historical trends for: ${dataSourceId}`);

  // Load history
  const history = await loadRunHistory(dataSourceId, compareCount);

  // Store current metrics
  await storeRunMetrics(dataSourceId, currentMetrics);

  // Calculate trends
  const trends = calculateTrends(history);

  // Detect anomalies
  const anomalies = detectAnomalies(history, currentMetrics);

  // Predict next run
  const prediction = predictNextRun(history);

  return {
    enabled: true,
    dataSourceId,
    previousRuns: history.length,
    currentMetrics: {
      qualityScore: currentMetrics.qualityScore,
      totalIssues: currentMetrics.totalIssues,
      totalRows: currentMetrics.totalRows,
    },
    trends,
    anomalies,
    prediction,
    recommendations: generateTrendRecommendations(trends, anomalies),
  };
}

/**
 * Generate recommendations based on trends and anomalies
 */
function generateTrendRecommendations(trends, anomalies) {
  const recommendations = [];

  if (!trends.hasEnoughData) {
    recommendations.push({
      type: "info",
      message: "Run more validations to enable trend analysis and predictions.",
    });
    return recommendations;
  }

  // Quality score trend recommendations
  if (trends.qualityScore?.direction === "declining") {
    recommendations.push({
      type: "warning",
      message: `Quality score is declining (${trends.qualityScore.change}% change). Review recent data sources for issues.`,
    });
  } else if (trends.qualityScore?.direction === "improving") {
    recommendations.push({
      type: "success",
      message: `Quality score is improving (${trends.qualityScore.change}% change). Data quality practices are working.`,
    });
  }

  // Anomaly recommendations
  for (const anomaly of anomalies) {
    if (anomaly.impact === "negative") {
      recommendations.push({
        type: "alert",
        message: anomaly.message,
        metric: anomaly.key,
      });
    }
  }

  // High variability warning
  if (trends.qualityScore?.stats?.stdDev > 10) {
    recommendations.push({
      type: "warning",
      message:
        "High variability in quality scores. Consider standardizing data sources.",
    });
  }

  return recommendations;
}
