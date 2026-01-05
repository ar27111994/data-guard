import { assessCsvErrors } from "../src/parsers/data-source.js";

describe("assessCsvErrors", () => {
  test("returns no critical errors for empty errors array", () => {
    const result = assessCsvErrors([], 100);
    expect(result.criticalErrors).toEqual([]);
    expect(result.hasFatalErrors).toBe(false);
  });

  test("identifies critical error types (Quotes, FieldMismatch)", () => {
    const errors = [
      { type: "Quotes", message: "Quote error" },
      { type: "FieldMismatch", message: "Mismatch error" },
      { type: "Delimiter", message: "Delimiter error" }, // Non-critical
    ];
    const result = assessCsvErrors(errors, 100);
    expect(result.criticalErrors).toHaveLength(2);
    expect(result.criticalErrors.map((e) => e.type)).toEqual(
      expect.arrayContaining(["Quotes", "FieldMismatch"])
    );
  });

  test("does not trigger fatal error if critical errors are below threshold", () => {
    // 10 rows, 1 critical error. Threshold is max(1, 10 * 0.5) = 5.
    const errors = [{ type: "Quotes", message: "Quote error" }];
    const result = assessCsvErrors(errors, 10);
    expect(result.hasFatalErrors).toBe(false);
  });

  test("triggers fatal error if critical errors exceed 50% threshold", () => {
    // 10 rows, 6 critical errors. Threshold is 5.
    const errors = Array(6).fill({
      type: "FieldMismatch",
      message: "Mismatch",
    });
    const result = assessCsvErrors(errors, 10);
    expect(result.hasFatalErrors).toBe(true);
  });

  test("triggers fatal error if any critical error exists with 0 rows (failed parse)", () => {
    const errors = [{ type: "Quotes", message: "Fatal parse error" }];
    const result = assessCsvErrors(errors, 0); // 0 rows parsed
    expect(result.hasFatalErrors).toBe(true);
  });

  test("handles edge case: small dataset (1 row)", () => {
    // 1 row, 1 critical error. Threshold is max(1, 1 * 0.5) = 1.
    // criticalErrors.length (1) is NOT > 1, so NOT fatal.
    // Wait, let's check logic: criticalErrors.length (1) > 1 (false)
    const errors = [{ type: "Quotes", message: "Error" }];
    const result = assessCsvErrors(errors, 1);
    expect(result.hasFatalErrors).toBe(false);

    // 1 row, 2 critical errors. Threshold is 1. 2 > 1 => fatal.
    const errors2 = [
      { type: "Quotes", message: "E1" },
      { type: "Quotes", message: "E2" },
    ];
    const result2 = assessCsvErrors(errors2, 1);
    expect(result2.hasFatalErrors).toBe(true);
  });
});
