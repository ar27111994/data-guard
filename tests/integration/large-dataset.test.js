/**
 * Integration tests for large dataset handling
 * Tests that profiling, histogram, and pattern detection don't stack overflow
 */

import { profileColumn } from "../../src/profiling/column-profiler.js";
import { generateNumericHistogram } from "../../src/profiling/histogram.js";
import { detectPatterns } from "../../src/validators/pattern-detector.js";

const LARGE_DATASET_SIZE = 150_000;

describe("Large Dataset Integration Tests", () => {
  let largeNumericArray;
  let largeStringArray;

  beforeAll(() => {
    // Generate large arrays for testing
    largeNumericArray = Array.from(
      { length: LARGE_DATASET_SIZE },
      (_, i) => Math.random() * 10000 + i
    );

    largeStringArray = Array.from(
      { length: LARGE_DATASET_SIZE },
      (_, i) => `value_${i}_${Math.random().toString(36).substring(7)}`
    );
  });

  describe("Column Profiler", () => {
    test("handles 150K numeric values without stack overflow", () => {
      expect(() => {
        const profile = profileColumn("largeNumeric", largeNumericArray);
        expect(profile.totalCount).toBe(LARGE_DATASET_SIZE);
        expect(profile.detectedType).toBe("numeric");
        expect(profile.numericStats).toBeDefined();
        expect(profile.numericStats.min).toBeDefined();
        expect(profile.numericStats.max).toBeDefined();
      }).not.toThrow();
    });

    test("handles 150K string values without stack overflow", () => {
      expect(() => {
        const profile = profileColumn("largeString", largeStringArray);
        expect(profile.totalCount).toBe(LARGE_DATASET_SIZE);
        expect(profile.detectedType).toBe("string");
        expect(profile.stringStats).toBeDefined();
        expect(profile.stringStats.minLength).toBeGreaterThan(0);
        expect(profile.stringStats.maxLength).toBeGreaterThan(0);
      }).not.toThrow();
    });
  });

  describe("Histogram Generation", () => {
    test("handles 150K numeric values without stack overflow", () => {
      expect(() => {
        const histogram = generateNumericHistogram(largeNumericArray, 10);
        expect(histogram.bins).toHaveLength(10);
        expect(histogram.min).toBeDefined();
        expect(histogram.max).toBeDefined();
        expect(histogram.totalValues).toBe(LARGE_DATASET_SIZE);
      }).not.toThrow();
    });
  });

  describe("Pattern Detector", () => {
    test("handles 150K rows without stack overflow", () => {
      const rows = largeNumericArray.map((v, i) => ({
        id: i,
        value: v,
        category: `cat_${i % 100}`,
      }));

      const headers = ["id", "value", "category"];
      const columnTypes = {
        id: { type: "integer" },
        value: { type: "number" },
        category: { type: "string" },
      };

      expect(() => {
        const result = detectPatterns(rows, headers, columnTypes, {});
        expect(result.summary).toBeDefined();
        expect(result.summary.columnsAnalyzed).toBeGreaterThan(0);
      }).not.toThrow();
    });
  });

  describe("Stress Tests", () => {
    test("handles mixed null and valid values without issues", () => {
      // 150K array with 10% nulls
      const mixedArray = Array.from({ length: LARGE_DATASET_SIZE }, (_, i) =>
        i % 10 === 0 ? null : Math.random() * 1000
      );

      expect(() => {
        const profile = profileColumn("mixed", mixedArray);
        expect(profile.totalCount).toBe(LARGE_DATASET_SIZE);
        expect(profile.nullCount).toBe(LARGE_DATASET_SIZE / 10);
      }).not.toThrow();
    });

    test("handles uniform data without issues", () => {
      // All same value
      const uniformArray = Array.from({ length: LARGE_DATASET_SIZE }, () => 42);

      expect(() => {
        const histogram = generateNumericHistogram(uniformArray, 10);
        expect(histogram.min).toBe(42);
        expect(histogram.max).toBe(42);
      }).not.toThrow();
    });
  });
});
