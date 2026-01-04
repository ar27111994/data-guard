/**
 * Type Validator
 * Validates data types and auto-detects column types
 */

/**
 * Type validation functions
 */
export const TYPE_VALIDATORS = {
  string: (v) => typeof v === "string" || v === null || v === undefined,

  number: (v) => {
    if (v === null || v === undefined || v === "") return true;
    return !isNaN(parseFloat(v)) && isFinite(v);
  },

  integer: (v) => {
    if (v === null || v === undefined || v === "") return true;
    const num = Number(v);
    return Number.isInteger(num);
  },

  date: (v) => {
    if (v === null || v === undefined || v === "") return true;
    const date = new Date(v);
    return !isNaN(date.getTime());
  },

  email: (v) => {
    if (v === null || v === undefined || v === "") return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v));
  },

  phone: (v) => {
    if (v === null || v === undefined || v === "") return true;
    return /^\+?[\d\s\-()]{7,}$/.test(String(v));
  },

  url: (v) => {
    if (v === null || v === undefined || v === "") return true;
    try {
      new URL(String(v));
      return true;
    } catch {
      return false;
    }
  },

  boolean: (v) => {
    if (v === null || v === undefined || v === "") return true;
    const lower = String(v).toLowerCase();
    return ["true", "false", "0", "1", "yes", "no"].includes(lower);
  },

  uuid: (v) => {
    if (v === null || v === undefined || v === "") return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(v)
    );
  },

  ip: (v) => {
    if (v === null || v === undefined || v === "") return true;
    // IPv4
    const ipv4 =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    // IPv6 simplified
    const ipv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4.test(String(v)) || ipv6.test(String(v));
  },

  json: (v) => {
    if (v === null || v === undefined || v === "") return true;
    try {
      JSON.parse(String(v));
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Validate types for all rows
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @param {Object} config - Validation config
 * @returns {Array} Type validation issues
 */
export function validateTypes(rows, headers, columnTypes, config) {
  const issues = [];
  const maxIssues = config.maxIssuesPerType || 100;
  const issueCountByType = {};

  rows.forEach((row, rowIndex) => {
    headers.forEach((header) => {
      const value = row[header];
      const colDef = columnTypes[header];

      if (!colDef) return;

      // Check for null/missing values
      if (value === null || value === undefined || value === "") {
        if (config.checkMissingValues) {
          const issueType = colDef.required ? "missing" : "null";
          issueCountByType[issueType] = (issueCountByType[issueType] || 0) + 1;

          if (issueCountByType[issueType] <= maxIssues) {
            issues.push({
              rowNumber: rowIndex + 1,
              column: header,
              value: String(value),
              issueType,
              severity: colDef.required ? "error" : "warning",
              message: colDef.required
                ? `Required field '${header}' is missing`
                : `Field '${header}' has null/empty value`,
              suggestion: "Provide a valid value for this field",
            });
          }
        }
        return;
      }

      // Type validation
      const typeValidator = TYPE_VALIDATORS[colDef.type];
      if (typeValidator && !typeValidator(value)) {
        issueCountByType["type-mismatch"] =
          (issueCountByType["type-mismatch"] || 0) + 1;

        if (issueCountByType["type-mismatch"] <= maxIssues) {
          issues.push({
            rowNumber: rowIndex + 1,
            column: header,
            value: String(value).substring(0, 100),
            issueType: "type-mismatch",
            severity: "error",
            message: `Value '${String(value).substring(
              0,
              50
            )}' is not a valid ${colDef.type}`,
            suggestion: getTypeSuggestion(colDef.type, value),
          });
        }
      }
    });
  });

  return issues;
}

/**
 * Get suggestion for fixing type error
 */
function getTypeSuggestion(type, value) {
  const suggestions = {
    number: "Ensure the value contains only numeric characters",
    integer: "Ensure the value is a whole number without decimals",
    date: "Use a standard date format like YYYY-MM-DD or MM/DD/YYYY",
    email: "Format should be example@domain.com",
    phone: "Include country code, e.g., +1-555-123-4567",
    url: "Include protocol, e.g., https://example.com",
    boolean: "Use true/false, yes/no, or 1/0",
    uuid: "Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    ip: "Use IPv4 (192.168.1.1) or IPv6 format",
    json: "Ensure valid JSON syntax with proper quotes and brackets",
  };
  return suggestions[type] || "Check the value format";
}

/**
 * Auto-detect column types from data
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @returns {Object} Detected column types
 */
export function detectColumnTypes(rows, headers) {
  const columnTypes = {};
  const sampleSize = Math.min(rows.length, 100); // Sample first 100 rows
  const sample = rows.slice(0, sampleSize);

  headers.forEach((header) => {
    const values = sample
      .map((row) => row[header])
      .filter((v) => v !== null && v !== undefined && v !== "");

    if (values.length === 0) {
      columnTypes[header] = { name: header, type: "string" };
      return;
    }

    const detectedType = inferType(values);
    columnTypes[header] = { name: header, type: detectedType };
  });

  return columnTypes;
}

/**
 * Infer type from array of values
 */
function inferType(values) {
  // Test in order of specificity
  const typeTests = [
    {
      type: "email",
      test: (v) => TYPE_VALIDATORS.email(v) && String(v).includes("@"),
    },
    {
      type: "url",
      test: (v) => TYPE_VALIDATORS.url(v) && String(v).startsWith("http"),
    },
    {
      type: "uuid",
      test: (v) => TYPE_VALIDATORS.uuid(v) && String(v).length === 36,
    },
    {
      type: "boolean",
      test: (v) =>
        ["true", "false", "yes", "no", "0", "1"].includes(
          String(v).toLowerCase()
        ),
    },
    {
      type: "integer",
      test: (v) => TYPE_VALIDATORS.integer(v) && !String(v).includes("."),
    },
    { type: "number", test: (v) => TYPE_VALIDATORS.number(v) },
    { type: "date", test: (v) => TYPE_VALIDATORS.date(v) && isLikelyDate(v) },
  ];

  for (const { type, test } of typeTests) {
    const matchRate = values.filter(test).length / values.length;
    if (matchRate >= 0.9) {
      // 90% threshold
      return type;
    }
  }

  return "string";
}

/**
 * Check if value looks like a date
 */
function isLikelyDate(value) {
  const str = String(value);
  // Common date patterns
  return (
    /^\d{4}-\d{2}-\d{2}/.test(str) || // ISO format
    /^\d{2}\/\d{2}\/\d{4}/.test(str) || // US format
    /^\d{2}\.\d{2}\.\d{4}/.test(str) // EU format
  );
}
