/**
 * Edge Case Handler
 * Handles all edge cases for robust data validation
 */

/**
 * Create validation collector helper for error/warning management
 * @returns {Object} Collector with addError, addWarning, and getResult methods
 */
function createValidationCollector() {
  const errors = [];
  const warnings = [];
  return {
    addError(message) {
      errors.push(message);
    },
    addWarning(message) {
      warnings.push(message);
    },
    getResult() {
      return { isValid: errors.length === 0, errors, warnings };
    },
  };
}

/**
 * Validate data source presence
 * @param {Object} input - Input configuration
 * @param {Object} collector - Validation collector
 * @returns {{hasUrl: boolean, hasInline: boolean, hasBase64: boolean}}
 */
function validateDataSource(input, collector) {
  // Check for string type before calling .trim() and convert to explicit boolean
  const hasUrl = !!(
    typeof input.dataSourceUrl === "string" && input.dataSourceUrl.trim()
  );
  const hasInline = !!(
    typeof input.dataSourceInline === "string" && input.dataSourceInline.trim()
  );
  const hasBase64 = !!(
    typeof input.dataSourceBase64 === "string" && input.dataSourceBase64.trim()
  );

  if (!hasUrl && !hasInline && !hasBase64) {
    collector.addError(
      "No data source provided. Please provide dataSourceUrl, dataSourceInline, or dataSourceBase64.",
    );
  }

  if ([hasUrl, hasInline, hasBase64].filter(Boolean).length > 1) {
    collector.addWarning(
      "Multiple data sources provided. Only the first valid source will be used (priority: URL > inline > base64).",
    );
  }

  return { hasUrl, hasInline, hasBase64 };
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @param {Object} collector - Validation collector
 */
function validateUrlFormat(url, collector) {
  try {
    new URL(url);
  } catch {
    collector.addError(`Invalid URL format: ${url}`);
  }
}

/**
 * Validate schema structure
 * @param {Array} schemaDefinition - Schema definition array
 * @param {Object} collector - Validation collector
 */
function validateSchemaStructure(schemaDefinition, collector) {
  if (!Array.isArray(schemaDefinition)) {
    collector.addError(
      "schemaDefinition must be an array of column definitions.",
    );
    return;
  }

  schemaDefinition.forEach((col, idx) => {
    if (!col.name) {
      collector.addError(
        `Schema column at index ${idx} is missing 'name' property.`,
      );
    }
    if (col.type && !VALID_TYPES.includes(col.type)) {
      collector.addWarning(
        `Unknown type '${col.type}' for column '${col.name}'. Will use string validation.`,
      );
    }
  });
}

/**
 * Validate numeric thresholds
 * @param {Object} input - Input configuration
 * @param {Object} collector - Validation collector
 */
function validateNumericThresholds(input, collector) {
  if (input.zscoreThreshold !== undefined) {
    const thresh = parseFloat(input.zscoreThreshold);
    if (isNaN(thresh) || thresh < 1 || thresh > 10) {
      collector.addWarning(
        "zscoreThreshold should be between 1 and 10. Using default value of 3.",
      );
    }
  }

  if (input.fuzzySimilarityThreshold !== undefined) {
    const thresh = parseFloat(input.fuzzySimilarityThreshold);
    if (isNaN(thresh) || thresh < 0 || thresh > 1) {
      collector.addWarning(
        "fuzzySimilarityThreshold should be between 0 and 1. Using default value of 0.85.",
      );
    }
  }
}

/**
 * Validate and sanitize input configuration
 * @param {Object} input - Input configuration
 * @returns {{isValid: boolean, errors: Array, warnings: Array}}
 */
export function validateInput(input) {
  const collector = createValidationCollector();

  // Step 1: Validate data source
  const { hasUrl } = validateDataSource(input, collector);

  // Step 2: Validate URL format
  if (hasUrl) {
    validateUrlFormat(input.dataSourceUrl, collector);
  }

  // Step 3: Validate schema structure
  if (input.schemaDefinition) {
    validateSchemaStructure(input.schemaDefinition, collector);
  }

  // Step 4: Validate numeric thresholds
  validateNumericThresholds(input, collector);

  return collector.getResult();
}

const VALID_TYPES = [
  "string",
  "number",
  "integer",
  "date",
  "email",
  "phone",
  "url",
  "boolean",
  "uuid",
  "ip",
  "json",
  "any",
];

/**
 * Handle empty or malformed data gracefully
 */
export function handleEmptyData(rows, headers) {
  if (!rows) {
    return {
      isEmpty: true,
      reason: "No data rows found",
      rows: [],
      headers: [],
    };
  }

  if (!Array.isArray(rows)) {
    return {
      isEmpty: true,
      reason: "Data is not in array format",
      rows: [],
      headers: [],
    };
  }

  if (rows.length === 0) {
    return {
      isEmpty: true,
      reason: "Data array is empty (0 rows)",
      rows: [],
      headers: headers || [],
    };
  }

  if (!headers || headers.length === 0) {
    // Try to extract headers from first row
    const firstRow = rows[0];
    if (typeof firstRow === "object" && firstRow !== null) {
      headers = Object.keys(firstRow);
    }
  }

  return {
    isEmpty: false,
    rows,
    headers,
  };
}

/**
 * Safely parse values with type coercion
 */
export function safeParseValue(value, expectedType) {
  // Handle null/undefined/empty
  if (value === null || value === undefined) {
    return { value: null, isNull: true };
  }

  if (typeof value === "string" && value.trim() === "") {
    return { value: "", isNull: true };
  }

  const trimmed = typeof value === "string" ? value.trim() : value;

  switch (expectedType) {
    case "number":
    case "integer":
      const num = parseFloat(trimmed);
      if (isNaN(num)) {
        return { value: trimmed, parseError: true };
      }
      return { value: num, isNull: false };

    case "boolean":
      const lower = String(trimmed).toLowerCase();
      if (["true", "1", "yes", "y"].includes(lower)) {
        return { value: true, isNull: false };
      }
      if (["false", "0", "no", "n"].includes(lower)) {
        return { value: false, isNull: false };
      }
      return { value: trimmed, parseError: true };

    case "date":
      const date = new Date(trimmed);
      if (isNaN(date.getTime())) {
        return { value: trimmed, parseError: true };
      }
      return { value: date, isNull: false };

    default:
      return { value: String(trimmed), isNull: false };
  }
}

/**
 * Handle encoding issues
 */
export function detectAndFixEncoding(buffer) {
  // Check for BOM markers
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { encoding: "utf-8", hasBom: true, data: buffer.slice(3) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { encoding: "utf-16le", hasBom: true, data: buffer.slice(2) };
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { encoding: "utf-16be", hasBom: true, data: buffer.slice(2) };
  }

  // Check for common encoding issues (replacement characters)
  const sample = buffer
    .slice(0, Math.min(1000, buffer.length))
    .toString("utf-8");
  const hasReplacementChars = sample.includes("�") || sample.includes("?");

  if (hasReplacementChars) {
    // Try Latin-1
    const latin1Sample = buffer.slice(0, 1000).toString("latin1");
    if (!latin1Sample.includes("�")) {
      return { encoding: "latin1", hasBom: false, data: buffer };
    }
  }

  return { encoding: "utf-8", hasBom: false, data: buffer };
}

/**
 * Handle very large numbers (beyond JS precision)
 */
export function handleLargeNumbers(value) {
  if (typeof value !== "string") return value;

  // Check if it's a numeric string
  if (!/^-?\d+(\.\d+)?$/.test(value)) return value;

  const num = parseFloat(value);

  // Check if precision was lost
  if (value.length > 15 && String(num) !== value) {
    return {
      value: num,
      originalString: value,
      precisionLost: true,
    };
  }

  return num;
}

/**
 * Sanitize output to prevent XSS in HTML reports
 */
export function sanitizeForHTML(str) {
  if (typeof str !== "string") return String(str);

  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Handle circular references in JSON
 */
export function safeStringify(obj, space = 2) {
  const seen = new WeakSet();

  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular Reference]";
        }
        seen.add(value);
      }
      // Handle BigInt
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    },
    space,
  );
}

/**
 * Validate file size limits
 */
export function checkFileSizeLimits(sizeBytes, limits = {}) {
  const {
    maxSizeBytes = 100 * 1024 * 1024, // 100MB default
    warnSizeBytes = 50 * 1024 * 1024, // 50MB warning
  } = limits;

  if (sizeBytes > maxSizeBytes) {
    return {
      allowed: false,
      reason: `File size (${formatBytes(
        sizeBytes,
      )}) exceeds maximum allowed (${formatBytes(maxSizeBytes)})`,
    };
  }

  if (sizeBytes > warnSizeBytes) {
    return {
      allowed: true,
      warning: `Large file (${formatBytes(
        sizeBytes,
      )}). Processing may take longer.`,
    };
  }

  return { allowed: true };
}

function formatBytes(bytes) {
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export { VALID_TYPES };
