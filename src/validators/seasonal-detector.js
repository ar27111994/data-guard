/**
 * Seasonal Anomaly Detection
 * Detect patterns based on time-based seasonality
 */

/** Days of week for pattern detection */
const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Months for pattern detection */
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Parse date value from various formats
 * @param {*} value - Date value
 * @returns {Date|null} Parsed date or null
 */
function parseDate(value) {
  if (!value) return null;

  // Already a Date
  if (value instanceof Date && !isNaN(value)) {
    return value;
  }

  // Try parsing string
  if (typeof value === "string") {
    // Only use native parser for ISO 8601 format (YYYY-MM-DDTHH:mm:ss...)
    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
      const isoDate = new Date(value);
      if (!isNaN(isoDate)) return isoDate;
    }

    // Common date formats with capture groups
    const formats = [
      { regex: /^(\d{4})-(\d{2})-(\d{2})/, order: ["year", "month", "day"] }, // YYYY-MM-DD
      { regex: /^(\d{2})\/(\d{2})\/(\d{4})/, order: ["month", "day", "year"] }, // MM/DD/YYYY
      { regex: /^(\d{2})-(\d{2})-(\d{4})/, order: ["day", "month", "year"] }, // DD-MM-YYYY
    ];

    for (const format of formats) {
      const match = value.match(format.regex);
      if (match) {
        const parts = {};
        format.order.forEach((key, idx) => {
          parts[key] = parseInt(match[idx + 1], 10);
        });

        // Validate ranges
        if (
          parts.year < 1900 ||
          parts.year > 2100 ||
          parts.month < 1 ||
          parts.month > 12 ||
          parts.day < 1 ||
          parts.day > 31
        ) {
          continue;
        }

        // Construct Date (month is 0-based)
        const date = new Date(parts.year, parts.month - 1, parts.day);
        if (!isNaN(date)) return date;
      }
    }
  }

  // Try parsing timestamp
  if (typeof value === "number") {
    const date = new Date(value);
    if (!isNaN(date)) return date;
  }

  return null;
}

/**
 * Detect date columns in dataset
 * @param {Array<Object>} rows - Data rows
 * @param {Array<string>} headers - Column headers
 * @returns {Array<string>} Date column names
 */
export function detectDateColumns(rows, headers) {
  if (!rows || rows.length === 0) {
    return [];
  }

  const dateColumns = [];
  const sampleSize = Math.min(rows.length, 100);

  for (const header of headers) {
    let dateCount = 0;

    for (let i = 0; i < sampleSize; i++) {
      const value = rows[i][header];
      if (value !== null && value !== undefined && value !== "") {
        const parsed = parseDate(value);
        if (parsed) dateCount++;
      }
    }

    // Consider date column if >80% are valid dates
    if (dateCount / sampleSize > 0.8) {
      dateColumns.push(header);
    }
  }

  return dateColumns;
}

/**
 * Calculate statistics for a group of values
 * @param {Array<number>} values - Numeric values
 * @returns {Object} Statistics
 */
function calculateGroupStats(values) {
  const validValues = values.filter((v) => !isNaN(v) && v !== null);
  if (validValues.length === 0) {
    return { mean: 0, stdDev: 0, count: 0, min: 0, max: 0 };
  }

  const n = validValues.length;
  const mean = validValues.reduce((sum, v) => sum + v, 0) / n;
  const variance =
    validValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    mean: parseFloat(mean.toFixed(4)),
    stdDev: parseFloat(stdDev.toFixed(4)),
    count: n,
    min: validValues.reduce((a, b) => Math.min(a, b), Infinity),
    max: validValues.reduce((a, b) => Math.max(a, b), -Infinity),
  };
}

/**
 * Analyze day-of-week patterns
 * @param {Array<Object>} rows - Data rows
 * @param {string} dateColumn - Date column name
 * @param {string} valueColumn - Value column to analyze
 * @returns {Object} Day-of-week pattern analysis
 */
