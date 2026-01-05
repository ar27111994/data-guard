/**
 * Error Handler Tests
 * Tests error classification, retry logic, and user-friendly messages
 */
import {
  DataQualityError,
  Errors,
  ErrorCategory,
  formatErrorForUser,
  formatErrorForLog,
  classifyError,
  retryWithBackoff,
  safeExecute,
  withErrorHandling,
} from "../src/utils/error-handler.js";

describe("Error Handler", () => {
  describe("DataQualityError", () => {
    test("creates error with all properties", () => {
      const error = new DataQualityError("Test error", {
        category: ErrorCategory.INPUT,
        code: "E_TEST",
        suggestion: "Try this instead",
        details: { key: "value" },
        recoverable: true,
        retryable: false,
      });

      expect(error.message).toBe("Test error");
      expect(error.category).toBe(ErrorCategory.INPUT);
      expect(error.code).toBe("E_TEST");
      expect(error.suggestion).toBe("Try this instead");
      expect(error.details.key).toBe("value");
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(false);
      expect(error.timestamp).toBeDefined();
    });

    test("serializes to JSON correctly", () => {
      const error = new DataQualityError("Test", {
        code: "E001",
        suggestion: "Fix it",
      });

      const json = error.toJSON();
      expect(json.name).toBe("DataQualityError");
      expect(json.message).toBe("Test");
      expect(json.code).toBe("E001");
      expect(json.stack).toBeDefined();
    });

    test("has correct default values", () => {
      const error = new DataQualityError("Simple error");

      expect(error.category).toBe(ErrorCategory.INTERNAL);
      expect(error.code).toBe("UNKNOWN_ERROR");
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(false);
    });
  });

  describe("Error Factory", () => {
    test("creates noDataSource error", () => {
      const error = Errors.noDataSource();
      expect(error.code).toBe("E1001_NO_DATA_SOURCE");
      expect(error.category).toBe(ErrorCategory.INPUT);
      expect(error.suggestion).toContain("data source");
    });

    test("creates invalidUrl error", () => {
      const error = Errors.invalidUrl("bad-url");
      expect(error.code).toBe("E1002_INVALID_URL");
      expect(error.details.url).toBe("bad-url");
    });

    test("creates fetchFailed error with status", () => {
      const error = Errors.fetchFailed("https://example.com", 404, "Not Found");
      expect(error.code).toBe("E3001_FETCH_FAILED");
      expect(error.details.status).toBe(404);
      expect(error.retryable).toBe(false);
    });

    test("creates retryable error for 5xx status", () => {
      const error = Errors.fetchFailed(
        "https://example.com",
        503,
        "Service Unavailable",
      );
      expect(error.retryable).toBe(true);
    });

    test("creates timeout error", () => {
      const error = Errors.timeout("https://example.com", 30000);
      expect(error.code).toBe("E3002_TIMEOUT");
      expect(error.retryable).toBe(true);
    });

    test("creates csvParseError with row info", () => {
      const error = Errors.csvParseError(new Error("Parse failed"), 42);
      expect(error.code).toBe("E2001_CSV_PARSE_ERROR");
      expect(error.details.row).toBe(42);
    });

    test("creates memoryExhausted error", () => {
      const error = Errors.memoryExhausted(500, 400);
      expect(error.code).toBe("E5001_MEMORY_EXHAUSTED");
      expect(error.recoverable).toBe(false);
      expect(error.suggestion).toContain("sampleSize");
    });
  });

  describe("Error Classification", () => {
    test("classifies network errors", () => {
      const error = classifyError(new Error("ENOTFOUND"));
      expect(error.category).toBe(ErrorCategory.NETWORK);
    });

    test("classifies timeout errors", () => {
      const error = classifyError(new Error("ETIMEDOUT"));
      expect(error.category).toBe(ErrorCategory.TIMEOUT);
    });

    test("classifies memory errors", () => {
      const error = classifyError(new Error("heap out of memory"));
      expect(error.category).toBe(ErrorCategory.MEMORY);
    });

    test("classifies JSON errors", () => {
      const error = classifyError(new Error("JSON.parse: unexpected token"));
      expect(error.category).toBe(ErrorCategory.PARSING);
    });

    test("defaults to internal error", () => {
      const error = classifyError(new Error("Unknown issue"));
      expect(error.category).toBe(ErrorCategory.INTERNAL);
    });
  });

  describe("Error Formatting", () => {
    test("formats DataQualityError for users", () => {
      const error = new DataQualityError("URL is invalid", {
        code: "E1002",
        suggestion: "Check the URL format",
      });

      const formatted = formatErrorForUser(error);
      expect(formatted).toContain("URL is invalid");
      expect(formatted).toContain("Suggestion");
      expect(formatted).toContain("E1002");
    });

    test("formats generic error for users", () => {
      const formatted = formatErrorForUser(new Error("Something broke"));
      expect(formatted).toContain("Something broke");
    });

    test("formats error for logging", () => {
      const error = new DataQualityError("Test", { code: "E001" });
      const logEntry = formatErrorForLog(error);

      expect(logEntry.name).toBe("DataQualityError");
      expect(logEntry.code).toBe("E001");
      expect(logEntry.timestamp).toBeDefined();
    });
  });

  describe("Retry Logic", () => {
    test("succeeds on first try", async () => {
      let attempts = 0;
      const result = await retryWithBackoff(async () => {
        attempts++;
        return "success";
      });

      expect(result).toBe("success");
      expect(attempts).toBe(1);
    });

    test("retries on failure", async () => {
      let attempts = 0;
      const result = await retryWithBackoff(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error("Temporary failure");
          }
          return "success";
        },
        { maxRetries: 3, baseDelayMs: 10 },
      );

      expect(result).toBe("success");
      expect(attempts).toBe(3);
    });

    test("throws after max retries", async () => {
      let attempts = 0;

      await expect(
        retryWithBackoff(
          async () => {
            attempts++;
            throw new Error("Always fails");
          },
          { maxRetries: 3, baseDelayMs: 10 },
        ),
      ).rejects.toThrow("Always fails");

      expect(attempts).toBe(3);
    });

    test("does not retry non-retryable errors", async () => {
      let attempts = 0;

      await expect(
        retryWithBackoff(
          async () => {
            attempts++;
            throw new DataQualityError("Not retryable", { retryable: false });
          },
          { maxRetries: 3, baseDelayMs: 10 },
        ),
      ).rejects.toThrow();

      expect(attempts).toBe(1);
    });
  });

  describe("Safe Execution", () => {
    test("returns success for successful execution", async () => {
      const result = await safeExecute(async () => "data");

      expect(result.success).toBe(true);
      expect(result.result).toBe("data");
      expect(result.error).toBeUndefined();
    });

    test("returns error for failed execution", async () => {
      const result = await safeExecute(async () => {
        throw new Error("Failed");
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("returns default value on error", async () => {
      const result = await safeExecute(async () => {
        throw new Error("Failed");
      }, "default");

      expect(result.result).toBe("default");
    });
  });

  describe("Error Handling Wrapper", () => {
    test("wraps function with error handling", async () => {
      const fn = async (x) => x * 2;
      const wrapped = withErrorHandling(fn);

      const result = await wrapped(5);
      expect(result).toBe(10);
    });

    test("catches and wraps errors", async () => {
      const fn = async () => {
        throw new Error("Original error");
      };
      const wrapped = withErrorHandling(fn, { context: "test" });

      await expect(wrapped()).rejects.toBeInstanceOf(DataQualityError);
    });

    test("passes through DataQualityError", async () => {
      const originalError = new DataQualityError("Already wrapped", {
        code: "E001",
      });
      const fn = async () => {
        throw originalError;
      };
      const wrapped = withErrorHandling(fn);

      await expect(wrapped()).rejects.toBe(originalError);
    });

    test("calls onError callback", async () => {
      let capturedError = null;
      const fn = async () => {
        throw new Error("Test");
      };
      const wrapped = withErrorHandling(fn, {
        onError: (err) => {
          capturedError = err;
        },
      });

      await expect(wrapped()).rejects.toThrow();
      expect(capturedError).toBeDefined();
    });
  });
});
