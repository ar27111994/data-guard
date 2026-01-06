/**
 * Missing Value Imputation Tests
 */

import {
  IMPUTATION_STRATEGIES,
  isMissing,
  imputeMissingValues,
  analyzeMissingValues,
} from "../src/remediation/imputation.js";

describe("Missing Value Imputation", () => {
  describe("isMissing", () => {
    test("detects null as missing", () => {
      expect(isMissing(null)).toBe(true);
    });

    test("detects undefined as missing", () => {
      expect(isMissing(undefined)).toBe(true);
    });

    test("detects empty string as missing", () => {
      expect(isMissing("")).toBe(true);
      expect(isMissing("  ")).toBe(true);
    });

    test("detects NaN as missing", () => {
      expect(isMissing(NaN)).toBe(true);
    });

    test("valid values are not missing", () => {
      expect(isMissing(0)).toBe(false);
      expect(isMissing("value")).toBe(false);
      expect(isMissing(false)).toBe(false);
    });
  });

  describe("Imputation Strategies", () => {
    const sampleData = [
      { id: 1, value: 10, category: "A" },
      { id: 2, value: null, category: "B" },
      { id: 3, value: 20, category: null },
      { id: 4, value: 30, category: "A" },
      { id: 5, value: null, category: "B" },
    ];
    const headers = ["id", "value", "category"];

    test("mean imputation fills with average", () => {
      const result = imputeMissingValues(sampleData, headers, {
        imputationStrategy: IMPUTATION_STRATEGIES.MEAN,
      });

      // Mean of [10, 20, 30] = 20
      const imputedValues = result.rows.map((r) => r.value);
      expect(imputedValues).toContain(20);
      expect(result.summary.totalImputed).toBeGreaterThan(0);
    });

    test("median imputation fills with median", () => {
      const result = imputeMissingValues(sampleData, headers, {
        imputationStrategy: IMPUTATION_STRATEGIES.MEDIAN,
      });

      // Median of [10, 20, 30] = 20
      const imputedValues = result.rows.map((r) => r.value);
      expect(imputedValues[1]).toBe(20);
    });

    test("mode imputation fills with most frequent", () => {
      const result = imputeMissingValues(sampleData, headers, {
        imputationStrategy: IMPUTATION_STRATEGIES.MODE,
      });

      // Mode of category is "A" (appears twice)
      const imputedCategory = result.rows.find((r) => r.id === 3).category;
      expect(imputedCategory).toBe("A");
    });

    test("forward fill uses previous value", () => {
      const result = imputeMissingValues(sampleData, headers, {
        imputationStrategy: IMPUTATION_STRATEGIES.FORWARD_FILL,
      });

      // Row 2 should have value 10 (from row 1)
      expect(result.rows[1].value).toBe(10);
    });

    test("backward fill uses next value", () => {
      const result = imputeMissingValues(sampleData, headers, {
        imputationStrategy: IMPUTATION_STRATEGIES.BACKWARD_FILL,
      });

      // Row 2 should have value 20 (from row 3)
      expect(result.rows[1].value).toBe(20);
    });

    test("constant imputation uses specified value", () => {
      const result = imputeMissingValues(sampleData, headers, {
        imputationStrategy: IMPUTATION_STRATEGIES.CONSTANT,
        constantValue: 999,
      });

      expect(result.rows[1].value).toBe(999);
    });

    test("remove strategy removes rows with missing", () => {
      const result = imputeMissingValues(sampleData, headers, {
        imputationStrategy: IMPUTATION_STRATEGIES.REMOVE,
      });

      expect(result.rows.length).toBeLessThan(sampleData.length);
    });
  });

  describe("analyzeMissingValues", () => {
    test("counts missing values correctly", () => {
      const data = [
        { a: 1, b: null },
        { a: null, b: 2 },
        { a: 3, b: 3 },
      ];

      const analysis = analyzeMissingValues(data, ["a", "b"]);
      expect(analysis.totalMissingValues).toBe(2);
      expect(analysis.rowsWithMissing).toBe(2);
    });

    test("calculates percentages", () => {
      const data = [{ x: 1 }, { x: null }, { x: null }, { x: 4 }];

      const analysis = analyzeMissingValues(data, ["x"]);
      expect(analysis.columnMissing.x.percentage).toBe(50);
    });

    test("handles empty data", () => {
      const analysis = analyzeMissingValues([], ["a"]);
      expect(analysis.totalRows).toBe(0);
      expect(analysis.totalMissingValues).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    test("handles all missing column", () => {
      const data = [{ col: null }, { col: null }, { col: null }];

      const result = imputeMissingValues(data, ["col"], {
        imputationStrategy: IMPUTATION_STRATEGIES.MEAN,
      });

      // Should not throw, returns original nulls
      expect(result.rows.length).toBe(3);
    });

    test("handles single row", () => {
      const data = [{ value: null }];
      const result = imputeMissingValues(data, ["value"], {
        imputationStrategy: IMPUTATION_STRATEGIES.MEDIAN,
      });
      expect(result.rows.length).toBe(1);
    });

    test("handles no missing values", () => {
      const data = [{ a: 1 }, { a: 2 }];
      const result = imputeMissingValues(data, ["a"], {
        imputationStrategy: IMPUTATION_STRATEGIES.MEAN,
      });
      expect(result.summary.totalImputed).toBe(0);
    });

    test("excludes specified columns", () => {
      const data = [{ keep: null, ignore: null }];

      const result = imputeMissingValues(data, ["keep", "ignore"], {
        imputationStrategy: IMPUTATION_STRATEGIES.CONSTANT,
        constantValue: "X",
        excludeColumns: ["ignore"],
      });

      expect(result.rows[0].keep).toBe("X");
      expect(result.rows[0].ignore).toBeNull();
    });
  });
});