export function analyzeDayOfWeekPattern(rows, dateColumn, valueColumn) {
  const dayBuckets = Array(7)
    .fill(null)
    .map(() => []);

  for (const row of rows) {
    const date = parseDate(row[dateColumn]);
    const value = parseFloat(row[valueColumn]);

    if (date && !isNaN(value)) {
      const dayOfWeek = date.getDay();
      dayBuckets[dayOfWeek].push(value);
    }
  }

  const dayStats = DAYS_OF_WEEK.map((day, index) => ({
    day,
    dayIndex: index,
    ...calculateGroupStats(dayBuckets[index]),
  }));

  // Calculate overall stats for comparison
  const allValues = dayBuckets.flat();
  const overallStats = calculateGroupStats(allValues);

  // Identify anomalous days (significantly different from overall)
  const anomalousDays = dayStats
    .filter((d) => {
      if (d.count < 3 || overallStats.stdDev === 0) return false;
      const zscore = Math.abs(d.mean - overallStats.mean) / overallStats.stdDev;
      return zscore > 2;
    })
    .map((d) => ({
      ...d,
      deviation:
        overallStats.mean !== 0
          ? parseFloat(
              (
                ((d.mean - overallStats.mean) / overallStats.mean) *
                100
              ).toFixed(2)
            )
          : 0,
    }));

  return {
    pattern: "dayOfWeek",
    dateColumn,
    valueColumn,
    dayStats,
    overallStats,
    anomalousDays,
    hasSeasonality: anomalousDays.length > 0,
  };
}

/**
 * Analyze monthly patterns
 * @param {Array<Object>} rows - Data rows
 * @param {string} dateColumn - Date column name
 * @param {string} valueColumn - Value column to analyze
 * @returns {Object} Monthly pattern analysis
 */
export function analyzeMonthlyPattern(rows, dateColumn, valueColumn) {
  const monthBuckets = Array(12)
    .fill(null)
    .map(() => []);

  for (const row of rows) {
    const date = parseDate(row[dateColumn]);
    const value = parseFloat(row[valueColumn]);

    if (date && !isNaN(value)) {
      const month = date.getMonth();
      monthBuckets[month].push(value);
    }
  }

  const monthStats = MONTHS.map((month, index) => ({
    month,
    monthIndex: index,
    ...calculateGroupStats(monthBuckets[index]),
  }));

  const allValues = monthBuckets.flat();
  const overallStats = calculateGroupStats(allValues);

  const anomalousMonths = monthStats
    .filter((m) => {
      if (m.count < 3 || overallStats.stdDev === 0) return false;
      const zscore = Math.abs(m.mean - overallStats.mean) / overallStats.stdDev;
      return zscore > 2;
    })
    .map((m) => ({
      ...m,
      deviation:
        overallStats.mean !== 0
          ? parseFloat(
              (
                ((m.mean - overallStats.mean) / overallStats.mean) *
                100
              ).toFixed(2)
            )
          : 0,
    }));

  return {
    pattern: "monthly",
    dateColumn,
    valueColumn,
    monthStats,
    overallStats,
    anomalousMonths,
    hasSeasonality: anomalousMonths.length > 0,
  };
}

/**
 * Analyze hourly patterns (for timestamp data)
 * @param {Array<Object>} rows - Data rows
 * @param {string} dateColumn - Date/time column name
 * @param {string} valueColumn - Value column to analyze
 * @returns {Object} Hourly pattern analysis
 */
export function analyzeHourlyPattern(rows, dateColumn, valueColumn) {
  const hourBuckets = Array(24)
    .fill(null)
    .map(() => []);

  for (const row of rows) {
    const date = parseDate(row[dateColumn]);
    const value = parseFloat(row[valueColumn]);

    if (date && !isNaN(value)) {
      const hour = date.getHours();
      hourBuckets[hour].push(value);
    }
  }

  const hourStats = hourBuckets.map((bucket, hour) => ({
    hour,
    hourLabel: `${hour.toString().padStart(2, "0")}:00`,
    ...calculateGroupStats(bucket),
  }));

  const allValues = hourBuckets.flat();
  const overallStats = calculateGroupStats(allValues);

  const anomalousHours = hourStats
    .filter((h) => {
      if (h.count < 3 || overallStats.stdDev === 0) return false;
      const zscore = Math.abs(h.mean - overallStats.mean) / overallStats.stdDev;
      return zscore > 2;
    })
    .map((h) => ({
      ...h,
      deviation:
        overallStats.mean !== 0
          ? parseFloat(
              (
                ((h.mean - overallStats.mean) / overallStats.mean) *
                100
              ).toFixed(2)
            )
          : 0,
    }));

  return {
    pattern: "hourly",
    dateColumn,
    valueColumn,
    hourStats: hourStats.filter((h) => h.count > 0),
    overallStats,
    anomalousHours,
    hasSeasonality: anomalousHours.length > 0,
  };
}

/**
 * Detect trend in time series data
 * @param {Array<Object>} rows - Data rows
 * @param {string} dateColumn - Date column
 * @param {string} valueColumn - Value column
 * @returns {Object} Trend analysis
 */
