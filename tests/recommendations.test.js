/**
 * Recommendations Engine Tests
 * Tests recommendation generation based on data quality issues
 */

describe("Recommendations Engine", () => {
  describe("Data Type Recommendations", () => {
    test("recommends fixing type mismatches", () => {
      const issues = [
        { issueType: "type-mismatch", column: "age" },
        { issueType: "type-mismatch", column: "age" },
      ];

      const recommendations = generateRecommendations({ issues });
      expect(
        recommendations.some(
          (r) => r.category === "type" || r.description.includes("type")
        )
      ).toBe(true);
    });
  });

  describe("Missing Value Recommendations", () => {
    test("recommends handling missing values", () => {
      const issues = [
        { issueType: "null", column: "email" },
        { issueType: "missing", column: "email" },
      ];

      const recommendations = generateRecommendations({ issues });
      expect(
        recommendations.some(
          (r) =>
            r.description.includes("missing") || r.description.includes("null")
        )
      ).toBe(true);
    });
  });

  describe("Duplicate Recommendations", () => {
    test("recommends removing duplicates", () => {
      const issues = [
        { issueType: "duplicate", column: "id" },
        { issueType: "duplicate", column: "id" },
      ];

      const recommendations = generateRecommendations({ issues });
      expect(
        recommendations.some((r) => r.description.includes("duplicate"))
      ).toBe(true);
    });
  });

  describe("Outlier Recommendations", () => {
    test("recommends investigating outliers", () => {
      const issues = [{ issueType: "outlier", column: "salary" }];

      const recommendations = generateRecommendations({ issues });
      expect(
        recommendations.some((r) => r.description.includes("outlier"))
      ).toBe(true);
    });
  });

  describe("Priority and Severity", () => {
    test("prioritizes critical issues", () => {
      const issues = [
        { issueType: "type-mismatch", severity: "error" },
        { issueType: "null", severity: "warning" },
      ];

      const recommendations = generateRecommendations({ issues });
      expect(recommendations[0].priority).toBeGreaterThanOrEqual(
        recommendations[recommendations.length - 1].priority
      );
    });
  });

  describe("Edge Cases", () => {
    test("handles empty validation result", () => {
      const recommendations = generateRecommendations({ issues: [] });
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    test("handles null inputs gracefully", () => {
      expect(() => generateRecommendations(null)).not.toThrow();
    });

    test("limits number of recommendations", () => {
      const issues = Array(100).fill({
        issueType: "type-mismatch",
        column: "col",
      });
      const recommendations = generateRecommendations({ issues });
      expect(recommendations.length).toBeLessThanOrEqual(20);
    });
  });
});

// Self-contained implementation
function generateRecommendations(validationResult) {
  if (!validationResult) return [];

  const { issues = [] } = validationResult;
  const recommendations = [];
  const issueTypes = {};

  // Count by type
  issues.forEach((i) => {
    issueTypes[i.issueType] = (issueTypes[i.issueType] || 0) + 1;
  });

  // Generate recommendations
  if (issueTypes["type-mismatch"]) {
    recommendations.push({
      category: "type",
      priority: 3,
      description: `Fix ${issueTypes["type-mismatch"]} type mismatch errors in your data`,
      action: "Review data types and convert values to expected types",
    });
  }

  if (issueTypes["null"] || issueTypes["missing"]) {
    const count = (issueTypes["null"] || 0) + (issueTypes["missing"] || 0);
    recommendations.push({
      category: "completeness",
      priority: 2,
      description: `Handle ${count} missing or null values`,
      action: "Fill with defaults, impute, or mark as required",
    });
  }

  if (issueTypes["duplicate"]) {
    recommendations.push({
      category: "uniqueness",
      priority: 2,
      description: `Remove ${issueTypes["duplicate"]} duplicate records`,
      action: "Use removeDuplicates cleaning action",
    });
  }

  if (issueTypes["outlier"]) {
    recommendations.push({
      category: "consistency",
      priority: 1,
      description: `Investigate ${issueTypes["outlier"]} outlier values`,
      action: "Review for data entry errors or legitimate extreme values",
    });
  }

  // Sort by priority and limit
  return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 20);
}
