/**
 * Parquet File Parser
 * Parse Apache Parquet files for data validation
 * Uses parquetjs-lite for Node.js compatibility
 */

import { DataQualityError, Errors } from "../utils/error-handler.js";

/**
 * Check if data is Parquet format (by magic bytes)
 * @param {Buffer} buffer - Data buffer
 * @returns {boolean} True if Parquet
 */
export function isParquetData(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return false;
  }

  // Parquet magic bytes: PAR1
  const magic = buffer.slice(0, 4).toString("ascii");
  return magic === "PAR1";
}

/**
 * Parse Parquet file from buffer
 * Note: Requires parquetjs package to be installed
 * @param {Buffer} buffer - Parquet file buffer
 * @param {Object} config - Parse configuration
 * @returns {Promise<Object>} Parsed data
 */
export async function parseParquet(buffer, config = {}) {
  const { maxRows = 100000, selectedColumns = null } = config;

  // Attempt to dynamically import parquetjs
  let parquet;
  try {
    parquet = await import("parquetjs-lite");
  } catch (importError) {
    // Try alternative package
    try {
      parquet = await import("parquetjs");
    } catch {
      throw new DataQualityError(
        "Parquet parsing requires the parquetjs-lite or parquetjs package. Install with: npm install parquetjs-lite",
        "PARQUET_PACKAGE_MISSING",
        { suggestion: "npm install parquetjs-lite" }
      );
    }
  }

  try {
    // Write buffer to temp file for parquetjs
    const fs = await import("fs/promises");
    const path = await import("path");
    const os = await import("os");

    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `parquet_${Date.now()}.parquet`);

    await fs.writeFile(tempFile, buffer);

    try {
      // Open and read parquet file
      const reader = await parquet.ParquetReader.openFile(tempFile);
      const cursor = reader.getCursor(selectedColumns);

      const rows = [];
      let record;

      while ((record = await cursor.next()) && rows.length < maxRows) {
        rows.push(record);
      }

      // Get schema info
      const schema = reader.getSchema();
      const headers = Object.keys(schema.fields || schema);

      await reader.close();

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {});

      return {
        rows,
        headers,
        metadata: {
          format: "parquet",
          totalRows: rows.length,
          columnCount: headers.length,
          schema: extractSchemaInfo(schema),
          truncated: rows.length >= maxRows,
        },
      };
    } finally {
      // Ensure cleanup
      await fs.unlink(tempFile).catch(() => {});
    }
  } catch (error) {
    if (error instanceof DataQualityError) throw error;

    throw new DataQualityError(
      `Failed to parse Parquet file: ${error.message}`,
      "PARQUET_PARSE_ERROR",
      { originalError: error.message }
    );
  }
}

/**
 * Extract schema information from Parquet schema
 * @param {Object} schema - Parquet schema object
 * @returns {Object} Simplified schema info
 */
function extractSchemaInfo(schema) {
  const fields = schema.fields || schema;
  const schemaInfo = {};

  for (const [name, field] of Object.entries(fields)) {
    schemaInfo[name] = {
      type: mapParquetType(field.originalType || field.type),
      nullable: field.repetitionType !== "REQUIRED",
      originalType: field.originalType,
    };
  }

  return schemaInfo;
}

/**
 * Map Parquet type to our standard types
 * @param {string} parquetType - Parquet type
 * @returns {string} Standard type
 */
function mapParquetType(parquetType) {
  const typeMap = {
    INT32: "integer",
    INT64: "integer",
    INT96: "integer",
    FLOAT: "float",
    DOUBLE: "float",
    BYTE_ARRAY: "string",
    FIXED_LEN_BYTE_ARRAY: "string",
    BOOLEAN: "boolean",
    UTF8: "string",
    DATE: "date",
    TIME_MILLIS: "time",
    TIME_MICROS: "time",
    TIMESTAMP_MILLIS: "datetime",
    TIMESTAMP_MICROS: "datetime",
    DECIMAL: "decimal",
    JSON: "json",
    ENUM: "enum",
    LIST: "array",
    MAP: "object",
  };

  return typeMap[parquetType] || "string";
}