export function detectTrend(rows, dateColumn, valueColumn) {
  // Sort by date
  const sortedRows = [...rows]
    .filter(
      (r) => parseDate(r[dateColumn]) && !isNaN(parseFloat(r[valueColumn]))
    )
    .sort((a, b) => parseDate(a[dateColumn]) - parseDate(b[dateColumn]));

  if (sortedRows.length < 5) {
    return {
      hasTrend: false,
      message: "Insufficient data for trend detection",
    };
  }

  const values = sortedRows.map((r) => parseFloat(r[valueColumn]));
  const n = values.length;

  // Linear regression
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
  const intercept = meanY - slope * meanX;

  // Calculate R-squared
  const predictions = indices.map((x) => intercept + slope * x);
  const ssRes = values.reduce(
    (sum, v, i) => sum + Math.pow(v - predictions[i], 2),
    0
  );
  const ssTot = values.reduce((sum, v) => sum + Math.pow(v - meanY, 2), 0);
  const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  // Determine trend direction
  const percentChange = meanY !== 0 ? ((slope * n) / meanY) * 100 : 0;
  let direction;
  if (Math.abs(percentChange) < 5) {
    direction = "stable";
  } else if (slope > 0) {
    direction = "increasing";
  } else {
    direction = "decreasing";
  }

  return {
    hasTrend: Math.abs(percentChange) >= 5 && rSquared > 0.3,
    direction,
    slope: parseFloat(slope.toFixed(6)),
    rSquared: parseFloat(rSquared.toFixed(4)),
    percentChange: parseFloat(percentChange.toFixed(2)),
    startValue: values[0],
    endValue: values[n - 1],
    dataPoints: n,
  };
}

/**
 * Run comprehensive seasonal analysis
 * @param {Array<Object>} rows - Data rows
 * @param {Array<string>} headers - Column headers
 * @param {Object} columnTypes - Column type mappings
 * @param {Object} config - Configuration
 * @returns {Object} Seasonal analysis results
 */
export function analyzeSeasonalPatterns(
  rows,
  headers,
  columnTypes,
  config = {}
) {
  if (!rows || rows.length < 10) {
    return {
      hasSeasonality: false,
      message:
        "Insufficient data for seasonal analysis (minimum 10 rows required)",
    };
  }

  // Find date columns
  const dateColumns = detectDateColumns(rows, headers);

  if (dateColumns.length === 0) {
    return {
      hasSeasonality: false,
      message: "No date columns detected for seasonal analysis",
    };
  }

  // Find numeric columns for value analysis
  // Stage 1: Include explicitly-typed numeric columns, or all non-date columns if type info unavailable
  const numericColumns = headers.filter((h) => {
    const type = columnTypes?.[h]?.type;
    return (
      type === "number" ||
      type === "integer" ||
      type === "float" ||
      (!type && !dateColumns.includes(h))
    );
  });

  const validNumericColumns = numericColumns.filter((col) => {
    const values = rows.slice(0, 100).map((r) => parseFloat(r[col]));
    const validCount = values.filter((v) => !isNaN(v)).length;
    return validCount / Math.min(rows.length, 100) > 0.5;
  });

  if (validNumericColumns.length === 0) {
    return {
      hasSeasonality: false,
      message: "No numeric columns found for seasonal analysis",
    };
  }

  const results = {
    dateColumns,
    analysisResults: [],
  };

  // Analyze each date-value column pair
  for (const dateCol of dateColumns) {
    for (const valueCol of validNumericColumns.slice(0, 5)) {
      // Limit to 5 value columns
      const dayOfWeek = analyzeDayOfWeekPattern(rows, dateCol, valueCol);
      const monthly = analyzeMonthlyPattern(rows, dateCol, valueCol);
      const trend = detectTrend(rows, dateCol, valueCol);

      if (
        dayOfWeek.hasSeasonality ||
        monthly.hasSeasonality ||
        trend.hasTrend
      ) {
        results.analysisResults.push({
          dateColumn: dateCol,
          valueColumn: valueCol,
          dayOfWeekPattern: dayOfWeek.hasSeasonality ? dayOfWeek : null,
          monthlyPattern: monthly.hasSeasonality ? monthly : null,
          trend: trend.hasTrend ? trend : null,
        });
      }
    }
  }

  results.hasSeasonality = results.analysisResults.length > 0;
  results.patternsFound = results.analysisResults.length;

  if (results.hasSeasonality) {
    results.summary = results.analysisResults.map((r) => ({
      dateColumn: r.dateColumn,
      valueColumn: r.valueColumn,
      patterns: [
        r.dayOfWeekPattern ? "day-of-week" : null,
        r.monthlyPattern ? "monthly" : null,
        r.trend ? `trend:${r.trend.direction}` : null,
      ].filter(Boolean),
    }));
  }

  return results;
}
