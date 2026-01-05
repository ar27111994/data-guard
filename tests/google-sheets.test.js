/**
 * Google Sheets Integration Tests
 * Tests URL parsing, export URL generation, and error handling
 */

import {
  parseGoogleSheetsUrl,
  getGoogleSheetsExportUrl,
  isGoogleSheetsUrl,
  detectDataSource,
} from "../src/integrations/google-sheets.js";

describe("Google Sheets Integration", () => {
  describe("URL Detection", () => {
    test("detects standard Google Sheets URL", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit";
      expect(isGoogleSheetsUrl(url)).toBe(true);
    });

    test("detects Google Sheets export URL", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv";
      expect(isGoogleSheetsUrl(url)).toBe(true);
    });

    test("detects Google Sheets API URL", () => {
      const url =
        "https://sheets.googleapis.com/v4/spreadsheets/1abc/values/A1:Z100";
      expect(isGoogleSheetsUrl(url)).toBe(true);
    });

    test("rejects non-Google Sheets URLs", () => {
      expect(isGoogleSheetsUrl("https://example.com/data.csv")).toBe(false);
      expect(isGoogleSheetsUrl("https://drive.google.com/file/d/abc")).toBe(
        false
      );
      expect(isGoogleSheetsUrl("")).toBe(false);
    });
  });

  describe("URL Parsing", () => {
    test("extracts spreadsheet ID from standard URL", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0";
      const result = parseGoogleSheetsUrl(url);
      expect(result.isGoogleSheets).toBe(true);
      expect(result.spreadsheetId).toBe(
        "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
      );
    });

    test("extracts spreadsheet ID from export URL", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/AbC123_xYz/export?format=csv";
      const result = parseGoogleSheetsUrl(url);
      expect(result.isGoogleSheets).toBe(true);
      expect(result.spreadsheetId).toBe("AbC123_xYz");
    });

    test("extracts spreadsheet ID with key parameter", () => {
      const url =
        "https://docs.google.com/spreadsheets?key=MySpreadsheetKey123";
      const result = parseGoogleSheetsUrl(url);
      expect(result.isGoogleSheets).toBe(true);
      expect(result.spreadsheetId).toBe("MySpreadsheetKey123");
    });

    test("returns false for non-Google Sheets URLs", () => {
      const result = parseGoogleSheetsUrl("https://example.com/file.csv");
      expect(result.isGoogleSheets).toBe(false);
      expect(result.spreadsheetId).toBeUndefined();
    });

    test("handles malformed URLs gracefully", () => {
      const result = parseGoogleSheetsUrl("not-a-url");
      expect(result.isGoogleSheets).toBe(false);
    });
  });

  describe("Export URL Generation", () => {
    test("generates CSV export URL", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit";
      const exportUrl = getGoogleSheetsExportUrl(url, "csv");
      expect(exportUrl).toBe(
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv"
      );
    });

    test("generates XLSX export URL", () => {
      const url = "https://docs.google.com/spreadsheets/d/TestId123/edit";
      const exportUrl = getGoogleSheetsExportUrl(url, "xlsx");
      expect(exportUrl).toContain("format=xlsx");
    });

    test("includes sheet ID when provided", () => {
      const url = "https://docs.google.com/spreadsheets/d/SpreadsheetId/edit";
      const exportUrl = getGoogleSheetsExportUrl(url, "csv", "12345");
      expect(exportUrl).toContain("gid=12345");
    });

    test("includes numeric sheet ID", () => {
      const url = "https://docs.google.com/spreadsheets/d/TestSheet/edit";
      const exportUrl = getGoogleSheetsExportUrl(url, "csv", 0);
      expect(exportUrl).toContain("gid=0");
    });

    test("returns original URL for non-Google Sheets", () => {
      const url = "https://example.com/data.csv";
      const exportUrl = getGoogleSheetsExportUrl(url, "csv");
      expect(exportUrl).toBe(url);
    });

    test("handles null sheet ID", () => {
      const url = "https://docs.google.com/spreadsheets/d/TestId/edit";
      const exportUrl = getGoogleSheetsExportUrl(url, "csv", null);
      expect(exportUrl).not.toContain("gid=");
    });
  });

  describe("Data Source Detection", () => {
    test("detects Google Sheets data source", () => {
      const url = "https://docs.google.com/spreadsheets/d/abc123/edit";
      const result = detectDataSource(url);
      expect(result.type).toBe("googleSheets");
      expect(result.integration).toBeDefined();
      expect(result.integration.name).toBe("Google Sheets");
    });

    test("returns generic for non-integration URLs", () => {
      const result = detectDataSource("https://example.com/data.csv");
      expect(result.type).toBe("generic");
      expect(result.integration).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    test("handles URL with special characters in ID", () => {
      const url = "https://docs.google.com/spreadsheets/d/1A-bC_dE2fG3hI/edit";
      const result = parseGoogleSheetsUrl(url);
      expect(result.isGoogleSheets).toBe(true);
      expect(result.spreadsheetId).toBe("1A-bC_dE2fG3hI");
    });

    test("handles URL with query parameters", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/TestId/edit?usp=sharing&rm=minimal";
      const result = parseGoogleSheetsUrl(url);
      expect(result.isGoogleSheets).toBe(true);
      expect(result.spreadsheetId).toBe("TestId");
    });

    test("handles URL with fragment", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/SheetId/edit#gid=1234567890";
      const exportUrl = getGoogleSheetsExportUrl(url, "csv");
      expect(exportUrl).toContain("SheetId");
    });

    test("handles empty URL", () => {
      expect(() => parseGoogleSheetsUrl("")).not.toThrow();
      expect(() => isGoogleSheetsUrl("")).not.toThrow();
    });

    test("handles undefined/null gracefully", () => {
      expect(() => isGoogleSheetsUrl(undefined)).not.toThrow();
      expect(() => isGoogleSheetsUrl(null)).not.toThrow();
    });

    test("handles very long spreadsheet IDs", () => {
      const longId = "A".repeat(100);
      const url = `https://docs.google.com/spreadsheets/d/${longId}/edit`;
      const result = parseGoogleSheetsUrl(url);
      expect(result.isGoogleSheets).toBe(true);
      expect(result.spreadsheetId).toBe(longId);
    });
  });
});
