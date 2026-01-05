/**
 * Duplicate Detector
 * Detects exact and fuzzy duplicates in data
 */
import { distance } from "fastest-levenshtein";

/**
 * Detect duplicate rows
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} config - Validation config
 * @returns {Array} Duplicate issues
 */
export function detectDuplicates(rows, headers, config) {
  const issues = [];
  const { duplicateColumns, fuzzyDuplicates, fuzzySimilarityThreshold } =
    config;
  const maxIssues = config.maxIssuesPerType || 100;

  // Determine which columns to check
  const columnsToCheck =
    duplicateColumns && duplicateColumns.length > 0
      ? duplicateColumns.filter((c) => headers.includes(c))
      : headers;

  if (columnsToCheck.length === 0) {
    return issues;
  }

  // Build row signatures for comparison
  const signatures = rows.map((row, index) => ({
    index,
    signature: columnsToCheck.map((col) => String(row[col] ?? "")).join("|"),
    row,
  }));

  // Exact duplicate detection
  const seenSignatures = new Map();
  const exactDuplicateGroups = [];

  signatures.forEach(({ index, signature }) => {
    if (seenSignatures.has(signature)) {
      const originalIndex = seenSignatures.get(signature);
      exactDuplicateGroups.push({
        original: originalIndex,
        duplicate: index,
        signature,
      });
    } else {
      seenSignatures.set(signature, index);
    }
  });

  // Add exact duplicate issues
  exactDuplicateGroups
    .slice(0, maxIssues)
    .forEach(({ original, duplicate, signature }) => {
      issues.push({
        rowNumber: duplicate + 1,
        column: columnsToCheck.join(", "),
        value: signature.substring(0, 100),
        issueType: "duplicate",
        severity: "warning",
        message: `Exact duplicate of row ${original + 1}`,
        suggestion: "Consider removing or merging duplicate rows",
      });
    });

  // Fuzzy duplicate detection (if enabled and not too many rows)
  if (fuzzyDuplicates && rows.length <= 10000) {
    const fuzzyIssues = detectFuzzyDuplicates(
      signatures,
      columnsToCheck,
      fuzzySimilarityThreshold,
      maxIssues - issues.length,
    );
    issues.push(...fuzzyIssues);
  }

  return issues;
}

/**
 * Detect fuzzy (near) duplicates using Levenshtein distance
 */
function detectFuzzyDuplicates(
  signatures,
  columnsToCheck,
  threshold,
  maxIssues,
) {
  const issues = [];
  const reported = new Set();

  // Compare each pair (O(n²) - only for smaller datasets)
  const limit = Math.min(signatures.length, 1000); // Limit for performance

  for (let i = 0; i < limit && issues.length < maxIssues; i++) {
    for (let j = i + 1; j < limit && issues.length < maxIssues; j++) {
      const sig1 = signatures[i].signature;
      const sig2 = signatures[j].signature;

      // Skip if already exact duplicate
      if (sig1 === sig2) continue;

      // Calculate similarity
      const maxLen = Math.max(sig1.length, sig2.length);
      if (maxLen === 0) continue;

      const dist = distance(sig1, sig2);
      const similarity = 1 - dist / maxLen;

      if (similarity >= threshold) {
        const key = `${i}-${j}`;
        if (!reported.has(key)) {
          reported.add(key);
          issues.push({
            rowNumber: j + 1,
            column: columnsToCheck.join(", "),
            value: `Similarity: ${(similarity * 100).toFixed(1)}%`,
            issueType: "fuzzy-duplicate",
            severity: "info",
            message: `Similar to row ${i + 1} (${(similarity * 100).toFixed(
              1,
            )}% match)`,
            suggestion: "Review if these rows should be merged or deduplicated",
          });
        }
      }
    }
  }

  return issues;
}
