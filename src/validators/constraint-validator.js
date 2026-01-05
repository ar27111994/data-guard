/**
 * Constraint Validator
 * Validates field constraints: required, min, max, pattern, allowedValues
 * With modular validator functions, issue aggregation, and regex caching
 */

/** Cache for compiled regex patterns (keyed by pattern string only) */
const regexCache = new Map();

/** Maximum number of cached regex patterns to prevent unbounded growth */
const MAX_REGEX_CACHE_SIZE = 100;

/**
 * Get or compile a regex pattern with caching and bounded eviction
 * @param {string} pattern - Regex pattern string
 * @param {string} column - Column name for error logging
 * @returns {RegExp|null} Compiled regex or null if invalid
 */
function getCompiledRegex(pattern, column) {
  // Use pattern-only as cache key so identical patterns share one compiled RegExp
  if (regexCache.has(pattern)) {
    const cached = regexCache.get(pattern);
    return cached === "invalid" ? null : cached;
  }

  // Evict oldest entry if cache is full (simple LRU-like eviction)
  if (regexCache.size >= MAX_REGEX_CACHE_SIZE) {
    const oldestKey = regexCache.keys().next().value;
    regexCache.delete(oldestKey);
  }

  try {
    const regex = new RegExp(pattern);
    regexCache.set(pattern, regex);
    return regex;
  } catch (e) {
    console.warn(`Invalid regex pattern for ${column}: ${pattern}`);
    regexCache.set(pattern, "invalid");
    return null;
  }
}

/**
 * Create issue aggregator factory for reusable issue collection with counting
 * @param {number} maxIssues - Maximum issues per type
 * @returns {Object} Issue aggregator with addIssue method and getIssues method
 */
function createIssueAggregator(maxIssues) {
  const issues = [];
  const countByType = {};

  return {
    addIssue(rowIndex, column, value, issueType, message, suggestion) {
      countByType[issueType] = (countByType[issueType] || 0) + 1;

      if (countByType[issueType] <= maxIssues) {
        issues.push({
          rowNumber: rowIndex + 1,
          column,
          value: String(value).substring(0, 100),
          issueType,
          severity: "error",
          message,
          suggestion,
        });
      }
    },
    getIssues() {
      return issues;
    },
    getCounts() {
      return countByType;
    },
  };
}

/**
 * Validate min/max numeric constraints
 * @param {*} value - Value to validate
 * @param {string} column - Column name
 * @param {number} rowIndex - Row index
 * @param {Object} constraints - Constraint definitions
 * @param {Object} aggregator - Issue aggregator
 */
function validateMinMax(value, column, rowIndex, constraints, aggregator) {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return;

  if (constraints.min !== undefined && numValue < constraints.min) {
    aggregator.addIssue(
      rowIndex,
      column,
      value,
      "range-min-violation",
      `Value ${numValue} is below minimum ${constraints.min}`,
      `Ensure value is at least ${constraints.min}`
    );
  }

  if (constraints.max !== undefined && numValue > constraints.max) {
    aggregator.addIssue(
      rowIndex,
      column,
      value,
      "range-max-violation",
      `Value ${numValue} exceeds maximum ${constraints.max}`,
      `Ensure value is at most ${constraints.max}`
    );
  }
}

/**
 * Validate string length constraints
 * @param {*} value - Value to validate
 * @param {string} column - Column name
 * @param {number} rowIndex - Row index
 * @param {Object} constraints - Constraint definitions
 * @param {Object} aggregator - Issue aggregator
 */
function validateLength(value, column, rowIndex, constraints, aggregator) {
  const strValue = String(value);

  if (
    constraints.minLength !== undefined &&
    strValue.length < constraints.minLength
  ) {
    aggregator.addIssue(
      rowIndex,
      column,
      value,
      "length-min-violation",
      `Value length ${strValue.length} is below minimum ${constraints.minLength}`,
      `Provide at least ${constraints.minLength} characters`
    );
  }

  if (
    constraints.maxLength !== undefined &&
    strValue.length > constraints.maxLength
  ) {
    aggregator.addIssue(
      rowIndex,
      column,
      value,
      "length-max-violation",
      `Value length ${strValue.length} exceeds maximum ${constraints.maxLength}`,
      `Limit to ${constraints.maxLength} characters`
    );
  }
}

/**
 * Validate regex pattern constraint with caching
 * @param {*} value - Value to validate
 * @param {string} column - Column name
 * @param {number} rowIndex - Row index
 * @param {Object} constraints - Constraint definitions
 * @param {Object} aggregator - Issue aggregator
 */
function validatePattern(value, column, rowIndex, constraints, aggregator) {
  if (!constraints.pattern) return;

  const regex = getCompiledRegex(constraints.pattern, column);
  if (!regex) return; // Invalid pattern already logged once

  if (!regex.test(String(value))) {
    aggregator.addIssue(
      rowIndex,
      column,
      value,
      "pattern-violation",
      `Value does not match required pattern: ${constraints.pattern}`,
      "Ensure value matches the expected format"
    );
  }
}

/**
 * Validate enum/allowed values constraint
 * @param {*} value - Value to validate
 * @param {string} column - Column name
 * @param {number} rowIndex - Row index
 * @param {Object} constraints - Constraint definitions
 * @param {Object} aggregator - Issue aggregator
 */
function validateEnum(value, column, rowIndex, constraints, aggregator) {
  if (!constraints.allowedValues || !Array.isArray(constraints.allowedValues))
    return;

  if (!constraints.allowedValues.includes(value)) {
    const displayValues = constraints.allowedValues.slice(0, 5).join(", ");
    const suffix = constraints.allowedValues.length > 5 ? "..." : "";

    aggregator.addIssue(
      rowIndex,
      column,
      value,
      "enum-violation",
      `Value '${value}' is not in allowed values: ${displayValues}${suffix}`,
      `Use one of: ${displayValues}`
    );
  }
}

/**
 * Validate constraints for all rows
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column definitions with constraints
 * @param {Object} config - Validation config
 * @returns {Array} Constraint validation issues
 */
export function validateConstraints(rows, headers, columnTypes, config) {
  const maxIssues = config.maxIssuesPerType || 100;
  const aggregator = createIssueAggregator(maxIssues);

  rows.forEach((row, rowIndex) => {
    headers.forEach((header) => {
      const value = row[header];
      const colDef = columnTypes[header];

      if (!colDef || !colDef.constraints) return;
      if (value === null || value === undefined || value === "") return;

      const constraints = colDef.constraints;

      // Run validators in sequence
      validateMinMax(value, header, rowIndex, constraints, aggregator);
      validateLength(value, header, rowIndex, constraints, aggregator);
      validatePattern(value, header, rowIndex, constraints, aggregator);
      validateEnum(value, header, rowIndex, constraints, aggregator);
    });
  });

  return aggregator.getIssues();
}
