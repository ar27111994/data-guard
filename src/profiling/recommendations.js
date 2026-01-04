/**
 * Recommendations Engine
 * Generates actionable recommendations based on validation results
 */

/**
 * Generate recommendations based on validation results
 * @param {Object} validationResult - Validation results
 * @param {Object} profileResult - Profiling results
 * @param {Object} qualityScore - Quality scores
 * @param {Object} config - Configuration
 * @returns {Array} List of recommendations
 */
export function generateRecommendations(
  validationResult,
  profileResult,
  qualityScore,
  config
) {
  const recommendations = [];

  const { issues, issueBreakdown, columnTypes } = validationResult;
  const { columns } = profileResult;

  // 1. Completeness recommendations
  if (qualityScore.completeness < 90) {
    const nullColumns = Object.entries(columns)
      .filter(([, col]) => parseFloat(col.nullPercent) > 10)
      .map(([name, col]) => `${name} (${col.nullPercent}% null)`);

    if (nullColumns.length > 0) {
      recommendations.push({
        priority: "high",
        category: "completeness",
        title: "Address Missing Values",
        description: `${
          nullColumns.length
        } column(s) have >10% missing values: ${nullColumns
          .slice(0, 3)
          .join(", ")}${nullColumns.length > 3 ? "..." : ""}`,
        action:
          "Consider implementing data collection improvements or use imputation strategies (mean, median, mode)",
        impact: `Could improve completeness score from ${qualityScore.completeness}% to ~95%`,
      });
    }
  }

  // 2. Type consistency recommendations
  if (issueBreakdown.typeErrors > 0) {
    const typeErrorRate = (
      (issueBreakdown.typeErrors / Object.keys(columns).length) *
      100
    ).toFixed(1);
    recommendations.push({
      priority: "high",
      category: "validity",
      title: "Fix Type Mismatches",
      description: `Found ${issueBreakdown.typeErrors} type validation errors`,
      action: "Clean or transform values to match expected column types",
      impact: `Could improve validity score by eliminating ${typeErrorRate}% of issues`,
    });
  }

  // 3. Duplicate recommendations
  if (issueBreakdown.duplicates > 0) {
    recommendations.push({
      priority: "medium",
      category: "uniqueness",
      title: "Review Duplicate Records",
      description: `Detected ${issueBreakdown.duplicates} duplicate or near-duplicate rows`,
      action: "Investigate duplicates - merge, remove, or mark as intentional",
      impact: `Removing duplicates could reduce dataset size and improve data quality`,
    });
  }

  // 4. Outlier recommendations
  if (issueBreakdown.outliers > 0) {
    recommendations.push({
      priority: "medium",
      category: "accuracy",
      title: "Investigate Outliers",
      description: `Found ${issueBreakdown.outliers} statistical outliers`,
      action:
        "Review outliers - they may be errors, edge cases, or valid extreme values",
      impact: `Addressing outliers improves statistical analysis reliability`,
    });
  }

  // 5. Schema recommendations
  const lowCardinalityColumns = Object.entries(columns)
    .filter(([, col]) => {
      const uniqueRatio = col.uniqueCount / col.totalCount;
      return uniqueRatio < 0.05 && col.uniqueCount > 1 && col.uniqueCount <= 20;
    })
    .map(([name]) => name);

  if (lowCardinalityColumns.length > 0) {
    recommendations.push({
      priority: "low",
      category: "schema",
      title: "Consider Enum Constraints",
      description: `Columns with low cardinality detected: ${lowCardinalityColumns
        .slice(0, 3)
        .join(", ")}`,
      action: "Add allowedValues constraints to enforce valid values",
      impact: "Prevents invalid categorical data from entering the dataset",
    });
  }

  // 6. PII recommendations
  if (config.detectPII) {
    recommendations.push({
      priority: "high",
      category: "compliance",
      title: "Review PII Handling",
      description:
        "PII detection was enabled - check findings for sensitive data",
      action: "Mask, encrypt, or remove PII as required by GDPR/CCPA",
      impact: "Ensures regulatory compliance and reduces data breach risk",
    });
  }

  // 7. Performance recommendations for large datasets
  const totalRows = Object.values(columns)[0]?.totalCount || 0;
  if (totalRows > 100000) {
    recommendations.push({
      priority: "low",
      category: "performance",
      title: "Enable Sampling for Large Datasets",
      description: `Dataset has ${totalRows.toLocaleString()} rows`,
      action: "Use sampleSize option for faster validation on subsequent runs",
      impact: "Reduces processing time while maintaining statistical validity",
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return recommendations;
}
