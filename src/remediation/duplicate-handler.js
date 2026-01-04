/**
 * Advanced Duplicate Handler
 * Provides multiple strategies for handling duplicates
 */

/**
 * Duplicate handling strategies
 */
export const DUPLICATE_STRATEGIES = {
  FLAG: "flag", // Mark duplicates but keep all
  KEEP_FIRST: "keepFirst", // Keep first occurrence, remove others
  KEEP_LAST: "keepLast", // Keep last occurrence, remove others
  MERGE: "merge", // Merge duplicate rows (use non-null values)
  REMOVE_ALL: "removeAll", // Remove all duplicates including original
};

/**
 * Handle duplicates according to specified strategy
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Array} duplicateGroups - Groups of duplicate row indices
 * @param {string} strategy - Handling strategy
 * @param {Object} options - Additional options
 * @returns {Object} Result with processed rows and audit info
 */
export function handleDuplicates(
  rows,
  headers,
  duplicateGroups,
  strategy,
  options = {}
) {
  const result = {
    rows: [...rows],
    removed: [],
    merged: [],
    flagged: [],
    audit: [],
  };

  if (duplicateGroups.length === 0) {
    return result;
  }

  switch (strategy) {
    case DUPLICATE_STRATEGIES.FLAG:
      return flagDuplicates(result, duplicateGroups);

    case DUPLICATE_STRATEGIES.KEEP_FIRST:
      return keepFirst(result, duplicateGroups);

    case DUPLICATE_STRATEGIES.KEEP_LAST:
      return keepLast(result, duplicateGroups);

    case DUPLICATE_STRATEGIES.MERGE:
      return mergeDuplicates(result, headers, duplicateGroups, options);

    case DUPLICATE_STRATEGIES.REMOVE_ALL:
      return removeAllDuplicates(result, duplicateGroups);

    default:
      return flagDuplicates(result, duplicateGroups);
  }
}

/**
 * Flag duplicates without removing
 */
function flagDuplicates(result, duplicateGroups) {
  duplicateGroups.forEach((group) => {
    group.rowNumbers.forEach((rowNum, idx) => {
      if (idx > 0) {
        // Skip first (original)
        result.flagged.push(rowNum);
        if (result.rows[rowNum - 1]) {
          result.rows[rowNum - 1]._isDuplicate = true;
          result.rows[rowNum - 1]._duplicateOf = group.rowNumbers[0];
        }
      }
    });
  });

  result.audit.push({
    action: "FLAG_DUPLICATES",
    count: result.flagged.length,
    message: `Flagged ${result.flagged.length} duplicate rows`,
  });

  return result;
}

/**
 * Keep first occurrence, remove others
 */
function keepFirst(result, duplicateGroups) {
  const toRemove = new Set();

  duplicateGroups.forEach((group) => {
    // Remove all but first
    group.rowNumbers.slice(1).forEach((rowNum) => {
      toRemove.add(rowNum - 1); // Convert to 0-indexed
    });
  });

  result.removed = [...toRemove].sort((a, b) => b - a); // Sort descending for removal
  result.rows = result.rows.filter((_, idx) => !toRemove.has(idx));

  result.audit.push({
    action: "KEEP_FIRST",
    removed: result.removed.length,
    message: `Removed ${result.removed.length} duplicate rows, kept first occurrence`,
  });

  return result;
}

/**
 * Keep last occurrence, remove others
 */
function keepLast(result, duplicateGroups) {
  const toRemove = new Set();

  duplicateGroups.forEach((group) => {
    // Remove all but last
    group.rowNumbers.slice(0, -1).forEach((rowNum) => {
      toRemove.add(rowNum - 1);
    });
  });

  result.removed = [...toRemove].sort((a, b) => b - a);
  result.rows = result.rows.filter((_, idx) => !toRemove.has(idx));

  result.audit.push({
    action: "KEEP_LAST",
    removed: result.removed.length,
    message: `Removed ${result.removed.length} duplicate rows, kept last occurrence`,
  });

  return result;
}

/**
 * Merge duplicate rows (combine non-null values)
 */
function mergeDuplicates(result, headers, duplicateGroups, options = {}) {
  const { preferFirst = true } = options;
  const toRemove = new Set();

  duplicateGroups.forEach((group) => {
    const targetIdx = preferFirst
      ? group.rowNumbers[0] - 1
      : group.rowNumbers[group.rowNumbers.length - 1] - 1;
    const targetRow = result.rows[targetIdx];

    // Merge values from other duplicates
    group.rowNumbers.forEach((rowNum, idx) => {
      if (rowNum - 1 === targetIdx) return;

      const sourceRow = result.rows[rowNum - 1];
      if (!sourceRow) return;

      // For each header, fill in null values from source
      headers.forEach((header) => {
        const targetVal = targetRow[header];
        const sourceVal = sourceRow[header];

        if (
          (targetVal === null || targetVal === undefined || targetVal === "") &&
          sourceVal !== null &&
          sourceVal !== undefined &&
          sourceVal !== ""
        ) {
          targetRow[header] = sourceVal;
        }
      });

      toRemove.add(rowNum - 1);
    });

    result.merged.push({
      targetRow: targetIdx + 1,
      mergedFrom: group.rowNumbers.filter((r) => r - 1 !== targetIdx),
    });
  });

  result.removed = [...toRemove].sort((a, b) => b - a);
  result.rows = result.rows.filter((_, idx) => !toRemove.has(idx));

  result.audit.push({
    action: "MERGE_DUPLICATES",
    merged: result.merged.length,
    removed: result.removed.length,
    message: `Merged ${result.merged.length} duplicate groups, removed ${result.removed.length} rows`,
  });

  return result;
}

/**
 * Remove all duplicates including original
 */
function removeAllDuplicates(result, duplicateGroups) {
  const toRemove = new Set();

  duplicateGroups.forEach((group) => {
    group.rowNumbers.forEach((rowNum) => {
      toRemove.add(rowNum - 1);
    });
  });

  result.removed = [...toRemove].sort((a, b) => b - a);
  result.rows = result.rows.filter((_, idx) => !toRemove.has(idx));

  result.audit.push({
    action: "REMOVE_ALL_DUPLICATES",
    removed: result.removed.length,
    message: `Removed all ${result.removed.length} duplicated rows (including originals)`,
  });

  return result;
}

/**
 * Find duplicate groups from rows
 */
export function findDuplicateGroups(rows, keyColumns) {
  const groups = new Map();

  rows.forEach((row, idx) => {
    const key = keyColumns.map((col) => String(row[col] ?? "")).join("|");

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(idx + 1); // 1-indexed row numbers
  });

  // Return only groups with duplicates
  return Array.from(groups.entries())
    .filter(([, indices]) => indices.length > 1)
    .map(([key, rowNumbers]) => ({
      key,
      rowNumbers,
      count: rowNumbers.length,
    }));
}
