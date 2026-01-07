/**
 * Integration tests for data source parsing
 * Tests format detection and parsing without HTTP/binary edge cases
 */

import { parseDataSource } from "../../src/parsers/data-source.js";

describe("Data Source Integration Tests", () => {
  describe("Format Auto-Detection for Inline Sources", () => {
    test("detects JSON array format from content", async () => {
      const result = await parseDataSource({
        dataSourceInline:
          '[{"id": 1, "name": "Test"}, {"id": 2, "name": "User"}]',
        format: "auto",
      });

      expect(result.rows).toHaveLength(2);
      expect(result.metadata.format).toBe("json");
    });

    test("detects JSON object format from content", async () => {
      const result = await parseDataSource({
        dataSourceInline: '{"id": 1, "name": "Single"}',
        format: "auto",
      });

      expect(result.rows).toHaveLength(1);
      expect(result.metadata.format).toBe("json");
    });

    test("detects CSV format from content", async () => {
      const result = await parseDataSource({
        dataSourceInline: "a,b,c\n1,2,3\n4,5,6",
        format: "auto",
      });

      expect(result.rows).toHaveLength(2);
      expect(result.headers).toEqual(["a", "b", "c"]);
    });

    test("detects JSONL format from content", async () => {
      const result = await parseDataSource({
        dataSourceInline:
          '{"id": 1, "name": "A"}\n{"id": 2, "name": "B"}\n{"id": 3, "name": "C"}',
        format: "auto",
      });

      expect(result.rows).toHaveLength(3);
    });
  });

  describe("Explicit Format Override", () => {
    test("parses as CSV when format explicitly set", async () => {
      const result = await parseDataSource({
        dataSourceInline: "id,name\n1,John\n2,Jane",
        format: "csv",
      });

      expect(result.rows).toHaveLength(2);
      expect(result.metadata.format).toBe("csv");
    });

    test("parses as JSON when format explicitly set", async () => {
      const result = await parseDataSource({
        dataSourceInline: '[{"x": 1}]',
        format: "json",
      });

      expect(result.rows).toHaveLength(1);
      expect(result.metadata.format).toBe("json");
    });
  });

  describe("Edge Cases", () => {
    test("handles empty CSV with headers only", async () => {
      const result = await parseDataSource({
        dataSourceInline: "a,b,c",
        format: "csv",
      });

      expect(result.rows).toHaveLength(0);
      expect(result.headers).toEqual(["a", "b", "c"]);
    });

    test("handles CSV with quoted fields", async () => {
      const result = await parseDataSource({
        dataSourceInline:
          'id,name,desc\n1,"John Doe","Hello, World"\n2,"Jane","Test"',
        format: "csv",
      });

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe("John Doe");
      expect(result.rows[0].desc).toBe("Hello, World");
    });

    test("handles empty JSON array", async () => {
      const result = await parseDataSource({
        dataSourceInline: "[]",
        format: "json",
      });

      expect(result.rows).toHaveLength(0);
    });

    test("throws on missing data source", async () => {
      await expect(parseDataSource({})).rejects.toThrow();
    });

    test("throws on empty inline data", async () => {
      await expect(parseDataSource({ dataSourceInline: "" })).rejects.toThrow();
    });
  });

  describe("Metadata", () => {
    test("includes sourceType in metadata", async () => {
      const result = await parseDataSource({
        dataSourceInline: "a,b\n1,2",
        format: "csv",
      });

      expect(result.metadata.sourceType).toBe("inline");
    });

    test("includes format in metadata", async () => {
      const result = await parseDataSource({
        dataSourceInline: '[{"x": 1}]',
        format: "json",
      });

      expect(result.metadata.format).toBe("json");
    });

    test("includes originalSize in metadata", async () => {
      const data = "id,name\n1,Test";
      const result = await parseDataSource({
        dataSourceInline: data,
        format: "csv",
      });

      expect(result.metadata.originalSize).toBe(data.length);
    });
  });
});
