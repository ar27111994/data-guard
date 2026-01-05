/**
 * Streaming Parser
 * Memory-efficient parsing for very large files
 */
import Papa from "papaparse";

/**
 * Stream parse large CSV files
 * @param {string} csvData - CSV data string
 * @param {Object} config - Parse configuration
 * @param {Function} onRow - Callback for each row
 * @param {Function} onComplete - Callback when complete
 */
export function streamParseCsv(csvData, config, onRow, onComplete) {
  let rowCount = 0;
  let headers = [];
  const errors = [];

  Papa.parse(csvData, {
    header: config.hasHeader !== false,
    delimiter: config.csvDelimiter === "auto" ? undefined : config.csvDelimiter,
    skipEmptyLines: true,
    dynamicTyping: false, // Keep as strings for consistent validation
    step: (result, parser) => {
      if (result.errors.length > 0) {
        errors.push(
          ...result.errors.map((e) => ({
            row: rowCount,
            ...e,
          })),
        );
      }

      if (rowCount === 0 && config.hasHeader !== false) {
        headers = result.meta.fields || [];
      }

      rowCount++;

      if (onRow) {
        const shouldContinue = onRow(result.data, rowCount, headers);
        if (shouldContinue === false) {
          parser.abort();
        }
      }

      // Memory pressure check every 10000 rows
      if (rowCount % 10000 === 0) {
        const memory = process.memoryUsage();
        if (memory.heapUsed > 400 * 1024 * 1024) {
          // 400MB threshold
          console.warn(
            `⚠️ High memory usage at row ${rowCount}. Consider using sampleSize.`,
          );
        }
      }
    },
    complete: () => {
      if (onComplete) {
        onComplete({
          rowCount,
          headers,
          errors,
        });
      }
    },
    error: (error) => {
      errors.push({ type: "parse_error", message: error.message });
      if (onComplete) {
        onComplete({ rowCount, headers, errors });
      }
    },
  });
}

/**
 * Batch processor for validation
 * Processes rows in batches to manage memory
 */
export class BatchProcessor {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 5000;
    this.maxMemoryMB = options.maxMemoryMB || 400;
    this.onBatch = options.onBatch || (() => {});
    this.onProgress = options.onProgress || (() => {});

    this.currentBatch = [];
    this.processedCount = 0;
    this.results = [];
  }

  addRow(row) {
    this.currentBatch.push(row);

    if (this.currentBatch.length >= this.batchSize) {
      return this.flushBatch();
    }

    return null;
  }

  async flushBatch() {
    if (this.currentBatch.length === 0) return null;

    const batchResults = await this.onBatch(
      this.currentBatch,
      this.processedCount,
    );
    this.processedCount += this.currentBatch.length;

    if (batchResults) {
      this.results.push(...batchResults);
    }

    this.onProgress(this.processedCount);

    // Clear batch
    this.currentBatch = [];

    // Check memory
    const memory = process.memoryUsage();
    if (memory.heapUsed / 1024 / 1024 > this.maxMemoryMB) {
      // Trim results if memory is high
      if (this.results.length > 10000) {
        console.warn(
          "⚠️ Memory pressure detected, trimming results to last 10000",
        );
        this.results = this.results.slice(-10000);
      }
    }

    return batchResults;
  }

  async finalize() {
    await this.flushBatch();
    return {
      totalProcessed: this.processedCount,
      results: this.results,
    };
  }
}

/**
 * Optimized duplicate detection for large datasets
 * Uses sampling for very large datasets
 */
export function detectDuplicatesOptimized(rows, keyColumns, options = {}) {
  const {
    maxExactRows = 100000,
    sampleSize = 10000,
    fuzzyEnabled = false,
  } = options;

  const issues = [];

  if (rows.length <= maxExactRows) {
    // Exact detection for smaller datasets
    return exactDuplicateDetection(rows, keyColumns);
  }

  // For large datasets, use hash buckets with sampling
  console.log(
    `   Large dataset (${rows.length} rows), using optimized duplicate detection`,
  );

  // Create hash index
  const hashMap = new Map();
  const bucketSize = 10000;

  for (let i = 0; i < rows.length; i++) {
    const key = keyColumns.map((c) => String(rows[i][c] ?? "")).join("|");
    const hash = simpleHash(key);
    const bucket = Math.floor(hash / bucketSize);

    if (!hashMap.has(bucket)) {
      hashMap.set(bucket, new Map());
    }

    const bucketMap = hashMap.get(bucket);
    if (!bucketMap.has(key)) {
      bucketMap.set(key, []);
    }
    bucketMap.get(key).push(i);
  }

  // Find duplicates
  let duplicateCount = 0;
  const maxIssues = options.maxIssuesPerType || 100;

  for (const [, bucketMap] of hashMap) {
    for (const [key, indices] of bucketMap) {
      if (indices.length > 1 && duplicateCount < maxIssues) {
        issues.push({
          type: "issue",
          issueType: "duplicate",
          severity: "warning",
          rowNumber: indices[1] + 1,
          column: keyColumns.join(" + "),
          value: key.substring(0, 50),
          message: `Duplicate of row ${indices[0] + 1}`,
          suggestion: "Review and remove duplicate entries",
          duplicateGroup: indices.map((i) => i + 1),
        });
        duplicateCount++;
      }
    }
  }

  return {
    issues,
    totalDuplicates: duplicateCount,
    method: "hash-bucketed",
  };
}

function exactDuplicateDetection(rows, keyColumns) {
  const seen = new Map();
  const issues = [];

  rows.forEach((row, idx) => {
    const key = keyColumns.map((c) => String(row[c] ?? "")).join("|");

    if (seen.has(key)) {
      issues.push({
        type: "issue",
        issueType: "duplicate",
        severity: "warning",
        rowNumber: idx + 1,
        column: keyColumns.join(" + "),
        value: key.substring(0, 50),
        message: `Duplicate of row ${seen.get(key) + 1}`,
        suggestion: "Review and remove duplicate entries",
      });
    } else {
      seen.set(key, idx);
    }
  });

  return { issues, totalDuplicates: issues.length, method: "exact" };
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export { simpleHash };
