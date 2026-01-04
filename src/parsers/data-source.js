/**
 * Data Source Parser
 * Handles URL, inline, and base64 data sources
 * With comprehensive error handling
 */
import Papa from "papaparse";
import ExcelJS from "exceljs";
import {
  DataQualityError,
  Errors,
  retryWithBackoff,
  safeExecute,
} from "../utils/error-handler.js";
import {
  isGoogleSheetsUrl,
  getGoogleSheetsExportUrl,
} from "../integrations/google-sheets.js";

/**
 * Parse data from various sources (URL, inline, base64)
 * @param {Object} config - Actor input configuration
 * @returns {Promise<{rows: Array, headers: Array, metadata: Object}>}
 */
export async function parseDataSource(config) {
  const { dataSourceUrl, dataSourceInline, dataSourceBase64, format } = config;

  let rawData = null;
  let detectedFormat = format;
  let sourceType = "unknown";

  try {
    // Determine data source
    if (dataSourceUrl) {
      sourceType = "url";
      rawData = await fetchFromUrl(dataSourceUrl, config);
      if (format === "auto") {
        detectedFormat = detectFormatFromUrl(dataSourceUrl);
      }
    } else if (dataSourceInline) {
      sourceType = "inline";
      rawData = dataSourceInline;
      if (format === "auto") {
        detectedFormat = detectFormatFromContent(dataSourceInline);
      }
    } else if (dataSourceBase64) {
      sourceType = "base64";
      try {
        rawData = Buffer.from(dataSourceBase64, "base64");
      } catch (error) {
        throw Errors.invalidBase64(error);
      }
      if (format === "auto") {
        detectedFormat = detectFormatFromBase64(rawData);
      }
    } else {
      throw Errors.noDataSource();
    }

    // Validate raw data
    if (
      !rawData ||
      (typeof rawData === "string" && rawData.trim().length === 0)
    ) {
      throw Errors.emptyData();
    }

    console.log(`   Source type: ${sourceType}, Format: ${detectedFormat}`);

    // Parse based on detected format
    let result;
    switch (detectedFormat) {
      case "csv":
        result = await parseCsvSafe(rawData, config);
        break;
      case "xlsx":
      case "xls":
        result = await parseExcelSafe(rawData, config);
        break;
      case "json":
        result = parseJsonSafe(rawData, config);
        break;
      case "jsonl":
        result = parseJsonLinesSafe(rawData, config);
        break;
      default:
        // Try CSV as fallback
        console.warn(`   Unknown format '${detectedFormat}', trying CSV...`);
        result = await parseCsvSafe(rawData, config);
    }

    // Validate result
    if (!result || !result.rows) {
      throw Errors.emptyData();
    }

    return {
      ...result,
      metadata: {
        sourceType,
        format: detectedFormat,
        originalSize:
          typeof rawData === "string" ? rawData.length : rawData?.length || 0,
      },
    };
  } catch (error) {
    // Re-throw DataQualityErrors as-is
    if (error instanceof DataQualityError) {
      throw error;
    }
    // Wrap unexpected errors
    throw Errors.internal(error);
  }
}

/**
 * Fetch data from URL with retry and timeout
 */
async function fetchFromUrl(url, config) {
  // Handle Google Sheets URLs specially
  if (isGoogleSheetsUrl(url)) {
    url = getGoogleSheetsExportUrl(url, "csv");
    console.log(`   Converted to Google Sheets export URL`);
  }

  console.log(
    `   Fetching from: ${url.substring(0, 80)}${url.length > 80 ? "..." : ""}`
  );

  // Validate URL format
  try {
    new URL(url);
  } catch {
    throw Errors.invalidUrl(url);
  }

  const timeoutMs = config.fetchTimeout || 60000;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept:
              "text/csv, application/json, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, */*",
            "User-Agent": "Apify CSV Data Quality Checker",
          },
        });

        if (!res.ok) {
          throw Errors.fetchFailed(url, res.status, res.statusText);
        }

        return res;
      },
      { maxRetries: 3, baseDelayMs: 1000 }
    );

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type") || "";

    // For Excel files, return as ArrayBuffer
    if (contentType.includes("spreadsheet") || url.match(/\.xlsx?$/i)) {
      return Buffer.from(await response.arrayBuffer());
    }

    return response.text();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw Errors.timeout(url, timeoutMs);
    }
    if (error instanceof DataQualityError) {
      throw error;
    }
    throw Errors.networkError(error);
  }
}

