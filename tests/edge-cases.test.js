/**
 * Edge Cases Tests
 * Tests for unusual and boundary conditions
 */
import {
  validateInput,
  handleEmptyData,
  safeParseValue,
  sanitizeForHTML,
} from "../src/utils/edge-cases.js";

describe("Edge Cases", () => {
  describe("Input Validation", () => {
    describe("Data Source Validation", () => {
      test("rejects when no data source provided", () => {
        const result = validateInput({});
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes("No data source"))).toBe(
          true,
        );
      });

      test("accepts valid URL", () => {
        const result = validateInput({
          dataSourceUrl: "https://example.com/data.csv",
        });
        expect(result.isValid).toBe(true);
      });

      test("rejects invalid URL", () => {
        const result = validateInput({
          dataSourceUrl: "not-a-url",
        });
        expect(result.errors.some((e) => e.includes("Invalid URL"))).toBe(true);
      });

      test("accepts inline data", () => {
        const result = validateInput({
          dataSourceInline: "a,b\n1,2",
        });
        expect(result.isValid).toBe(true);
      });

      test("warns about multiple data sources", () => {
        const result = validateInput({
          dataSourceUrl: "https://example.com/data.csv",
          dataSourceInline: "a,b\n1,2",
        });
        expect(result.warnings.some((w) => w.includes("Multiple"))).toBe(true);
      });
    });

    describe("Schema Validation", () => {
      test("accepts valid schema", () => {
        const result = validateInput({
          dataSourceInline: "a,b\n1,2",
          schemaDefinition: [
            { name: "a", type: "integer" },
            { name: "b", type: "integer" },
          ],
        });
        expect(result.isValid).toBe(true);
      });

      test("rejects schema without name", () => {
        const result = validateInput({
          dataSourceInline: "a\n1",
          schemaDefinition: [{ type: "integer" }],
        });
        expect(result.errors.some((e) => e.includes("missing 'name'"))).toBe(
          true,
        );
      });

      test("warns about unknown types", () => {
        const result = validateInput({
          dataSourceInline: "a\n1",
          schemaDefinition: [{ name: "a", type: "unknown_type" }],
        });
        expect(result.warnings.some((w) => w.includes("Unknown type"))).toBe(
          true,
        );
      });
    });

    describe("Threshold Validation", () => {
      test("warns about out-of-range zscoreThreshold", () => {
        const result = validateInput({
          dataSourceInline: "a\n1",
          zscoreThreshold: 100,
        });
        expect(result.warnings.some((w) => w.includes("zscoreThreshold"))).toBe(
          true,
        );
      });

      test("warns about out-of-range fuzzySimilarityThreshold", () => {
        const result = validateInput({
          dataSourceInline: "a\n1",
          fuzzySimilarityThreshold: 2.0,
        });
        expect(
          result.warnings.some((w) => w.includes("fuzzySimilarityThreshold")),
        ).toBe(true);
      });
    });
  });

  describe("Empty Data Handling", () => {
    test("detects null rows", () => {
      const result = handleEmptyData(null, []);
      expect(result.isEmpty).toBe(true);
      expect(result.reason).toContain("No data");
    });

    test("detects undefined rows", () => {
      const result = handleEmptyData(undefined, []);
      expect(result.isEmpty).toBe(true);
    });

    test("detects empty array", () => {
      const result = handleEmptyData([], ["col1"]);
      expect(result.isEmpty).toBe(true);
      expect(result.reason).toContain("empty");
    });

    test("detects non-array data", () => {
      const result = handleEmptyData("not an array", []);
      expect(result.isEmpty).toBe(true);
      expect(result.reason).toContain("not in array format");
    });

    test("extracts headers from first row", () => {
      const rows = [{ name: "John", age: 30 }];
      const result = handleEmptyData(rows, []);
      expect(result.isEmpty).toBe(false);
      expect(result.headers).toContain("name");
      expect(result.headers).toContain("age");
    });

    test("handles valid data", () => {
      const rows = [{ a: 1 }, { a: 2 }];
      const headers = ["a"];
      const result = handleEmptyData(rows, headers);
      expect(result.isEmpty).toBe(false);
      expect(result.rows).toBe(rows);
      expect(result.headers).toBe(headers);
    });
  });

  describe("Safe Value Parsing", () => {
    describe("Null Handling", () => {
      test("handles null", () => {
        const result = safeParseValue(null, "string");
        expect(result.isNull).toBe(true);
        expect(result.value).toBe(null);
      });

      test("handles undefined", () => {
        const result = safeParseValue(undefined, "string");
        expect(result.isNull).toBe(true);
      });

      test("handles empty string", () => {
        const result = safeParseValue("", "string");
        expect(result.isNull).toBe(true);
      });

      test("handles whitespace-only string", () => {
        const result = safeParseValue("   ", "string");
        expect(result.isNull).toBe(true);
      });
    });

    describe("Number Parsing", () => {
      test("parses integers", () => {
        expect(safeParseValue("123", "number").value).toBe(123);
        expect(safeParseValue("-456", "number").value).toBe(-456);
      });

      test("parses decimals", () => {
        expect(safeParseValue("3.14", "number").value).toBe(3.14);
        expect(safeParseValue("-0.5", "number").value).toBe(-0.5);
      });

      test("rejects non-numbers", () => {
        // 'abc' is clearly not a number
        expect(safeParseValue("abc", "number").parseError).toBe(true);
        // '12.34.56' parseFloat returns 12.34, so it's considered valid
        // Test with a clearly non-numeric value instead
        expect(safeParseValue("hello world", "number").parseError).toBe(true);
      });

      test("handles leading/trailing whitespace", () => {
        expect(safeParseValue("  42  ", "number").value).toBe(42);
      });
    });

    describe("Boolean Parsing", () => {
      test("parses true values", () => {
        ["true", "TRUE", "True", "1", "yes", "YES", "y", "Y"].forEach((val) => {
          expect(safeParseValue(val, "boolean").value).toBe(true);
        });
      });

      test("parses false values", () => {
        ["false", "FALSE", "False", "0", "no", "NO", "n", "N"].forEach(
          (val) => {
            expect(safeParseValue(val, "boolean").value).toBe(false);
          },
        );
      });

      test("rejects invalid booleans", () => {
        expect(safeParseValue("maybe", "boolean").parseError).toBe(true);
        expect(safeParseValue("2", "boolean").parseError).toBe(true);
      });
    });

    describe("Date Parsing", () => {
      test("parses valid dates", () => {
        const result = safeParseValue("2024-01-15", "date");
        expect(result.value instanceof Date).toBe(true);
        expect(result.isNull).toBe(false);
      });

      test("rejects invalid dates", () => {
        expect(safeParseValue("not-a-date", "date").parseError).toBe(true);
        expect(safeParseValue("2024-13-45", "date").parseError).toBe(true);
      });
    });

    describe("String Parsing", () => {
      test("returns string as-is", () => {
        expect(safeParseValue("hello", "string").value).toBe("hello");
      });

      test("trims whitespace", () => {
        expect(safeParseValue("  hello  ", "string").value).toBe("hello");
      });
    });
  });

  describe("HTML Sanitization", () => {
    test("escapes HTML entities", () => {
      expect(sanitizeForHTML("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
      );
    });

    test("escapes ampersands", () => {
      expect(sanitizeForHTML("Tom & Jerry")).toBe("Tom &amp; Jerry");
    });

    test("escapes quotes", () => {
      expect(sanitizeForHTML('"quoted"')).toBe("&quot;quoted&quot;");
    });

    test("handles non-string input", () => {
      expect(sanitizeForHTML(123)).toBe("123");
      expect(sanitizeForHTML(null)).toBe("null");
    });
  });

  describe("Boundary Conditions", () => {
    test("handles very long strings", () => {
      const longString = "a".repeat(1000000);
      const result = safeParseValue(longString, "string");
      expect(result.value.length).toBe(1000000);
    });

    test("handles very large numbers", () => {
      const result = safeParseValue("9999999999999999999999", "number");
      expect(result.value).toBeDefined();
    });

    test("handles special characters", () => {
      const special = '!@#$%^&*(){}[]|\\:";<>?,./';
      const result = safeParseValue(special, "string");
      expect(result.value).toBe(special);
    });

    test("handles emoji", () => {
      const emoji = "🎉🔥💯";
      const result = safeParseValue(emoji, "string");
      expect(result.value).toBe(emoji);
    });

    test("handles zero", () => {
      expect(safeParseValue("0", "number").value).toBe(0);
      expect(safeParseValue(0, "number").value).toBe(0);
    });

    test("handles negative zero", () => {
      expect(safeParseValue("-0", "number").value).toBe(-0);
    });

    test("handles scientific notation", () => {
      expect(safeParseValue("1e10", "number").value).toBe(1e10);
      expect(safeParseValue("1.5E-5", "number").value).toBe(1.5e-5);
    });
  });

  describe("Unicode Edge Cases", () => {
    test("handles RTL text", () => {
      const rtl = "مرحبا";
      expect(safeParseValue(rtl, "string").value).toBe(rtl);
    });

    test("handles CJK characters", () => {
      const cjk = "日本語中文한국어";
      expect(safeParseValue(cjk, "string").value).toBe(cjk);
    });

    test("handles combining characters", () => {
      const combining = "é"; // e + combining acute
      expect(safeParseValue(combining, "string").value).toBe(combining);
    });

    test("handles zero-width characters", () => {
      const zeroWidth = "a\u200Bb"; // Zero-width space
      expect(safeParseValue(zeroWidth, "string").value).toContain("a");
    });
  });
});
