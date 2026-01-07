/**
 * Integration tests for data source parsing
 * Tests format detection, Base64 parsing, and binary handling
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

  describe("Base64 Encoded Data", () => {
    test("parses base64 encoded CSV string", async () => {
      // "id,name\n1,Test\n2,User" encoded as base64
      const csvData = "id,name\n1,Test\n2,User";
      const base64Data = Buffer.from(csvData).toString("base64");

      const result = await parseDataSource({
        dataSourceBase64: base64Data,
        format: "csv",
      });

      expect(result.rows).toHaveLength(2);
      expect(result.headers).toContain("id");
      expect(result.headers).toContain("name");
      expect(result.rows[0].id).toBe("1");
      expect(result.rows[0].name).toBe("Test");
      expect(result.metadata.sourceType).toBe("base64");
    });

    test("parses base64 encoded JSON string", async () => {
      const jsonData = '[{"id":1,"value":"a"},{"id":2,"value":"b"}]';
      const base64Data = Buffer.from(jsonData).toString("base64");

      const result = await parseDataSource({
        dataSourceBase64: base64Data,
        format: "json",
      });

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].id).toBe(1);
      expect(result.rows[1].value).toBe("b");
      expect(result.metadata.sourceType).toBe("base64");
    });

    test("handles base64 with whitespace and newlines", async () => {
      const csvData = "col1,col2\nval1,val2";
      // Add whitespace that might be in user-pasted base64
      const base64Data = "  " + Buffer.from(csvData).toString("base64") + "  ";

      const result = await parseDataSource({
        dataSourceBase64: base64Data,
        format: "csv",
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].col1).toBe("val1");
    });

    test("handles invalid base64 input gracefully", async () => {
      // Note: Node.js Buffer.from is lenient with base64 and doesn't throw
      // It will produce garbage data, which will then fail to parse properly
      const result = await parseDataSource({
        dataSourceBase64: "!!!invalid-base64!!!",
        format: "csv",
      });

      // Returns parsed result (possibly empty/garbage) rather than throwing
      expect(result).toBeDefined();
      expect(result.metadata.sourceType).toBe("base64");
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

    test("handles CSV with quoted fields containing commas", async () => {
      const result = await parseDataSource({
        dataSourceInline:
          'id,name,desc\n1,"John Doe","Hello, World"\n2,"Jane","Test"',
        format: "csv",
      });

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe("John Doe");
      expect(result.rows[0].desc).toBe("Hello, World");
    });

    test("handles CSV with quoted fields containing newlines", async () => {
      const result = await parseDataSource({
        dataSourceInline: 'id,text\n1,"Line1\nLine2"\n2,"Single"',
        format: "csv",
      });

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].text).toContain("Line1");
    });

    test("handles empty JSON array", async () => {
      const result = await parseDataSource({
        dataSourceInline: "[]",
        format: "json",
      });

      expect(result.rows).toHaveLength(0);
    });

    test("handles single JSON object (non-array)", async () => {
      const result = await parseDataSource({
        dataSourceInline: '{"id": 42, "name": "Singleton"}',
        format: "json",
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(42);
    });

    test("throws on missing data source", async () => {
      await expect(parseDataSource({})).rejects.toThrow();
    });

    test("throws on empty inline data", async () => {
      await expect(parseDataSource({ dataSourceInline: "" })).rejects.toThrow();
    });

    test("throws on whitespace-only inline data", async () => {
      await expect(
        parseDataSource({ dataSourceInline: "   \n\t  " })
      ).rejects.toThrow();
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

    test("base64 metadata shows correct sourceType", async () => {
      const csvData = "a,b\n1,2";
      const base64Data = Buffer.from(csvData).toString("base64");

      const result = await parseDataSource({
        dataSourceBase64: base64Data,
        format: "csv",
      });

      expect(result.metadata.sourceType).toBe("base64");
    });
  });

  describe("Large Data Handling", () => {
    test("parses CSV with 1000 rows", async () => {
      const header = "id,name,value";
      const rows = Array.from(
        { length: 1000 },
        (_, i) => `${i},User${i},${Math.random()}`
      );
      const csvData = [header, ...rows].join("\n");

      const result = await parseDataSource({
        dataSourceInline: csvData,
        format: "csv",
      });

      expect(result.rows).toHaveLength(1000);
      expect(result.rows[0].id).toBe("0");
      expect(result.rows[999].id).toBe("999");
    });

    test("parses JSON array with 1000 objects", async () => {
      const jsonData = JSON.stringify(
        Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `User${i}`,
        }))
      );

      const result = await parseDataSource({
        dataSourceInline: jsonData,
        format: "json",
      });

      expect(result.rows).toHaveLength(1000);
      expect(result.rows[0].id).toBe(0);
      expect(result.rows[999].id).toBe(999);
    });
  });
});
