/**
 * Missing Value Imputation
 * Strategies for handling and filling missing values
 */

/** Supported imputation strategies */
export const IMPUTATION_STRATEGIES = {
  MEAN: "mean",
  MEDIAN: "median",
  MODE: "mode",
  FORWARD_FILL: "forwardFill",
  BACKWARD_FILL: "backwardFill",
  CONSTANT: "constant",
  REMOVE: "remove",
};

/**
 * Calculate mean of numeric array
 * @param {Array<number>} values - Numeric values
 * @returns {number} Mean value
 */
function calculateMean(values) {
  const validValues = values.filter(
    (v) => v !== null && v !== undefined && !isNaN(v)
  );
  if (validValues.length === 0) return 0;
  return (
    validValues.reduce((sum, v) => sum + Number(v), 0) / validValues.length
  );
}

/**
 * Calculate median of numeric array
 * @param {Array<number>} values - Numeric values
 * @returns {number} Median value
 */
function calculateMedian(values) {
  const validValues = values
    .filter((v) => v !== null && v !== undefined && !isNaN(v))
    .map(Number)
    .sort((a, b) => a - b);

  if (validValues.length === 0) return 0;

  const mid = Math.floor(validValues.length / 2);
  if (validValues.length % 2 === 0) {
    return (validValues[mid - 1] + validValues[mid]) / 2;
  }
  return validValues[mid];
}

/**
 * Calculate mode of array (most frequent value)
 * @param {Array} values - Values array
 * @returns {*} Most frequent value
 */
function calculateMode(values) {
  const validValues = values.filter(
    (v) => v !== null && v !== undefined && v !== ""
  );

  // Return undefined for consistency with mean/median when no valid values
  if (validValues.length === 0) return undefined;

  const frequency = new Map();
  let maxFreq = 0;
  let mode = validValues[0];

  for (const value of validValues) {
    const count = (frequency.get(value) || 0) + 1;
    frequency.set(value, count);

    if (count > maxFreq) {
      maxFreq = count;
      mode = value;
    }
  }

  return mode;
}

/**
 * Check if a value is missing (null, undefined, empty string, NaN)
 * @param {*} value - Value to check
 * @returns {boolean} True if missing
 */
export function isMissing(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (typeof value === "number" && isNaN(value)) return true;
  return false;
}

/**
 * Detect column type for imputation strategy selection
 * @param {Array<Object>} rows - Data rows
 * @param {string} column - Column name
 * @returns {string} 'numeric' or 'categorical'
 */
function detectColumnType(rows, column) {
  const values = rows.map((row) => row[column]).filter((v) => !isMissing(v));

  if (values.length === 0) return "categorical";

  // Check if mostly numeric
  const numericCount = values.filter(
    (v) => !isNaN(Number(v)) && v !== true && v !== false
  ).length;

  return numericCount / values.length > 0.8 ? "numeric" : "categorical";
}

/**
 * Apply forward fill imputation
 * @param {Array<Object>} rows - Data rows
 * @param {string} column - Column to fill
 * @returns {Array<Object>} Rows with filled values
 */
function forwardFill(rows, column) {
  let lastValidValue = null;

  return rows.map((row) => {
    const newRow = { ...row };
    if (isMissing(newRow[column])) {
      if (lastValidValue !== null) {
        newRow[column] = lastValidValue;
      }
    } else {
      lastValidValue = newRow[column];
    }
    return newRow;
  });
}

/**
 * Apply backward fill imputation
 * @param {Array<Object>} rows - Data rows
 * @param {string} column - Column to fill
 * @returns {Array<Object>} Rows with filled values
 */
function backwardFill(rows, column) {
  // Process in reverse
  let nextValidValue = null;
  const result = [...rows];

  for (let i = result.length - 1; i >= 0; i--) {
    if (isMissing(result[i][column])) {
      if (nextValidValue !== null) {
        result[i] = { ...result[i], [column]: nextValidValue };
      }
    } else {
      nextValidValue = result[i][column];
    }
  }

  return result;
}

/**
 * Impute missing values for a single column
 * @param {Array<Object>} rows - Data rows
 * @param {string} column - Column name
 * @param {string} strategy - Imputation strategy
 * @param {Object} options - Additional options
 * @returns {Object} Imputed rows and statistics
 */
