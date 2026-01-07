/**
 * End-to-End tests for full Actor flow
 * Tests the complete validation pipeline
 */

import { parseDataSource } from "../../src/parsers/data-source.js";
import { profileColumn } from "../../src/profiling/column-profiler.js";
import { detectPIIInData } from "../../src/remediation/pii-detector.js";

describe("E2E Full Flow Tests", () => {
  describe("Complete Validation Pipeline", () => {
    test("parses and profiles CSV data correctly", async () => {
      // Step 1: Parse data
      const config = {
        dataSourceInline:
          "id,name,email,amount\n1,John Doe,john@example.com,100.50\n2,Jane Smith,jane@test.com,250.00\n3,Bob Wilson,bob@demo.net,75.25",
        format: "csv",
      };

      const parseResult = await parseDataSource(config);

      expect(parseResult.rows).toHaveLength(3);
      expect(parseResult.headers).toEqual(["id", "name", "email", "amount"]);

      // Step 2: Profile each column
      const idProfile = profileColumn(
        "id",
        parseResult.rows.map((r) => r.id)
      );
      expect(idProfile.totalCount).toBe(3);
      expect(idProfile.detectedType).toBe("numeric");

      const emailProfile = profileColumn(
        "email",
        parseResult.rows.map((r) => r.email)
      );
      expect(emailProfile.totalCount).toBe(3);
      expect(emailProfile.uniqueCount).toBe(3);
    });

    test("detects PII in parsed data", async () => {
      const config = {
        dataSourceInline:
          "id,name,email,phone\n1,John,john@example.com,555-123-4567\n2,Jane,jane@test.com,555-987-6543",
        format: "csv",
      };

      const parseResult = await parseDataSource(config);

      // Detect PII
      const piiResult = await detectPIIInData(
        parseResult.rows,
        parseResult.headers,
        { piiTypes: ["email", "phone"] }
      );

      expect(piiResult.totalFindings).toBe(4);
      expect(
        piiResult.findings.filter((f) => f.piiType === "email")
      ).toHaveLength(2);
      expect(
        piiResult.findings.filter((f) => f.piiType === "phone")
      ).toHaveLength(2);
    });

    test("handles JSON input format end-to-end", async () => {
      const config = {
        dataSourceInline: JSON.stringify([
          { id: 1, name: "Test", email: "test@example.com" },
          { id: 2, name: "User", email: "user@test.com" },
        ]),
        format: "json",
      };

      const parseResult = await parseDataSource(config);

      expect(parseResult.rows).toHaveLength(2);
      expect(parseResult.headers).toContain("email");

      const piiResult = await detectPIIInData(
        parseResult.rows,
        parseResult.headers,
        { piiTypes: ["email"] }
      );

      expect(piiResult.totalFindings).toBe(2);
    });
  });

  describe("Error Handling", () => {
    test("handles empty dataset gracefully", async () => {
      const config = {
        dataSourceInline: "a,b,c",
        format: "csv",
      };

      const parseResult = await parseDataSource(config);
      expect(parseResult.rows).toHaveLength(0);
      expect(parseResult.headers).toEqual(["a", "b", "c"]);
    });
  });

  describe("Performance", () => {
    test("processes 1000 rows in reasonable time", async () => {
      const rows = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User${i}`,
        email: `user${i}@test.com`,
      }));

      const startTime = Date.now();

      // Profile columns
      const idProfile = profileColumn(
        "id",
        rows.map((r) => r.id)
      );
      const emailProfile = profileColumn(
        "email",
        rows.map((r) => r.email)
      );

      // Detect PII
      const piiResult = await detectPIIInData(rows, ["id", "name", "email"], {
        piiTypes: ["email"],
      });

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
      expect(idProfile.totalCount).toBe(1000);
      expect(emailProfile.uniqueCount).toBe(1000);
      expect(piiResult.totalFindings).toBe(1000);
    });
  });
});