/**
 * Get Parquet file metadata without reading all data
 * @param {Buffer} buffer - Parquet file buffer
 * @returns {Promise<Object>} File metadata
 */
export async function getParquetMetadata(buffer) {
  // For now, return basic info from buffer
  // Full metadata requires parsing with parquetjs

  if (!isParquetData(buffer)) {
    throw new DataQualityError(
      "Not a valid Parquet file",
      "INVALID_PARQUET_FILE"
    );
  }

  return {
    format: "parquet",
    isValid: true,
    sizeBytes: buffer.length,
    // Additional metadata would require parquetjs parsing
  };
}

/**
 * Validate Parquet file structure
 * @param {Buffer} buffer - Parquet file buffer
 * @returns {Object} Validation result
 */
export function validateParquetStructure(buffer) {
  const errors = [];
  const warnings = [];

  // Check magic bytes at start
  if (buffer.length < 4) {
    errors.push("File too small to be a valid Parquet file");
    return { valid: false, errors, warnings };
  }

  const startMagic = buffer.slice(0, 4).toString("ascii");
  if (startMagic !== "PAR1") {
    errors.push(`Invalid start magic bytes: expected PAR1, got ${startMagic}`);
  }

  // Check magic bytes at end
  if (buffer.length >= 8) {
    const endMagic = buffer.slice(-4).toString("ascii");
    if (endMagic !== "PAR1") {
      errors.push(`Invalid end magic bytes: expected PAR1, got ${endMagic}`);
    }
  }

  // Check minimum size
  if (buffer.length < 100) {
    warnings.push("File size is unusually small for a Parquet file");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Convert rows to Parquet format and write to buffer
 * Note: Requires parquetjs package
 * @param {Array<Object>} rows - Data rows
 * @param {Array<string>} headers - Column headers
 * @param {Object} options - Write options
 * @returns {Promise<Buffer>} Parquet buffer
 */
export async function writeParquet(rows, headers, options = {}) {
  let parquet;
  try {
    parquet = await import("parquetjs-lite");
  } catch {
    try {
      parquet = await import("parquetjs");
    } catch {
      throw new DataQualityError(
        "Parquet writing requires the parquetjs-lite or parquetjs package",
        "PARQUET_PACKAGE_MISSING"
      );
    }
  }

  const fs = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");

  // Infer schema from data
  const schemaFields = {};
  for (const header of headers) {
    schemaFields[header] = inferParquetType(rows, header);
  }

  const schema = new parquet.ParquetSchema(schemaFields);
  const tempFile = path.join(os.tmpdir(), `parquet_out_${Date.now()}.parquet`);

  try {
    const writer = await parquet.ParquetWriter.openFile(schema, tempFile);

    for (const row of rows) {
      await writer.appendRow(row);
    }

    await writer.close();

    const buffer = await fs.readFile(tempFile);
    await fs.unlink(tempFile).catch(() => {});

    return buffer;
  } finally {
    await fs.unlink(tempFile).catch(() => {});
  }
}

/**
 * Infer Parquet type from data
 * @param {Array<Object>} rows - Data rows
 * @param {string} column - Column name
 * @returns {Object} Parquet type definition
 */
function inferParquetType(rows, column) {
  const values = rows
    .slice(0, 100)
    .map((r) => r[column])
    .filter((v) => v !== null && v !== undefined);

  if (values.length === 0) {
    return { type: "UTF8", optional: true };
  }

  // Check types
  const isNumber = values.every((v) => !isNaN(Number(v)));
  const isInteger =
    isNumber && values.every((v) => Number.isInteger(Number(v)));
  const isBoolean = values.every(
    (v) => v === true || v === false || v === "true" || v === "false"
  );

  if (isBoolean) {
    return { type: "BOOLEAN", optional: true };
  }
  if (isInteger) {
    return { type: "INT64", optional: true };
  }
  if (isNumber) {
    return { type: "DOUBLE", optional: true };
  }

  return { type: "UTF8", optional: true };
}