function imputeColumn(rows, column, strategy, options = {}) {
  const columnType = detectColumnType(rows, column);
  const originalMissingCount = rows.filter((row) =>
    isMissing(row[column])
  ).length;

  if (originalMissingCount === 0) {
    return {
      rows,
      stats: {
        column,
        strategy: "none",
        missingCount: 0,
        imputedCount: 0,
      },
    };
  }

  let imputedRows;
  let imputeValue;
  let effectiveStrategy = strategy;

  // Select appropriate strategy based on column type if auto
  if (strategy === "auto") {
    effectiveStrategy =
      columnType === "numeric"
        ? IMPUTATION_STRATEGIES.MEDIAN
        : IMPUTATION_STRATEGIES.MODE;
  }

  const values = rows.map((row) => row[column]);

  switch (effectiveStrategy) {
    case IMPUTATION_STRATEGIES.MEAN:
      if (columnType !== "numeric") {
        // Fall back to mode for non-numeric
        imputeValue = calculateMode(values);
        effectiveStrategy = IMPUTATION_STRATEGIES.MODE;
      } else {
        imputeValue = calculateMean(values);
      }
      imputedRows = rows.map((row) => ({
        ...row,
        [column]: isMissing(row[column]) ? imputeValue : row[column],
      }));
      break;

    case IMPUTATION_STRATEGIES.MEDIAN:
      if (columnType !== "numeric") {
        imputeValue = calculateMode(values);
        effectiveStrategy = IMPUTATION_STRATEGIES.MODE;
      } else {
        imputeValue = calculateMedian(values);
      }
      imputedRows = rows.map((row) => ({
        ...row,
        [column]: isMissing(row[column]) ? imputeValue : row[column],
      }));
      break;

    case IMPUTATION_STRATEGIES.MODE:
      imputeValue = calculateMode(values);
      // Skip imputation if no valid mode exists
      if (imputeValue === undefined) {
        return {
          rows,
          stats: {
            column,
            strategy: "none",
            columnType,
            missingCount: originalMissingCount,
            imputedCount: 0,
            rowsRemoved: 0,
            imputeValue: null,
          },
        };
      }
      imputedRows = rows.map((row) => ({
        ...row,
        [column]: isMissing(row[column]) ? imputeValue : row[column],
      }));
      break;

    case IMPUTATION_STRATEGIES.FORWARD_FILL:
      imputedRows = forwardFill(rows, column);
      imputeValue = "previous value";
      break;

    case IMPUTATION_STRATEGIES.BACKWARD_FILL:
      imputedRows = backwardFill(rows, column);
      imputeValue = "next value";
      break;

    case IMPUTATION_STRATEGIES.CONSTANT:
      imputeValue =
        options.constantValue ?? (columnType === "numeric" ? 0 : "");
      imputedRows = rows.map((row) => ({
        ...row,
        [column]: isMissing(row[column]) ? imputeValue : row[column],
      }));
      break;

    case IMPUTATION_STRATEGIES.REMOVE:
      imputedRows = rows.filter((row) => !isMissing(row[column]));
      imputeValue = null;
      break;

    default:
      imputedRows = rows;
      effectiveStrategy = "none";
      imputeValue = null;
  }

  // Calculate counts:
  // imputedCount = values filled, rowsRemoved = rows dropped
  const rowsRemoved =
    effectiveStrategy === IMPUTATION_STRATEGIES.REMOVE
      ? rows.length - imputedRows.length
      : 0;
  const imputedCount =
    effectiveStrategy === IMPUTATION_STRATEGIES.REMOVE
      ? 0
      : originalMissingCount;

  return {
    rows: imputedRows,
    stats: {
      column,
      strategy: effectiveStrategy,
      columnType,
      missingCount: originalMissingCount,
      imputedCount,
      rowsRemoved,
      imputeValue:
        typeof imputeValue === "number"
          ? parseFloat(imputeValue.toFixed(4))
          : imputeValue,
    },
  };
}

/**
 * Impute missing values in dataset
 * @param {Array<Object>} rows - Data rows
 * @param {Array<string>} headers - Column headers
 * @param {Object} config - Configuration
 * @returns {Object} Imputed data and statistics
 */
export function imputeMissingValues(rows, headers, config = {}) {
  const {
    imputationStrategy = "auto",
    columnsToImpute = null, // null = all columns
    constantValue = null,
    excludeColumns = [],
  } = config;

  if (!rows || rows.length === 0) {
    return {
      rows: [],
      summary: {
        totalMissing: 0,
        totalImputed: 0,
        columnStats: [],
      },
    };
  }

  // Determine columns to process
  const columnsToProcess = columnsToImpute || headers;
  const filteredColumns = columnsToProcess.filter(
    (col) => !excludeColumns.includes(col)
  );

  let currentRows = rows;
  const columnStats = [];
  let totalMissing = 0;
  let totalImputed = 0;

  // Process each column
  for (const column of filteredColumns) {
    const result = imputeColumn(currentRows, column, imputationStrategy, {
      constantValue,
    });

    currentRows = result.rows;
    columnStats.push(result.stats);
    totalMissing += result.stats.missingCount;
    totalImputed += result.stats.imputedCount;
  }

  return {
    rows: currentRows,
    summary: {
      strategy: imputationStrategy,
      totalMissing,
      totalImputed,
      columnsProcessed: filteredColumns.length,
      columnStats: columnStats.filter((s) => s.missingCount > 0),
    },
  };
}

/**
 * Analyze missing values in dataset
 * @param {Array<Object>} rows - Data rows
 * @param {Array<string>} headers - Column headers
 * @returns {Object} Missing value analysis
 */
export function analyzeMissingValues(rows, headers) {
  if (!rows || rows.length === 0) {
    return {
      totalRows: 0,
      rowsWithMissing: 0,
      totalMissingValues: 0,
      columnMissing: {},
      missingPattern: [],
    };
  }

  const columnMissing = {};
  let totalMissingValues = 0;
  let rowsWithMissing = 0;

  for (const header of headers) {
    columnMissing[header] = {
      count: 0,
      percentage: 0,
    };
  }

  for (const row of rows) {
    let rowHasMissing = false;

    for (const header of headers) {
      if (isMissing(row[header])) {
        columnMissing[header].count++;
        totalMissingValues++;
        rowHasMissing = true;
      }
    }

    if (rowHasMissing) {
      rowsWithMissing++;
    }
  }

  // Calculate percentages
  for (const header of headers) {
    columnMissing[header].percentage = parseFloat(
      ((columnMissing[header].count / rows.length) * 100).toFixed(2)
    );
  }

  // Find columns with most missing
  const sortedColumns = Object.entries(columnMissing)
    .sort((a, b) => b[1].count - a[1].count)
    .filter(([, stats]) => stats.count > 0);

  return {
    totalRows: rows.length,
    rowsWithMissing,
    rowsWithMissingPercentage: parseFloat(
      ((rowsWithMissing / rows.length) * 100).toFixed(2)
    ),
    totalMissingValues,
    columnMissing,
    mostMissing: sortedColumns.slice(0, 5).map(([col, stats]) => ({
      column: col,
      ...stats,
    })),
  };
}
