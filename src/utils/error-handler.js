/**
 * Centralized Error Handler
 * Provides comprehensive error handling with categorization,
 * user-friendly messages, and recovery suggestions
 */

/**
 * Error categories for classification
 */
export const ErrorCategory = {
  INPUT: "INPUT_ERROR",
  PARSING: "PARSING_ERROR",
  VALIDATION: "VALIDATION_ERROR",
  NETWORK: "NETWORK_ERROR",
  MEMORY: "MEMORY_ERROR",
  TIMEOUT: "TIMEOUT_ERROR",
  PERMISSION: "PERMISSION_ERROR",
  INTERNAL: "INTERNAL_ERROR",
  CONFIGURATION: "CONFIGURATION_ERROR",
};

/**
 * Custom error class with enhanced metadata
 */
export class DataQualityError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "DataQualityError";
    this.category = options.category || ErrorCategory.INTERNAL;
    this.code = options.code || "UNKNOWN_ERROR";
    this.suggestion = options.suggestion || null;
    this.details = options.details || null;
    this.recoverable = options.recoverable !== false;
    this.retryable = options.retryable || false;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DataQualityError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      code: this.code,
      suggestion: this.suggestion,
      details: this.details,
      recoverable: this.recoverable,
      retryable: this.retryable,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Error factory functions for common error types
 */
export const Errors = {
  // Input Errors
  noDataSource: () =>
    new DataQualityError(
      "No data source provided. Please provide dataSourceUrl, dataSourceInline, or dataSourceBase64.",
      {
        category: ErrorCategory.INPUT,
        code: "E1001_NO_DATA_SOURCE",
        suggestion:
          "Add a data source using one of the available input methods",
        recoverable: true,
      },
    ),

  invalidUrl: (url) =>
    new DataQualityError(`Invalid URL format: ${url}`, {
      category: ErrorCategory.INPUT,
      code: "E1002_INVALID_URL",
      suggestion:
        "Ensure the URL is properly formatted (e.g., https://example.com/file.csv)",
      details: { url },
      recoverable: true,
    }),

  invalidBase64: (error) =>
    new DataQualityError(
      "Failed to decode base64 data. The input appears to be corrupted.",
      {
        category: ErrorCategory.INPUT,
        code: "E1003_INVALID_BASE64",
        suggestion: "Verify the base64 encoding is correct and complete",
        details: { originalError: error?.message },
        recoverable: true,
      },
    ),

  emptyData: () =>
    new DataQualityError(
      "The data source contains no rows. The file may be empty or header-only.",
      {
        category: ErrorCategory.INPUT,
        code: "E1004_EMPTY_DATA",
        suggestion: "Verify the file contains data rows beyond the header",
        recoverable: true,
      },
    ),

  // Parsing Errors
  csvParseError: (error, row) =>
    new DataQualityError(
      `Failed to parse CSV at row ${row || "unknown"}: ${
        error?.message || error
      }`,
      {
        category: ErrorCategory.PARSING,
        code: "E2001_CSV_PARSE_ERROR",
        suggestion:
          "Check for malformed CSV syntax, unescaped quotes, or encoding issues",
        details: { row, originalError: error?.message },
        recoverable: false,
      },
    ),

  excelParseError: (error) =>
    new DataQualityError(
      `Failed to parse Excel file: ${error?.message || error}`,
      {
        category: ErrorCategory.PARSING,
        code: "E2002_EXCEL_PARSE_ERROR",
        suggestion:
          "Ensure the file is a valid .xlsx or .xls format and not password-protected",
        details: { originalError: error?.message },
        recoverable: false,
      },
    ),

  jsonParseError: (error) =>
    new DataQualityError(`Failed to parse JSON: ${error?.message || error}`, {
      category: ErrorCategory.PARSING,
      code: "E2003_JSON_PARSE_ERROR",
      suggestion: "Validate JSON syntax using a JSON validator",
      details: { originalError: error?.message },
      recoverable: false,
    }),

  unsupportedFormat: (format) =>
    new DataQualityError(`Unsupported file format: ${format}`, {
      category: ErrorCategory.PARSING,
      code: "E2004_UNSUPPORTED_FORMAT",
      suggestion: "Supported formats are: csv, xlsx, xls, json, jsonl",
      details: { format },
      recoverable: true,
    }),

  encodingError: (encoding, error) =>
    new DataQualityError(`Failed to decode file with encoding '${encoding}'`, {
      category: ErrorCategory.PARSING,
      code: "E2005_ENCODING_ERROR",
      suggestion:
        "Try a different encoding (utf-8, latin1, utf-16) or use auto-detection",
      details: { encoding, originalError: error?.message },
      recoverable: true,
    }),

  // Network Errors
  fetchFailed: (url, status, statusText) =>
    new DataQualityError(
      `Failed to fetch data from URL: ${status} ${statusText}`,
      {
        category: ErrorCategory.NETWORK,
        code: "E3001_FETCH_FAILED",
        suggestion:
          status === 404
            ? "Verify the URL exists and is publicly accessible"
            : status === 403
              ? "The resource requires authentication or is access-restricted"
              : "Check network connectivity and try again",
        details: { url: url.substring(0, 100), status, statusText },
        retryable: status >= 500,
        recoverable: false,
      },
    ),

  timeout: (url, timeoutMs) =>
    new DataQualityError(`Request timed out after ${timeoutMs}ms`, {
      category: ErrorCategory.TIMEOUT,
      code: "E3002_TIMEOUT",
      suggestion:
        "The file may be too large or the server is slow. Try using sampleSize or a different source.",
      details: { url: url?.substring(0, 100), timeoutMs },
      retryable: true,
      recoverable: false,
    }),

  networkError: (error) =>
    new DataQualityError(`Network error: ${error?.message || error}`, {
      category: ErrorCategory.NETWORK,
      code: "E3003_NETWORK_ERROR",
      suggestion: "Check network connectivity and firewall settings",
      details: { originalError: error?.message },
      retryable: true,
      recoverable: false,
    }),

  // Validation Errors
  schemaInvalid: (column, issue) =>
    new DataQualityError(
      `Invalid schema definition for column '${column}': ${issue}`,
      {
        category: ErrorCategory.CONFIGURATION,
        code: "E4001_SCHEMA_INVALID",
        suggestion: "Review the schemaDefinition format in the input",
        details: { column, issue },
        recoverable: true,
      },
    ),

  columnNotFound: (column, availableColumns) =>
    new DataQualityError(`Column '${column}' not found in data`, {
      category: ErrorCategory.VALIDATION,
      code: "E4002_COLUMN_NOT_FOUND",
      suggestion: `Available columns: ${availableColumns
        .slice(0, 10)
        .join(", ")}`,
      details: { column, availableColumns: availableColumns.slice(0, 20) },
      recoverable: true,
    }),

  // Memory Errors
  memoryExhausted: (usedMB, limitMB) =>
    new DataQualityError(
      `Memory limit exceeded: ${usedMB}MB used of ${limitMB}MB limit`,
      {
        category: ErrorCategory.MEMORY,
        code: "E5001_MEMORY_EXHAUSTED",
        suggestion:
          "Use the sampleSize option to process a subset of data, or split the file into smaller parts",
        details: { usedMB, limitMB },
        recoverable: false,
      },
    ),

  fileTooLarge: (sizeMB, maxSizeMB) =>
    new DataQualityError(
      `File size (${sizeMB}MB) exceeds maximum allowed (${maxSizeMB}MB)`,
      {
        category: ErrorCategory.INPUT,
        code: "E5002_FILE_TOO_LARGE",
        suggestion:
          "Split the file into smaller parts or use sampleSize option",
        details: { sizeMB, maxSizeMB },
        recoverable: true,
      },
    ),

  // Internal Errors
  internal: (error) =>
    new DataQualityError(`Internal error: ${error?.message || error}`, {
      category: ErrorCategory.INTERNAL,
      code: "E9001_INTERNAL_ERROR",
      suggestion: "Please report this issue with the error details",
      details: { originalError: error?.message, stack: error?.stack },
      recoverable: false,
    }),
};

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling(fn, options = {}) {
  const { context = "unknown", onError = null } = options;

  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      // If already a DataQualityError, re-throw
      if (error instanceof DataQualityError) {
        throw error;
      }

      // Classify and wrap the error
      const wrappedError = classifyError(error, context);

      if (onError) {
        await onError(wrappedError);
      }

      throw wrappedError;
    }
  };
}

