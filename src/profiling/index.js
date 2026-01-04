/**
 * Profiling Index
 * Data profiling and statistics generation
 */
import { profileColumn } from "./column-profiler.js";
import { calculateQualityScore } from "./quality-scorer.js";

/**
 * Profile all data columns
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} config - Configuration
 * @returns {Object} Profiling results
 */
export async function profileData(rows, headers, config) {
  const columns = {};

  headers.forEach((header) => {
    const values = rows.map((row) => row[header]);
    columns[header] = profileColumn(header, values);
  });

  return { columns };
}

export { profileColumn } from "./column-profiler.js";
export { calculateQualityScore } from "./quality-scorer.js";
