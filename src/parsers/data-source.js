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
 * Determine data source type and return source info
 * @param {Object} input - Configuration object with data source fields
 * @returns {{sourceType: string, hasSource: boolean}}
 */
function determineDataSource(input) {
  const { dataSourceUrl, dataSourceInline, dataSourceBase64 } = input;
  if (dataSourceUrl) return { sourceType: "url", hasSource: true };
  if (dataSourceInline) return { sourceType: "inline", hasSource: true };
  if (dataSourceBase64) return { sourceType: "base64", hasSource: true };
  return { sourceType: "unknown", hasSource: false };
}

/**
 * Fetch raw data from URL or return inline data
 * (Base64 data is decoded separately)
 * @param {string} sourceType - 'url' or 'inline'
 * @param {Object} input - Input configuration
 * @returns {Promise<string|Buffer>} Raw data
 */
async function fetchRawData(sourceType, input) {
  const { dataSourceUrl, dataSourceInline } = input;
  switch (sourceType) {
    case "url":
      return fetchFromUrl(dataSourceUrl, input);
    case "inline":
      return dataSourceInline;
    default:
      throw Errors.internal(new Error(`Unsupported sourceType: ${sourceType}`));
  }
}

/**
 * Decode base64 data
 * @param {string} base64Data - Base64 encoded string
 * @returns {Buffer}
 */
function decodeRawData(base64Data) {
  try {
    return Buffer.from(base64Data, "base64");
  } catch (error) {
    throw Errors.invalidBase64(error);
  }
}

/**
 * Detect format based on source type and data
 * @param {string} sourceType - Type of data source
 * @param {Object} config - Configuration with format and source data
 * @param {string|Buffer} rawData - Raw data for format detection
 * @returns {string}
 */
function detectDataFormat(sourceType, config, rawData) {
  if (config.format && config.format !== "auto") {
    return config.format;
  }
  switch (sourceType) {
    case "url":
      return detectFormatFromUrl(config.dataSourceUrl);
    case "inline":
      return detectFormatFromContent(config.dataSourceInline);
    case "base64":
      return detectFormatFromBase64(rawData);
    default:
      return "csv";
  }
}

/**
 * Parse data from various sources (URL, inline, base64)
 * @param {Object} config - Actor input configuration
 * @returns {Promise<{rows: Array, headers: Array, metadata: Object}>}
 */
export async function parseDataSource(config) {
  try {
    // Step 1: Determine source
    const { sourceType, hasSource } = determineDataSource(config);
    if (!hasSource) {
      throw Errors.noDataSource();
    }

    // Step 2: Fetch or decode raw data
    let rawData;
    if (sourceType === "base64") {
      rawData = decodeRawData(config.dataSourceBase64);
    } else {
      rawData = await fetchRawData(sourceType, config);
    }

    // Step 3: Validate raw data
    if (
      !rawData ||
      (typeof rawData === "string" && rawData.trim().length === 0)
    ) {
      throw Errors.emptyData();
    }

    // Step 4: Detect format
    const detectedFormat = detectDataFormat(sourceType, config, rawData);
    console.log(`   Source type: ${sourceType}, Format: ${detectedFormat}`);

    // Step 5: Parse based on format
    const result = await parseByFormat(rawData, detectedFormat, config);

    // Step 6: Validate result
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
    if (error instanceof DataQualityError) {
      throw error;
    }
    throw Errors.internal(error);
  }
}

/**
 * Parse data by format type
 * @param {string|Buffer} rawData - Raw data to parse
 * @param {string} format - Detected format
 * @param {Object} config - Configuration
 * @returns {Promise<{rows: Array, headers: Array}>}
 */
async function parseByFormat(rawData, format, config) {
  switch (format) {
    case "csv":
      return parseCsvSafe(rawData, config);
    case "xlsx":
    case "xls":
      return parseExcelSafe(rawData, config);
    case "json":
      return parseJsonSafe(rawData, config);
    case "jsonl":
      return parseJsonLinesSafe(rawData, config);
    default:
      console.warn(`   Unknown format '${format}', trying CSV...`);
      return parseCsvSafe(rawData, config);
  }
}

/**
 * Fetch data from URL with retry and timeout
 */
