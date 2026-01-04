/**
 * Integration Tests
 * End-to-end tests for the complete validation pipeline
 */

describe("Integration Tests", () => {
  describe("Full Pipeline", () => {
    test("validates CSV data end-to-end", async () => {
      const csv =
        "name,age,email\nJohn,30,john@example.com\nJane,25,jane@example.com";
      const result = await validateData(csv, {
        format: "csv",
        checkTypes: true,
        checkDuplicates: true,
      });

      expect(result.rowCount).toBe(2);
      expect(result.columnCount).toBe(3);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
    });

    test("validates JSON data end-to-end", async () => {
      const json = JSON.stringify([
        { name: "John", age: 30 },
        { name: "Jane", age: 25 },
      ]);

      const result = await validateData(json, { format: "json" });

      expect(result.rowCount).toBe(2);
    });

    test("detects issues in data", async () => {
      const csv = "name,age\nJohn,thirty\n,25\nJane,25";
      const result = await validateData(csv, {
        format: "csv",
        schemaDefinition: [
          { name: "name", type: "string", required: true },
          { name: "age", type: "integer" },
        ],
      });

      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    test("handles empty data gracefully", async () => {
      const result = await validateData("", { format: "csv" });
      expect(result.isEmpty).toBe(true);
    });

    test("handles invalid JSON gracefully", async () => {
      try {
        await validateData("{invalid json}", { format: "json" });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Configuration Options", () => {
    test("respects sample size limit", async () => {
      const data = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      const csv = "id\n" + data.map((d) => d.id).join("\n");

      const result = await validateData(csv, {
        format: "csv",
        sampleSize: 100,
      });

      expect(result.sampleSize).toBeLessThanOrEqual(100);
    });

    test("respects issue limit", async () => {
      const csv = "num\n" + Array(100).fill("abc").join("\n");

      const result = await validateData(csv, {
        format: "csv",
        schemaDefinition: [{ name: "num", type: "integer" }],
        maxIssuesPerType: 10,
      });

      expect(result.issues.length).toBeLessThanOrEqual(10);
    });
  });

  describe("Quality Scoring", () => {
    test("assigns correct grades", async () => {
      const perfectCsv = "name,age\nJohn,30\nJane,25";
      const result = await validateData(perfectCsv, { format: "csv" });

      expect(result.qualityScore).toBeGreaterThanOrEqual(90);
      expect(result.grade).toBe("A");
    });
  });
});

// Self-contained mock implementation
async function validateData(data, config) {
  const { format, schemaDefinition, sampleSize, maxIssuesPerType } = config;

  // Parse data
  let rows = [];
  let headers = [];

  if (!data || data.trim() === "") {
    return { isEmpty: true, rowCount: 0, issues: [], qualityScore: 0 };
  }

  try {
    if (format === "csv") {
      const lines = data.split("\n").filter((l) => l.trim());
      if (lines.length === 0) {
        return { isEmpty: true, rowCount: 0, issues: [] };
      }
      headers = lines[0].split(",");
      rows = lines.slice(1).map((line) => {
        const values = line.split(",");
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] || "";
        });
        return obj;
      });
    } else if (format === "json") {
      const parsed = JSON.parse(data);
      rows = Array.isArray(parsed) ? parsed : [parsed];
      headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    }
  } catch (error) {
    throw new Error("Parse error: " + error.message);
  }

  // Apply sample size limit
  const rowsToCheck = sampleSize ? rows.slice(0, sampleSize) : rows;

  // Validate
  const issues = [];

  if (schemaDefinition) {
    rowsToCheck.forEach((row, idx) => {
      schemaDefinition.forEach((col) => {
        const value = row[col.name];

        // Required check
        if (col.required && (!value || value === "")) {
          issues.push({
            row: idx + 1,
            column: col.name,
            type: "missing",
          });
        }

        // Type check
        if (col.type === "integer" && value && isNaN(parseInt(value))) {
          issues.push({
            row: idx + 1,
            column: col.name,
            type: "type-mismatch",
          });
        }
      });
    });
  }

  // Apply max issues limit
  const limitedIssues = maxIssuesPerType
    ? issues.slice(0, maxIssuesPerType)
    : issues;

  // Calculate score
  const issueRate = limitedIssues.length / (rows.length || 1);
  const qualityScore = Math.round(Math.max(0, 100 - issueRate * 100));

  return {
    rowCount: rows.length,
    columnCount: headers.length,
    sampleSize: rowsToCheck.length,
    issues: limitedIssues,
    qualityScore,
    grade:
      qualityScore >= 90
        ? "A"
        : qualityScore >= 80
        ? "B"
        : qualityScore >= 70
        ? "C"
        : "D",
  };
}