/**
 * Classify a generic error into a DataQualityError
 */
export function classifyError(error, context = "unknown") {
  const message = error?.message || String(error);
  const lowerMessage = message.toLowerCase();

  // Network errors
  if (lowerMessage.includes("enotfound") || lowerMessage.includes("dns")) {
    return Errors.networkError(error);
  }
  if (lowerMessage.includes("timeout") || lowerMessage.includes("etimedout")) {
    return Errors.timeout(context, 30000);
  }
  if (
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("econnreset")
  ) {
    return Errors.networkError(error);
  }

  // Memory errors
  if (lowerMessage.includes("heap") || lowerMessage.includes("memory")) {
    return Errors.memoryExhausted(0, 0);
  }

  // Parsing errors
  if (lowerMessage.includes("json") && lowerMessage.includes("parse")) {
    return Errors.jsonParseError(error);
  }
  if (lowerMessage.includes("csv")) {
    return Errors.csvParseError(error, null);
  }

  // Default to internal error
  return Errors.internal(error);
}

/**
 * Safe execution wrapper that returns result or error
 */
export async function safeExecute(fn, defaultValue = null) {
  try {
    return { success: true, result: await fn() };
  } catch (error) {
    return {
      success: false,
      error: error instanceof DataQualityError ? error : classifyError(error),
      result: defaultValue,
    };
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff(fn, options = {}) {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 10000 } = options;

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (error instanceof DataQualityError && !error.retryable) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        console.log(`   Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Format error for user display
 */
export function formatErrorForUser(error) {
  if (error instanceof DataQualityError) {
    let message = `❌ ${error.message}`;
    if (error.suggestion) {
      message += `\n💡 Suggestion: ${error.suggestion}`;
    }
    if (error.code) {
      message += `\n🔢 Error Code: ${error.code}`;
    }
    return message;
  }
  return `❌ ${error?.message || String(error)}`;
}

/**
 * Format error for logging/storage
 */
export function formatErrorForLog(error) {
  if (error instanceof DataQualityError) {
    return error.toJSON();
  }
  return {
    name: error?.name || "Error",
    message: error?.message || String(error),
    stack: error?.stack,
    timestamp: new Date().toISOString(),
  };
}