/**
 * Detect format from URL extension
 */
function detectFormatFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split(".").pop()?.toLowerCase();
    const formatMap = {
      csv: "csv",
      xlsx: "xlsx",
      xls: "xls",
      json: "json",
      jsonl: "jsonl",
      ndjson: "jsonl",
    };
    return formatMap[extension] || "csv";
  } catch {
    return "csv";
  }
}

/**
 * Detect format from content
 */
function detectFormatFromContent(content) {
  if (!content || typeof content !== "string") {
    return "csv";
  }

  const trimmed = content.trim();

  // Empty content
  if (trimmed.length === 0) {
    return "csv";
  }

  // JSON array or object
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    // Check if it's JSONL (multiple lines of JSON)
    const lines = trimmed.split("\n").filter((l) => l.trim());
    if (lines.length > 1) {
      let jsonlCount = 0;
      for (const line of lines.slice(0, 5)) {
        try {
          JSON.parse(line.trim());
          jsonlCount++;
        } catch {
          break;
        }
      }
      if (jsonlCount >= 2) {
        return "jsonl";
      }
    }
    return "json";
  }

  // Check for Excel magic bytes in string (shouldn't happen, but handle it)
  if (trimmed.charCodeAt(0) === 0x50 && trimmed.charCodeAt(1) === 0x4b) {
    return "xlsx";
  }

  return "csv";
}

/**
 * Detect format from base64 decoded buffer
 */
function detectFormatFromBase64(buffer) {
  if (!buffer || buffer.length < 4) {
    return "xlsx";
  }

  // Check for ZIP magic bytes (xlsx files are ZIP archives)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return "xlsx";
  }

  // Check for OLE magic bytes (xls files)
  if (buffer[0] === 0xd0 && buffer[1] === 0xcf) {
    return "xls";
  }

  // Check for JSON
  const firstChar = String.fromCharCode(buffer[0]).trim();
  if (firstChar === "[" || firstChar === "{") {
    return "json";
  }

  return "xlsx";
}

/**
 * Parse CSV data with error handling
 */
async function parseCsvSafe(data, config) {
  const { csvDelimiter, hasHeader, encoding } = config;

  try {
    const parseConfig = {
      header: hasHeader !== false,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep as strings for consistent validation
      encoding: encoding || "utf-8",
    };

    // Auto-detect delimiter if needed
    if (csvDelimiter && csvDelimiter !== "auto") {
      parseConfig.delimiter = csvDelimiter;
    }

    const result = Papa.parse(data, parseConfig);

    // Handle parse errors
    if (result.errors.length > 0) {
      const criticalErrors = result.errors.filter(
        (e) => e.type === "Quotes" || e.type === "FieldMismatch"
      );

      if (
        criticalErrors.length > 0 &&
        (result.data.length === 0 ||
          criticalErrors.length > result.data.length * 0.5)
      ) {
        throw Errors.csvParseError(criticalErrors[0], criticalErrors[0].row);
      }

      console.warn(`   CSV parsing warnings: ${result.errors.length}`);
      result.errors
        .slice(0, 5)
        .forEach((e) => console.warn(`   - Row ${e.row}: ${e.message}`));
    }

    let headers;
    let rows;

    if (hasHeader !== false) {
      headers = result.meta.fields || [];
      rows = result.data;
    } else {
      const firstRow = result.data[0] || [];
      headers = Array.isArray(firstRow)
        ? firstRow.map((_, i) => `column_${i + 1}`)
        : Object.keys(firstRow);
      rows = result.data;
    }

    // Validate headers
    if (headers.length === 0 && rows.length > 0) {
      headers = Object.keys(rows[0] || {});
    }

    return { rows, headers };
  } catch (error) {
    if (error instanceof DataQualityError) {
      throw error;
    }
    throw Errors.csvParseError(error, null);
  }
}

/**
 * Parse Excel data with error handling (using ExcelJS)
 */
