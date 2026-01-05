/**
 * Quality Scorer
 * Calculates overall data quality score (0-100)
 */

/**
 * Calculate data quality score
 * @param {Object} validationResult - Validation results
 * @param {Object} profileResult - Profiling results
 * @param {number} totalRows - Total row count
 * @returns {Object} Quality scores
 */
export function calculateQualityScore(
  validationResult,
  profileResult,
  totalRows,
) {
  const { issues, issueBreakdown, columnTypes } = validationResult;
  const { columns } = profileResult;

  // 1. Completeness: % of non-null values
  let totalNulls = 0;
  let totalCells = 0;
  Object.values(columns).forEach((col) => {
    totalNulls += col.nullCount;
    totalCells += col.totalCount;
  });
  const completeness =
    totalCells > 0 ? (1 - totalNulls / totalCells) * 100 : 100;

  // 2. Validity: % of values passing type/constraint validation
  const typeAndConstraintIssues =
    (issueBreakdown.typeErrors || 0) +
    (issueBreakdown.constraintViolations || 0);
  const validity =
    totalCells > 0 ? (1 - typeAndConstraintIssues / totalCells) * 100 : 100;

  // 3. Uniqueness: Check columns marked as unique
  const uniqueColumns = Object.values(columnTypes).filter((c) => c.unique);
  let uniquenessScore = 100;
  if (uniqueColumns.length > 0) {
    const duplicateIssues = issueBreakdown.duplicates || 0;
    uniquenessScore =
      totalRows > 0 ? (1 - duplicateIssues / totalRows) * 100 : 100;
  }

  // 4. Consistency: Based on type consistency within columns
  let consistencyTotal = 0;
  let consistencyCount = 0;
  Object.values(columns).forEach((col) => {
    if (col.detectedType === "numeric" && col.numericStats) {
      // For numeric columns, check for outliers
      consistencyTotal +=
        100 - Math.min(((issueBreakdown.outliers || 0) / totalRows) * 100, 30);
    } else {
      consistencyTotal += 100; // Assume consistent if not flagged
    }
    consistencyCount++;
  });
  const consistency =
    consistencyCount > 0 ? consistencyTotal / consistencyCount : 100;

  // 5. Overall Score (weighted average)
  const weights = {
    completeness: 0.3,
    validity: 0.35,
    uniqueness: 0.15,
    consistency: 0.2,
  };

  const overall = Math.round(
    weights.completeness * completeness +
      weights.validity * validity +
      weights.uniqueness * uniquenessScore +
      weights.consistency * consistency,
  );

  return {
    overall: Math.max(0, Math.min(100, overall)),
    completeness: Math.round(Math.max(0, Math.min(100, completeness))),
    validity: Math.round(Math.max(0, Math.min(100, validity))),
    uniqueness: Math.round(Math.max(0, Math.min(100, uniquenessScore))),
    consistency: Math.round(Math.max(0, Math.min(100, consistency))),
    grade: getGrade(overall),
  };
}

/**
 * Get letter grade from score
 */
function getGrade(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
