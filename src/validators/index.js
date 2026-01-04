/**
 * Validators Index
 * Central export for all validation modules
 * With comprehensive error handling
 */
import { validateTypes, detectColumnTypes } from "./type-validator.js";
import { validateConstraints } from "./constraint-validator.js";
import { detectDuplicates } from "./duplicate-detector.js";
import { detectOutliers } from "./outlier-detector.js";
import { DataQualityError, Errors } from "../utils/error-handler.js";

/**
 * Main validation orchestrator
 * @param {Array} rows - Data rows to validate
 * @param {Array} headers - Column headers
 * @param {Object} config - Validation configuration
 * @returns {Object} Validation results
 */
export async function validateData(rows, headers, config) {
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
    // Validate inputs
    if (!Array.isArray(rows)) {
      throw Errors.internal(new Error("rows must be an array"));
    }
    if (!Array.isArray(headers)) {
      throw Errors.internal(new Error("headers must be an array"));
    }

    // Handle empty data gracefully
    if (rows.length === 0) {
      return {
        issues: [],
        issueBreakdown,
        invalidRowCount: 0,
        columnTypes: {},
        warnings: ["No data rows to validate"],
      };
    }

    // Step 1: Auto-detect column types if no schema provided
    let columnTypes = {};
    try {
      if (config.schemaDefinition && config.schemaDefinition.length > 0) {
        // Use provided schema - validate it first
        config.schemaDefinition.forEach((col, idx) => {
          if (!col.name) {
            warnings.push(
              `Schema column at index ${idx} missing 'name' property, skipped`
            );
            return;
          }

          // Validate column exists in data (warn if not)
          if (!headers.includes(col.name)) {
            warnings.push(
              `Schema column '${col.name}' not found in data headers`
            );
          }

          columnTypes[col.name] = col;
        });
      } else if (config.autoDetectTypes !== false) {
        // Auto-detect types
        columnTypes = detectColumnTypes(rows, headers);
        console.log(
          `   Auto-detected types for ${
            Object.keys(columnTypes).length
          } columns`
        );
      }
    } catch (error) {
      warnings.push(`Type detection partially failed: ${error.message}`);
      // Continue with empty column types
    }

    // Step 2: Type validation with error handling
    try {
      const typeIssues = validateTypes(rows, headers, columnTypes, config);
      issues.push(...typeIssues);
      issueBreakdown.typeErrors = typeIssues.filter(
        (i) => i.issueType === "type-mismatch"
      ).length;
      issueBreakdown.missingValues = typeIssues.filter(
        (i) => i.issueType === "null" || i.issueType === "missing"
      ).length;
    } catch (error) {
      warnings.push(`Type validation partially failed: ${error.message}`);
    }

    // Step 3: Constraint validation with error handling
    try {
      const constraintIssues = validateConstraints(
        rows,
        headers,
        columnTypes,
        config
      );
      issues.push(...constraintIssues);
      issueBreakdown.constraintViolations = constraintIssues.length;
    } catch (error) {
      warnings.push(`Constraint validation partially failed: ${error.message}`);
    }

    // Step 4: Duplicate detection with error handling
    if (config.checkDuplicates) {
      try {
        // Validate duplicate columns exist
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
        issues.push(...duplicateIssues);
        issueBreakdown.duplicates = duplicateIssues.length;
      } catch (error) {
        warnings.push(`Duplicate detection failed: ${error.message}`);
      }
    }

    // Step 5: Outlier detection with error handling
    if (config.detectOutliers && config.detectOutliers !== "none") {
      try {
        const outlierIssues = detectOutliers(
          rows,
          headers,
          columnTypes,
          config
        );
        issues.push(...outlierIssues);
        issueBreakdown.outliers = outlierIssues.length;
      } catch (error) {
        warnings.push(`Outlier detection failed: ${error.message}`);
      }
    }

    // Step 6: Unique column validation
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

    // Step 7: Enforce max issues limit to prevent memory issues
    const maxIssues = (config.maxIssuesPerType || 100) * 10;
    let truncatedIssues = issues;
    if (issues.length > maxIssues) {
      truncatedIssues = issues.slice(0, maxIssues);
      warnings.push(`Issues truncated from ${issues.length} to ${maxIssues}`);
    }

    // Calculate invalid row count (unique rows with issues)
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

/**
 * Validate unique column constraints
 */
function validateUniqueColumns(rows, uniqueColumns, headers) {
  const issues = [];

  for (const column of uniqueColumns) {
    if (!headers.includes(column)) {
      continue; // Skip missing columns, warning already added
    }

    const seen = new Map();

    rows.forEach((row, idx) => {
      const value = row[column];
      if (value === null || value === undefined || value === "") {
        return; // Skip null values
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

export { validateTypes, detectColumnTypes } from "./type-validator.js";
export { validateConstraints } from "./constraint-validator.js";
export { detectDuplicates } from "./duplicate-detector.js";
export { detectOutliers } from "./outlier-detector.js";