async function parseExcelSafe(data, config) {
  const { excelSheet, hasHeader } = config;

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data);

    if (!workbook.worksheets || workbook.worksheets.length === 0) {
      throw new Error("Excel file contains no sheets");
    }

    // Get sheet names
    const sheetNames = workbook.worksheets.map((ws) => ws.name);

    // Determine which sheet to use
    let worksheet;
    if (excelSheet) {
      worksheet = workbook.getWorksheet(excelSheet);
      if (!worksheet) {
        const index = parseInt(excelSheet, 10);
        if (!isNaN(index) && index >= 0 && index < workbook.worksheets.length) {
          worksheet = workbook.worksheets[index];
        } else {
          console.warn(`   Sheet '${excelSheet}' not found, using first sheet`);
        }
      }
    }

    if (!worksheet) {
      worksheet = workbook.worksheets[0];
    }

    console.log(`   Using Excel sheet: ${worksheet.name}`);

    if (worksheet.rowCount === 0) {
      return { rows: [], headers: [] };
    }

    // Extract data from worksheet
    const rows = [];
    let headers = [];
    let headerRowIndex = 1;

    worksheet.eachRow((row, rowNumber) => {
      const rowData = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let value = cell.value;
        // Handle different cell types
        if (value && typeof value === "object") {
          if (value.result !== undefined) value = value.result; // Formula
          else if (value.text) value = value.text; // Rich text
          else if (value instanceof Date) value = value.toISOString();
          else value = String(value);
        }
        rowData[colNumber - 1] = value;
      });

      if (hasHeader !== false && rowNumber === 1) {
        headers = rowData.map((h, i) =>
          h != null ? String(h) : `column_${i + 1}`
        );
        headerRowIndex = 1;
      } else {
        const obj = {};
        if (hasHeader !== false) {
          headers.forEach((h, i) => {
            obj[h] = rowData[i] ?? null;
          });
        } else {
          rowData.forEach((v, i) => {
            const colName = `column_${i + 1}`;
            if (!headers.includes(colName)) headers.push(colName);
            obj[colName] = v ?? null;
          });
        }
        rows.push(obj);
      }
    });

    return { rows, headers };
  } catch (error) {
    if (error instanceof DataQualityError) {
      throw error;
    }
    throw Errors.excelParseError(error);
  }
}

/**
 * Parse JSON data with error handling
 */
function parseJsonSafe(data, config) {
  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;

    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return { rows: [], headers: [] };
      }

      // Validate all items are objects
      const validRows = parsed.filter(
        (item) =>
          typeof item === "object" && item !== null && !Array.isArray(item)
      );

      if (validRows.length === 0) {
        throw new Error("JSON array does not contain valid objects");
      }

      const headers = Object.keys(validRows[0] || {});
      return { rows: validRows, headers };
    }

    if (parsed && typeof parsed === "object") {
      // Handle single object with data array
      if (parsed.data && Array.isArray(parsed.data)) {
        return parseJsonSafe(parsed.data, config);
      }

      // Handle single object - wrap in array
      const headers = Object.keys(parsed);
      return { rows: [parsed], headers };
    }

    throw new Error("JSON must be an array of objects or a single object");
  } catch (error) {
    if (error instanceof DataQualityError) {
      throw error;
    }
    throw Errors.jsonParseError(error);
  }
}

/**
 * Parse JSON Lines with error handling
 */
function parseJsonLinesSafe(data, config) {
  try {
    const lines = data.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      return { rows: [], headers: [] };
    }

    const rows = [];
    const parseErrors = [];

    lines.forEach((line, idx) => {
      try {
        const parsed = JSON.parse(line.trim());
        if (typeof parsed === "object" && parsed !== null) {
          rows.push(parsed);
        }
      } catch (error) {
        parseErrors.push({ line: idx + 1, error: error.message });
      }
    });

    if (parseErrors.length > 0) {
      console.warn(`   JSONL parse errors on ${parseErrors.length} lines`);
      if (parseErrors.length > lines.length * 0.5) {
        throw Errors.jsonParseError(
          new Error(
            `Too many parse errors (${parseErrors.length}/${lines.length})`
          )
        );
      }
    }

    if (rows.length === 0) {
      return { rows: [], headers: [] };
    }

    const headers = Object.keys(rows[0] || {});
    return { rows, headers };
  } catch (error) {
    if (error instanceof DataQualityError) {
      throw error;
    }
    throw Errors.jsonParseError(error);
  }
}
