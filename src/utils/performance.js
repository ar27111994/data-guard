/**
 * Performance Utilities
 * Memory-efficient processing and performance optimizations
 */

/**
 * Memory-efficient chunk processor
 * Processes large arrays in chunks to prevent memory exhaustion
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each chunk
 * @param {number} chunkSize - Size of each chunk (default: 10000)
 */
export async function processInChunks(items, processor, chunkSize = 10000) {
  const results = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResult = await processor(chunk, i);

    if (chunkResult !== undefined) {
      if (Array.isArray(chunkResult)) {
        results.push(...chunkResult);
      } else {
        results.push(chunkResult);
      }
    }

    // Allow garbage collection between chunks
    if (global.gc && i % (chunkSize * 5) === 0) {
      global.gc();
    }
  }

  return results;
}

/**
 * Streaming row processor for very large files
 * Uses generator pattern for memory efficiency
 * @param {Array} rows - Data rows
 * @param {Function} processor - Function to process each row
 * @param {Object} options - Processing options
 */
export async function* streamProcess(rows, processor, options = {}) {
  const { batchSize = 1000, onProgress = null } = options;
  let processed = 0;

  for (let i = 0; i < rows.length; i++) {
    const result = await processor(rows[i], i);
    if (result !== undefined) {
      yield result;
    }

    processed++;
    if (onProgress && processed % batchSize === 0) {
      onProgress(processed, rows.length);
    }
  }
}

/**
 * Memory-optimized duplicate detection using bloom filter concept
 * For very large datasets where exact detection would exhaust memory
 * @param {Array} rows - Data rows
 * @param {Array} keyColumns - Columns to check
 * @param {number} threshold - Approximate threshold for bloom filter
 */
export function createHashIndex(rows, keyColumns, threshold = 1000000) {
  // For datasets under threshold, use exact Map
  if (rows.length < threshold) {
    const index = new Map();
    rows.forEach((row, idx) => {
      const key = keyColumns.map((c) => String(row[c] ?? "")).join("|");
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push(idx);
    });
    return { type: "exact", index };
  }

  // For very large datasets, use hash buckets
  const bucketCount = Math.ceil(rows.length / 1000);
  const buckets = new Array(bucketCount).fill(null).map(() => new Map());

  rows.forEach((row, idx) => {
    const key = keyColumns.map((c) => String(row[c] ?? "")).join("|");
    const hash = simpleHash(key) % bucketCount;
    if (!buckets[hash].has(key)) {
      buckets[hash].set(key, []);
    }
    buckets[hash].get(key).push(idx);
  });

  return { type: "bucketed", buckets, bucketCount };
}

/**
 * Simple hash function for string keys
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  constructor() {
    this.timings = {};
    this.startTimes = {};
  }

  start(label) {
    this.startTimes[label] = process.hrtime.bigint();
  }

  end(label) {
    if (this.startTimes[label]) {
      const elapsed =
        Number(process.hrtime.bigint() - this.startTimes[label]) / 1e6;
      this.timings[label] = elapsed;
      delete this.startTimes[label];
      return elapsed;
    }
    return 0;
  }

  getReport() {
    return { ...this.timings };
  }
}

/**
 * Estimate memory usage of data
 */
export function estimateMemoryUsage(rows, headers) {
  if (!rows || rows.length === 0) return { bytes: 0, formatted: "0 B" };

  // Sample first 100 rows to estimate
  const sampleSize = Math.min(100, rows.length);
  let totalBytes = 0;

  for (let i = 0; i < sampleSize; i++) {
    const row = rows[i];
    headers.forEach((h) => {
      const val = row[h];
      if (typeof val === "string") {
        totalBytes += val.length * 2; // UTF-16
      } else if (typeof val === "number") {
        totalBytes += 8;
      } else {
        totalBytes += 4;
      }
    });
  }

  const estimatedTotal = (totalBytes / sampleSize) * rows.length;

  return {
    bytes: Math.round(estimatedTotal),
    formatted: formatBytes(estimatedTotal),
    perRow: Math.round(totalBytes / sampleSize),
  };
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Check if we're approaching memory limits
 */
export function checkMemoryPressure() {
  const used = process.memoryUsage();
  const heapUsedMB = used.heapUsed / 1024 / 1024;
  const heapTotalMB = used.heapTotal / 1024 / 1024;
  const heapLimit = 512; // Conservative limit for Apify

  return {
    heapUsedMB: Math.round(heapUsedMB),
    heapTotalMB: Math.round(heapTotalMB),
    heapLimit,
    usagePercent: Math.round((heapUsedMB / heapLimit) * 100),
    isHighPressure: heapUsedMB > heapLimit * 0.8,
    isCritical: heapUsedMB > heapLimit * 0.95,
  };
}

export { simpleHash, formatBytes };
