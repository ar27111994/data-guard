/**
 * Validators Index
 * Central export for all validation modules
 * With comprehensive error handling and stage-based architecture
 */
import { validateTypes, detectColumnTypes } from "./type-validator.js";
import { validateConstraints } from "./constraint-validator.js";
import { detectDuplicates } from "./duplicate-detector.js";
import { detectOutliers } from "./outlier-detector.js";
import { DataQualityError, Errors } from "../utils/error-handler.js";

/**
 * Validate input parameters
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @returns {{isValid: boolean, error: Error|null}}
 */
function validateInputStage(rows, headers) {
  if (!Array.isArray(rows)) {
    return { isValid: false, error: new Error("rows must be an array") };
  }
  if (!Array.isArray(headers)) {
    return { isValid: false, error: new Error("headers must be an array") };
  }
  return { isValid: true, error: null };
}

/**
 * Detect or validate column data types
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} config - Configuration
 * @returns {{columnTypes: Object, warnings: Array}}
 */
function validateDataTypes(rows, headers, config) {
  const warnings = [];
  let columnTypes = {};

  if (config.schemaDefinition && config.schemaDefinition.length > 0) {
    config.schemaDefinition.forEach((col, idx) => {
      if (!col.name) {
        warnings.push(
          `Schema column at index ${idx} missing 'name' property, skipped`
        );
        return;
      }
      if (!headers.includes(col.name)) {
        warnings.push(`Schema column '${col.name}' not found in data headers`);
        return; // Skip assignment for columns not in headers
      }
      columnTypes[col.name] = col;
    });
  } else if (config.autoDetectTypes !== false) {
    columnTypes = detectColumnTypes(rows, headers);
  }

  return { columnTypes, warnings };
}

/**
 * Validate type conformance
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @param {Object} config - Configuration
 * @returns {{issues: Array, typeErrors: number, missingValues: number}}
 */
function validateTypeConformance(rows, headers, columnTypes, config) {
  const typeIssues = validateTypes(rows, headers, columnTypes, config);
  return {
    issues: typeIssues,
    typeErrors: typeIssues.filter((i) => i.issueType === "type-mismatch")
      .length,
    missingValues: typeIssues.filter(
      (i) => i.issueType === "null" || i.issueType === "missing"
    ).length,
  };
}

/**
 * Validate constraints
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @param {Object} config - Configuration
 * @returns {{issues: Array, count: number}}
 */
function validateConstraintsStage(rows, headers, columnTypes, config) {
  const constraintIssues = validateConstraints(
    rows,
    headers,
    columnTypes,
    config
  );
  return { issues: constraintIssues, count: constraintIssues.length };
}

/**
 * Detect duplicates stage
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} config - Configuration
 * @returns {{issues: Array, count: number, warnings: Array}}
 */
function detectDuplicatesStage(rows, headers, config) {
  const warnings = [];

  if (config.duplicateColumns && config.duplicateColumns.length > 0) {
    const missingCols = config.duplicateColumns.filter(
      (c) => !headers.includes(c)
    );
    if (missingCols.length > 0) {
      warnings.push(
        `Duplicate check columns not found: ${missingCols.join(", ")}`
      );
    }
  }

  const duplicateIssues = detectDuplicates(rows, headers, config);
  return { issues: duplicateIssues, count: duplicateIssues.length, warnings };
}

/**
 * Detect outliers stage
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @param {Object} config - Configuration
 * @returns {{issues: Array, count: number}}
 */
function detectOutliersStage(rows, headers, columnTypes, config) {
  const outlierIssues = detectOutliers(rows, headers, columnTypes, config);
  return { issues: outlierIssues, count: outlierIssues.length };
}

/**
 * Validate unique column constraints
 * @param {Array} rows - Data rows
 * @param {Array} uniqueColumns - Columns that must be unique
 * @param {Array} headers - Column headers
 * @returns {Array} Issues found
 */
function validateUniqueColumns(rows, uniqueColumns, headers) {
  const issues = [];

  for (const column of uniqueColumns) {
    if (!headers.includes(column)) {
      continue;
    }

    const seen = new Map();

    rows.forEach((row, idx) => {
      const value = row[column];
      if (value === null || value === undefined || value === "") {
        return;
      }

      const strValue = String(value);
      if (seen.has(strValue)) {
        issues.push({
          type: "issue",
          issueType: "unique-violation",
          severity: "error",
          rowNumber: idx + 1,
          column: column,
          value: strValue.substring(0, 50),
          message: `Duplicate value in unique column. First occurrence at row ${
            seen.get(strValue) + 1
          }`,
          suggestion: "Remove duplicate values or mark column as non-unique",
        });
      } else {
        seen.set(strValue, idx);
      }
    });
  }

  return issues;
}

