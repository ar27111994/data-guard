/**
 * Tests for HTML report generation
 * Ensures report generates correctly with all feature combinations
 */

import { jest } from "@jest/globals";

// Mock Apify Actor
const mockSetValue = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule("apify", () => ({
  Actor: {
    setValue: mockSetValue,
  },
}));

// Import after mocking
const { generateHTMLReport } = await import("../src/export/html-report.js");

describe("HTML Report Generation", () => {
  beforeEach(() => {
    mockSetValue.mockClear();
  });

  describe("Basic Report Generation", () => {
    test("generates report with complete data", async () => {
      const qualityReport = {
        summary: {
          totalRows: 100,
          validRows: 95,
          invalidRows: 5,
          qualityScore: 95,
          processingTimeMs: 150,
        },
        dataQuality: {
          completeness: 98,
          uniqueness: 100,
          consistency: 92,
          validity: 95,
          accuracy: 90,
        },
        columnAnalysis: [
          {
            column: "id",
            type: "numeric",
            stats: { nullCount: 0, uniqueCount: 100 },
          },
        ],
        issues: [
          {
            rowNumber: 1,
            column: "name",
            issueType: "null",
            severity: "warning",
            message: "Empty value",
          },
        ],
        recommendations: [
          {
            priority: "high",
            category: "completeness",
            title: "Fix Missing Values",
            description: "5 rows have missing values",
          },
        ],
        metadata: {
          validatedAt: "2026-01-01T00:00:00.000Z",
        },
      };

      await generateHTMLReport(qualityReport, {});

      expect(mockSetValue).toHaveBeenCalledTimes(1);
      expect(mockSetValue).toHaveBeenCalledWith(
        "QUALITY_REPORT_HTML",
        expect.stringContaining("<!DOCTYPE html>"),
        { contentType: "text/html" }
      );

      const html = mockSetValue.mock.calls[0][1];
      expect(html).toContain("DataGuard Quality Report");
      expect(html).toContain("95"); // Quality score
    });

    test("generates report with PII detection results", async () => {
      const qualityReport = {
        summary: {
          totalRows: 50,
          validRows: 50,
          invalidRows: 0,
          qualityScore: 100,
          processingTimeMs: 75,
        },
        dataQuality: {
          completeness: 100,
          uniqueness: 100,
          consistency: 100,
          validity: 100,
          accuracy: 100,
        },
        columnAnalysis: [],
        issues: [],
        recommendations: [],
        piiDetection: {
          totalPII: 10,
          columns: ["email", "phone"],
          details: [
            { column: "email", type: "email", count: 5 },
            { column: "phone", type: "phone", count: 5 },
          ],
        },
        metadata: {
          validatedAt: new Date().toISOString(),
        },
      };

      await generateHTMLReport(qualityReport, {});

      expect(mockSetValue).toHaveBeenCalledTimes(1);
      const html = mockSetValue.mock.calls[0][1];
      expect(html).toContain("<!DOCTYPE html>");
    });
  });

  describe("Edge Cases", () => {
    test("generates report with empty data", async () => {
      const qualityReport = {
        summary: {},
        dataQuality: {},
        columnAnalysis: [],
        issues: [],
        recommendations: [],
        metadata: {},
      };

      await generateHTMLReport(qualityReport, {});

      expect(mockSetValue).toHaveBeenCalledTimes(1);
      const html = mockSetValue.mock.calls[0][1];
      expect(html).toContain("<!DOCTYPE html>");
    });

    test("generates report with null qualityReport", async () => {
      await generateHTMLReport(null, {});

      expect(mockSetValue).toHaveBeenCalledTimes(1);
      const html = mockSetValue.mock.calls[0][1];
      expect(html).toContain("<!DOCTYPE html>");
    });

    test("generates report with undefined qualityReport", async () => {
      await generateHTMLReport(undefined, {});

      expect(mockSetValue).toHaveBeenCalledTimes(1);
    });

    test("generates report with missing summary", async () => {
      const qualityReport = {
        dataQuality: { completeness: 100 },
        columnAnalysis: [],
        issues: [],
        recommendations: [],
      };

      await generateHTMLReport(qualityReport, {});

      expect(mockSetValue).toHaveBeenCalledTimes(1);
    });

    test("handles very large quality score values", async () => {
      const qualityReport = {
        summary: {
          totalRows: Number.MAX_SAFE_INTEGER,
          qualityScore: 999,
          processingTimeMs: 1000000000,
        },
        dataQuality: {},
        columnAnalysis: [],
        issues: [],
        recommendations: [],
      };

      await generateHTMLReport(qualityReport, {});

      expect(mockSetValue).toHaveBeenCalledTimes(1);
      const html = mockSetValue.mock.calls[0][1];
      // Quality score should be clamped to 100
      expect(html).toContain("100");
    });

    test("handles XSS attempts in data via HTML entity encoding", async () => {
      const qualityReport = {
        summary: {
          totalRows: 1,
          qualityScore: 50,
        },
        dataQuality: {},
        columnAnalysis: [
          {
            column: '<script>alert("xss")</script>',
            type: "string",
            stats: {},
          },
        ],
        issues: [
          {
            rowNumber: 1,
            column: "test",
            message: '<img src=x onerror="alert(1)">',
            severity: "error",
          },
        ],
        recommendations: [],
      };

      await generateHTMLReport(qualityReport, {});

      const html = mockSetValue.mock.calls[0][1];
      // Script tags should be HTML-entity encoded, not raw
      expect(html).not.toContain("<script>alert");
      // The < should become &lt;
      expect(html).toContain("&lt;script&gt;");
    });
  });
});
