/**
 * Constraint Validator
 * Validates field constraints: required, min, max, pattern, allowedValues
 */

/**
 * Validate constraints for all rows
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column definitions with constraints
 * @param {Object} config - Validation config
 * @returns {Array} Constraint validation issues
 */
export function validateConstraints(rows, headers, columnTypes, config) {
  const issues = [];
  const maxIssues = config.maxIssuesPerType || 100;
  const issueCountByConstraint = {};

  rows.forEach((row, rowIndex) => {
    headers.forEach((header) => {
      const value = row[header];
      const colDef = columnTypes[header];

      if (!colDef || !colDef.constraints) return;
      if (value === null || value === undefined || value === "") return;

      const constraints = colDef.constraints;

      // Min value (for numbers)
      if (constraints.min !== undefined) {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue < constraints.min) {
          addIssue(
            "range-violation",
            `Value ${numValue} is below minimum ${constraints.min}`,
            `Ensure value is at least ${constraints.min}`
          );
        }
      }

      // Max value (for numbers)
      if (constraints.max !== undefined) {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > constraints.max) {
          addIssue(
            "range-violation",
            `Value ${numValue} exceeds maximum ${constraints.max}`,
            `Ensure value is at most ${constraints.max}`
          );
        }
      }

      // Min length (for strings)
      if (constraints.minLength !== undefined) {
        if (String(value).length < constraints.minLength) {
          addIssue(
            "length-violation",
            `Value length ${String(value).length} is below minimum ${
              constraints.minLength
            }`,
            `Provide at least ${constraints.minLength} characters`
          );
        }
      }

      // Max length (for strings)
      if (constraints.maxLength !== undefined) {
        if (String(value).length > constraints.maxLength) {
          addIssue(
            "length-violation",
            `Value length ${String(value).length} exceeds maximum ${
              constraints.maxLength
            }`,
            `Limit to ${constraints.maxLength} characters`
          );
        }
      }

      // Pattern (regex)
      if (constraints.pattern) {
        try {
          const regex = new RegExp(constraints.pattern);
          if (!regex.test(String(value))) {
            addIssue(
              "pattern-violation",
              `Value does not match required pattern: ${constraints.pattern}`,
              "Ensure value matches the expected format"
            );
          }
        } catch (e) {
          console.warn(
            `Invalid regex pattern for ${header}: ${constraints.pattern}`
          );
        }
      }

      // Allowed values (enum)
      if (
        constraints.allowedValues &&
        Array.isArray(constraints.allowedValues)
      ) {
        if (!constraints.allowedValues.includes(value)) {
          addIssue(
            "enum-violation",
            `Value '${value}' is not in allowed values: ${constraints.allowedValues
              .slice(0, 5)
              .join(", ")}${constraints.allowedValues.length > 5 ? "..." : ""}`,
            `Use one of: ${constraints.allowedValues.slice(0, 5).join(", ")}`
          );
        }
      }

      function addIssue(issueType, message, suggestion) {
        issueCountByConstraint[issueType] =
          (issueCountByConstraint[issueType] || 0) + 1;

        if (issueCountByConstraint[issueType] <= maxIssues) {
          issues.push({
            rowNumber: rowIndex + 1,
            column: header,
            value: String(value).substring(0, 100),
            issueType,
            severity: "error",
            message,
            suggestion,
          });
        }
      }
    });
  });

  return issues;
}