/**
 * Main validation orchestrator
 * @param {Array} rows - Data rows to validate
 * @param {Array} headers - Column headers
 * @param {Object} config - Validation configuration
 * @returns {Object} Validation results
 */
export function validateData(rows, headers, config) {
  const issues = [];
  const issueBreakdown = {
    typeErrors: 0,
    missingValues: 0,
    constraintViolations: 0,
    duplicates: 0,
    outliers: 0,
  };
  const warnings = [];

  try {
    // Stage 1: Validate inputs
    const inputValidation = validateInputStage(rows, headers);
    if (!inputValidation.isValid) {
      throw Errors.internal(inputValidation.error);
    }

    // Handle empty data
    if (rows.length === 0) {
      return {
        issues: [],
        issueBreakdown,
        invalidRowCount: 0,
        columnTypes: {},
        warnings: ["No data rows to validate"],
      };
    }

    // Stage 2: Detect/validate data types
    let columnTypes = {};
    try {
      const typeResult = validateDataTypes(rows, headers, config);
      columnTypes = typeResult.columnTypes;
      warnings.push(...typeResult.warnings);
    } catch (error) {
      warnings.push(`Type detection partially failed: ${error.message}`);
    }

    // Stage 3: Type conformance validation
    try {
      const typeResult = validateTypeConformance(
        rows,
        headers,
        columnTypes,
        config
      );
      issues.push(...typeResult.issues);
      issueBreakdown.typeErrors = typeResult.typeErrors;
      issueBreakdown.missingValues = typeResult.missingValues;
    } catch (error) {
      warnings.push(`Type validation partially failed: ${error.message}`);
    }

    // Stage 4: Constraint validation
    try {
      const constraintResult = validateConstraintsStage(
        rows,
        headers,
        columnTypes,
        config
      );
      issues.push(...constraintResult.issues);
      issueBreakdown.constraintViolations = constraintResult.count;
    } catch (error) {
      warnings.push(`Constraint validation partially failed: ${error.message}`);
    }

    // Stage 5: Duplicate detection
    if (config.checkDuplicates) {
      try {
        const duplicateResult = detectDuplicatesStage(rows, headers, config);
        issues.push(...duplicateResult.issues);
        issueBreakdown.duplicates = duplicateResult.count;
        warnings.push(...duplicateResult.warnings);
      } catch (error) {
        warnings.push(`Duplicate detection failed: ${error.message}`);
      }
    }

    // Stage 6: Outlier detection
    if (config.detectOutliers && config.detectOutliers !== "none") {
      try {
        const outlierResult = detectOutliersStage(
          rows,
          headers,
          columnTypes,
          config
        );
        issues.push(...outlierResult.issues);
        issueBreakdown.outliers = outlierResult.count;
      } catch (error) {
        warnings.push(`Outlier detection failed: ${error.message}`);
      }
    }

    // Stage 7: Unique column validation
    if (config.uniqueColumns && config.uniqueColumns.length > 0) {
      try {
        const uniqueIssues = validateUniqueColumns(
          rows,
          config.uniqueColumns,
          headers
        );
        issues.push(...uniqueIssues);
        issueBreakdown.constraintViolations += uniqueIssues.length;
      } catch (error) {
        warnings.push(`Unique column validation failed: ${error.message}`);
      }
    }

    // Stage 8: Enforce issue limits
    // Multiplier is configurable via config.issueLimitMultiplier (default: 10)
    const rawMultiplier = Number(config.issueLimitMultiplier);
    const multiplier = Number.isFinite(rawMultiplier)
      ? Math.max(1, Math.floor(rawMultiplier))
      : 10;
    const maxIssues = (config.maxIssuesPerType || 100) * multiplier;
    let truncatedIssues = issues;
    if (issues.length > maxIssues) {
      truncatedIssues = issues.slice(0, maxIssues);
      warnings.push(`Issues truncated from ${issues.length} to ${maxIssues}`);
    }

    // Calculate invalid row count
    const invalidRows = new Set(
      truncatedIssues.map((i) => i.rowNumber).filter(Boolean)
    );

    return {
      issues: truncatedIssues,
      issueBreakdown,
      invalidRowCount: invalidRows.size,
      columnTypes,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    if (error instanceof DataQualityError) {
      throw error;
    }
    throw Errors.internal(error);
  }
}

export { validateTypes, detectColumnTypes } from "./type-validator.js";
export { validateConstraints } from "./constraint-validator.js";
export { detectDuplicates } from "./duplicate-detector.js";
export { detectOutliers } from "./outlier-detector.js";
