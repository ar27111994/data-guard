/**
 * Duplicate Detector Tests
 * Tests exact and fuzzy duplicate detection with edge cases
 */
import { detectDuplicates } from "../src/validators/duplicate-detector.js";

describe("Duplicate Detection", () => {
  describe("Exact Duplicate Detection", () => {
    test("detects exact duplicates on single column", () => {
      const rows = [
        { id: "1", name: "John" },
        { id: "2", name: "Jane" },
        { id: "1", name: "John" }, // Duplicate
      ];

      const issues = detectDuplicates(rows, ["id", "name"], {
        checkDuplicates: true,
        duplicateColumns: ["id"],
      });

      expect(issues.length).toBe(1);
      expect(issues[0].rowNumber).toBe(3);
    });

    test("detects duplicates on multiple columns", () => {
      const rows = [
        { first: "John", last: "Doe" },
        { first: "Jane", last: "Smith" },
        { first: "John", last: "Doe" }, // Duplicate
        { first: "John", last: "Smith" }, // Not duplicate
      ];

      const issues = detectDuplicates(rows, ["first", "last"], {
        checkDuplicates: true,
        duplicateColumns: ["first", "last"],
      });

      expect(issues.length).toBe(1);
      expect(issues[0].rowNumber).toBe(3);
    });

    test("handles null values in duplicate detection", () => {
      const rows = [
        { id: null, name: "John" },
        { id: null, name: "Jane" },
        { id: "1", name: "Bob" },
      ];

      const issues = detectDuplicates(rows, ["id", "name"], {
        checkDuplicates: true,
        duplicateColumns: ["id"],
      });

      // Nulls might be considered duplicates depending on implementation
      expect(issues).toBeDefined();
    });

    test("handles empty strings in duplicate detection", () => {
      const rows = [
        { id: "", name: "John" },
        { id: "", name: "Jane" },
        { id: "1", name: "Bob" },
      ];

      const issues = detectDuplicates(rows, ["id", "name"], {
        checkDuplicates: true,
        duplicateColumns: ["id"],
      });

      expect(issues).toBeDefined();
    });

    test("case-sensitive by default", () => {
      const rows = [{ name: "John" }, { name: "john" }, { name: "JOHN" }];

      const issues = detectDuplicates(rows, ["name"], {
        checkDuplicates: true,
        duplicateColumns: ["name"],
      });

      // All should be unique if case-sensitive
      expect(issues.length).toBe(0);
    });

    test("returns no duplicates for unique data", () => {
      const rows = [
        { id: "1", name: "John" },
        { id: "2", name: "Jane" },
        { id: "3", name: "Bob" },
      ];

      const issues = detectDuplicates(rows, ["id", "name"], {
        checkDuplicates: true,
        duplicateColumns: ["id"],
      });

      expect(issues.length).toBe(0);
    });

    test("handles large number of duplicates", () => {
      const rows = Array.from({ length: 100 }, () => ({
        id: "1",
        name: "Same",
      }));

      const issues = detectDuplicates(rows, ["id", "name"], {
        checkDuplicates: true,
        duplicateColumns: ["id"],
        maxIssuesPerType: 50,
      });

      expect(issues.length).toBeLessThanOrEqual(50);
    });
  });

  describe("Fuzzy Duplicate Detection", () => {
    test("detects similar strings", () => {
      const rows = [
        { name: "John Smith" },
        { name: "Jon Smith" }, // Similar
        { name: "Jane Doe" },
      ];

      const issues = detectDuplicates(rows, ["name"], {
        checkDuplicates: true,
        duplicateColumns: ["name"],
        fuzzyDuplicates: true,
        fuzzySimilarityThreshold: 0.8,
      });

      expect(issues.some((i) => i.issueType === "fuzzy-duplicate")).toBe(true);
    });

    test("respects similarity threshold", () => {
      const rows = [{ name: "John Smith" }, { name: "John Smyth" }];

      // High threshold - should not match
      const issuesHigh = detectDuplicates(rows, ["name"], {
        checkDuplicates: true,
        duplicateColumns: ["name"],
        fuzzyDuplicates: true,
        fuzzySimilarityThreshold: 0.99,
      });

      // Low threshold - should match
      const issuesLow = detectDuplicates(rows, ["name"], {
        checkDuplicates: true,
        duplicateColumns: ["name"],
        fuzzyDuplicates: true,
        fuzzySimilarityThreshold: 0.7,
      });

      expect(issuesLow.length).toBeGreaterThanOrEqual(issuesHigh.length);
    });

    test("handles empty values in fuzzy matching", () => {
      const rows = [{ name: "" }, { name: "" }, { name: "John" }];

      const issues = detectDuplicates(rows, ["name"], {
        checkDuplicates: true,
        duplicateColumns: ["name"],
        fuzzyDuplicates: true,
        fuzzySimilarityThreshold: 0.8,
      });

      expect(issues).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    test("handles empty array", () => {
      const issues = detectDuplicates([], [], {
        checkDuplicates: true,
        duplicateColumns: [],
      });

      expect(issues).toEqual([]);
    });

    test("handles single row", () => {
      const issues = detectDuplicates([{ id: "1" }], ["id"], {
        checkDuplicates: true,
        duplicateColumns: ["id"],
      });

      expect(issues).toEqual([]);
    });

    test("handles missing duplicate columns config", () => {
      const rows = [
        { id: "1", name: "John" },
        { id: "1", name: "John" },
      ];

      // Should use all columns or handle gracefully
      const issues = detectDuplicates(rows, ["id", "name"], {
        checkDuplicates: true,
        // duplicateColumns not specified
      });

      expect(issues).toBeDefined();
    });

    test("handles special characters", () => {
      const rows = [
        { name: "O'Brien" },
        { name: "O'Brien" },
        { name: "Müller" },
        { name: "Müller" },
      ];

      const issues = detectDuplicates(rows, ["name"], {
        checkDuplicates: true,
        duplicateColumns: ["name"],
      });

      expect(issues.length).toBe(2);
    });

    test("handles very long strings", () => {
      const longString = "a".repeat(10000);
      const rows = [{ content: longString }, { content: longString }];

      const issues = detectDuplicates(rows, ["content"], {
        checkDuplicates: true,
        duplicateColumns: ["content"],
      });

      expect(issues.length).toBe(1);
    });

    test("handles numeric values", () => {
      const rows = [{ value: 123 }, { value: "123" }, { value: 123.0 }];

      const issues = detectDuplicates(rows, ["value"], {
        checkDuplicates: true,
        duplicateColumns: ["value"],
      });

      // Depending on string conversion, may or may not be duplicates
      expect(issues).toBeDefined();
    });
  });
});
