/**
 * End-to-End tests for full Actor flow
 * Tests complete validation pipeline with all features
 *
 * Note: These tests use direct imports (no mocking) for reliability
 */

import { parseDataSource } from "../../src/parsers/data-source.js";
import { profileColumn } from "../../src/profiling/column-profiler.js";
import { detectPIIInData } from "../../src/remediation/pii-detector.js";

describe("E2E Full Flow Tests", () => {
  describe("Complete Validation Pipeline", () => {
    test("parses inline CSV and profiles columns correctly", async () => {
      // Step 1: Parse data
      const config = {
        dataSourceInline:
          "id,name,email,phone,amount\n1,John Doe,john@example.com,555-123-4567,100.50\n2,Jane Smith,jane@test.com,555-987-6543,250.00\n3,Bob Wilson,,555-111-2222,75.25\n4,Alice Brown,alice@demo.net,,150.00",
        format: "csv",
        hasHeader: true,
      };

      const parseResult = await parseDataSource(config);

      expect(parseResult.rows).toHaveLength(4);
      expect(parseResult.headers).toEqual([
        "id",
        "name",
        "email",
        "phone",
        "amount",
      ]);

      // Step 2: Profile each column
      const idValues = parseResult.rows.map((r) => r.id);
      const idProfile = profileColumn("id", idValues);
      expect(idProfile.totalCount).toBe(4);
      expect(idProfile.detectedType).toBe("numeric");

      const emailValues = parseResult.rows.map((r) => r.email);
      const emailProfile = profileColumn("email", emailValues);
      expect(emailProfile.totalCount).toBe(4);
      // 2 nulls (rows 3 and 4 have empty phone/email)
      expect(emailProfile.nullCount).toBe(1); // Row 3 has empty email

      // Step 3: Detect PII
      const piiResult = await detectPIIInData(
        parseResult.rows,
        parseResult.headers,
        {
          piiTypes: ["email", "phone"],
        }
      );

      expect(piiResult.totalFindings).toBeGreaterThan(0);
      // 3 valid emails, 3 valid phones
      expect(
        piiResult.findings.filter((f) => f.piiType === "email")
      ).toHaveLength(3);
      expect(
        piiResult.findings.filter((f) => f.piiType === "phone")
      ).toHaveLength(3);
    });

    test("detects missing values in parsed data", async () => {
      const config = {
        dataSourceInline: "a,b,c\n1,,3\n,2,\n1,2,3",
        format: "csv",
      };

      const parseResult = await parseDataSource(config);
      expect(parseResult.rows).toHaveLength(3);

      // Profile columns to detect nulls
      const aProfile = profileColumn(
        "a",
        parseResult.rows.map((r) => r.a)
      );
      const bProfile = profileColumn(
        "b",
        parseResult.rows.map((r) => r.b)
      );
      const cProfile = profileColumn(
        "c",
        parseResult.rows.map((r) => r.c)
      );

      // Should detect null values
      expect(aProfile.nullCount).toBe(1); // Row 2 has empty 'a'
      expect(bProfile.nullCount).toBe(1); // Row 1 has empty 'b'
      expect(cProfile.nullCount).toBe(1); // Row 2 has empty 'c'
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
      expect(parseResult.headers).toContain("id");
      expect(parseResult.headers).toContain("email");

      // Detect PII
      const piiResult = await detectPIIInData(
        parseResult.rows,
        parseResult.headers,
        { piiTypes: ["email"] }
      );

      expect(piiResult.totalFindings).toBe(2);
      expect(piiResult.hasHighRiskPII).toBe(true);
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

      // Profiling empty column should work
      const profile = profileColumn("a", []);
      expect(profile.totalCount).toBe(0);
    });

    test("handles special characters in data", async () => {
      const config = {
        dataSourceInline:
          'id,name,description\n1,"John Doe","Line1, with comma"\n2,"Jane O\'Brien","<Test>"',
        format: "csv",
      };

      const parseResult = await parseDataSource(config);
      expect(parseResult.rows.length).toBe(2);
      expect(parseResult.rows[0].name).toBe("John Doe");
      expect(parseResult.rows[1].name).toBe("Jane O'Brien");
      expect(parseResult.rows[1].description).toBe("<Test>");
    });
  });

  describe("Performance", () => {
    test("processes 1000 rows through full pipeline in reasonable time", async () => {
      const rows = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User${i}`,
        email: `user${i}@test.com`,
        value: Math.random() * 1000,
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
      const piiResult = await detectPIIInData(
        rows,
        ["id", "name", "email", "value"],
        {
          piiTypes: ["email"],
        }
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
      expect(idProfile.totalCount).toBe(1000);
      expect(emailProfile.uniqueCount).toBe(1000);
      expect(piiResult.totalFindings).toBe(1000);
    });
  });

  describe("Data Quality Analysis", () => {
    test("calculates completeness via profiling", async () => {
      const config = {
        dataSourceInline:
          "id,name,email\n1,John,john@test.com\n2,Jane,jane@test.com\n3,Bob,bob@test.com",
        format: "csv",
      };

      const parseResult = await parseDataSource(config);

      // Profile each column to get completeness info
      const profiles = {};
      for (const header of parseResult.headers) {
        profiles[header] = profileColumn(
          header,
          parseResult.rows.map((r) => r[header])
        );
      }

      // Complete data should have 0 nulls
      expect(profiles.id.nullCount).toBe(0);
      expect(profiles.name.nullCount).toBe(0);
      expect(profiles.email.nullCount).toBe(0);
    });

    test("detects quality issues with incomplete data", async () => {
      const config = {
        dataSourceInline: "id,name,email\n1,,\n2,Jane,\n3,,bob@test.com",
        format: "csv",
      };

      const parseResult = await parseDataSource(config);

      // Profile each column
      const profiles = {};
      for (const header of parseResult.headers) {
        profiles[header] = profileColumn(
          header,
          parseResult.rows.map((r) => r[header])
        );
      }

      // Incomplete data should have non-zero nulls
      expect(profiles.name.nullCount).toBe(2); // 2 missing names
      expect(profiles.email.nullCount).toBe(2); // 2 missing emails
      expect(Number(profiles.name.nullPercent)).toBeGreaterThan(0);
    });
  });
});