async function fetchFromUrl(url, config) {
  // Handle Google Sheets URLs specially
  if (isGoogleSheetsUrl(url)) {
    const sheetId = config.googleSheetsId || null;
    url = getGoogleSheetsExportUrl(url, "csv", sheetId);
    console.log(
      `   Converted to Google Sheets export URL${
        sheetId ? ` (sheet: ${sheetId})` : ""
      }`
    );

    // If API key provided, append it
    if (config.googleSheetsApiKey) {
      const separator = url.includes("?") ? "&" : "?";
      url = `${url}${separator}key=${config.googleSheetsApiKey}`;
      console.log(`   Using Google Sheets API key for authentication`);
    }
  }

  const urlStr = typeof url === "string" ? url.trim() : String(url ?? "");
  console.log(
    `   Fetching from: ${urlStr.substring(0, 80)}${
      urlStr.length > 80 ? "..." : ""
    }`
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
    const contentDisposition =
      response.headers.get("content-disposition") || "";
    const finalUrl = response.url || url; // Get final URL after redirects

    // Determine if this is a binary file (Excel, Parquet, etc.)
    const isBinaryFile =
      contentType.includes("spreadsheet") ||
      contentType.includes("octet-stream") ||
      contentType.includes("vnd.ms-excel") ||
      contentType.includes("application/zip") ||
      finalUrl.match(/\.xlsx?$/i) ||
      url.match(/\.xlsx?$/i) ||
      contentDisposition.match(/\.xlsx?/i) ||
      config.format === "xlsx" ||
      config.format === "xls";

    // For binary files, return as Buffer
    if (isBinaryFile) {
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
    return "csv"; // Fallback to CSV for small buffers
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

  return "csv"; // Fallback to CSV as a safer default
}

/**
 * Assess CSV parse errors and separate critical errors from warnings
 * @param {Array} errors - Parse errors from Papa.parse
 * @param {number} dataLength - Number of data rows
 * @returns {{criticalErrors: Array, hasFatalErrors: boolean}}
 */
export function assessCsvErrors(errors, dataLength) {
  const criticalErrors = errors.filter(
    (e) => e.type === "Quotes" || e.type === "FieldMismatch"
  );
  // If no data was parsed and there are critical errors, treat as fatal
  // Use Math.max(1, ...) to avoid division issues with very small datasets
  const hasFatalErrors =
    criticalErrors.length > 0 &&
    (dataLength === 0 || criticalErrors.length > Math.max(1, dataLength * 0.5));
  return { criticalErrors, hasFatalErrors };
}

/**
 * Extract headers from parsed CSV result with defensive validation
 * @param {Object} result - Papa.parse result
 * @param {Object} config - Configuration with hasHeader option
 * @returns {{headers: Array, rows: Array}}
 */
function extractCsvHeaders(result, config) {
  const { hasHeader } = config;
  let headers;
  let rows = result.data;

  if (hasHeader !== false) {
    headers = result.meta.fields || [];
  } else {
    // Papa.parse returns arrays when header: false; normalize to objects for downstream validators
    const firstRow = Array.isArray(result.data[0]) ? result.data[0] : [];
    headers = firstRow.map((_, i) => `column_${i + 1}`);

    rows = result.data.map((r) => {
      if (!Array.isArray(r)) return r;
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = r[i];
      });
      return obj;
    });
  }

  // Validate headers - fallback extraction
  if (headers.length === 0 && rows.length > 0) {
    headers = Object.keys(rows[0] || {});
  }

  return { headers, rows };
}

/**
 * Parse CSV data with error handling
 */
async function parseCsvSafe(data, config) {
  const { csvDelimiter, hasHeader, encoding } = config;

  // Convert Buffer to string if needed (for base64 sources)
  const textData = Buffer.isBuffer(data)
    ? data.toString(encoding || "utf-8")
    : data;

  try {
    const parseConfig = {
      header: hasHeader !== false,
      skipEmptyLines: true,
      dynamicTyping: false,
      encoding: encoding || "utf-8",
    };

    if (csvDelimiter && csvDelimiter !== "auto") {
      parseConfig.delimiter = csvDelimiter;
    }

    const result = Papa.parse(textData, parseConfig);

    // Assess errors using helper
    if (result.errors.length > 0) {
      const { criticalErrors, hasFatalErrors } = assessCsvErrors(
        result.errors,
        result.data.length
      );

      if (hasFatalErrors) {
        throw Errors.csvParseError(criticalErrors[0], criticalErrors[0].row);
      }

      console.warn(`   CSV parsing warnings: ${result.errors.length}`);
      result.errors
        .slice(0, 5)
        .forEach((e) => console.warn(`   - Row ${e.row}: ${e.message}`));
    }

    // Extract headers using helper
    return extractCsvHeaders(result, config);
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
 * @param {string|Object} data - JSON string or already parsed object
 * @param {Object} [config={}] - Configuration options (optional, used for recursive calls when handling nested data arrays)
 * @returns {{rows: Array, headers: Array}}
 */
function parseJsonSafe(data, config = {}) {
  try {
    // Convert Buffer to string if needed (for base64 sources)
    const textData = Buffer.isBuffer(data) ? data.toString("utf-8") : data;
    const parsed =
      typeof textData === "string" ? JSON.parse(textData) : textData;

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
