/**
 * Quality Scorer Tests
 * Tests quality score calculation across all dimensions
 */

describe("Quality Scorer", () => {
  describe("Overall Score Calculation", () => {
    test("returns 100 for perfect data", () => {
      const validation = { issues: [], issueBreakdown: {} };
      const score = calculateQualityScore(validation, 100);
      expect(score.overall).toBe(100);
    });

    test("returns lower score for data with issues", () => {
      const validation = {
        issues: Array(10).fill({}),
        issueBreakdown: { typeErrors: 5, missingValues: 3, duplicates: 2 },
      };
      const score = calculateQualityScore(validation, 100);
      expect(score.overall).toBeLessThan(100);
    });

    test("score never goes below 0", () => {
      const validation = {
        issues: Array(1000).fill({}),
        issueBreakdown: { typeErrors: 500, missingValues: 500 },
      };
      const score = calculateQualityScore(validation, 100);
      expect(score.overall).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Component Scores", () => {
    test("calculates completeness score", () => {
      const validation = {
        issues: [],
        issueBreakdown: { missingValues: 10 },
      };
      const score = calculateQualityScore(validation, 100);
      expect(score.completeness).toBeLessThan(100);
    });

    test("calculates validity score", () => {
      const validation = {
        issues: [],
        issueBreakdown: { typeErrors: 5 },
      };
      const score = calculateQualityScore(validation, 100);
      expect(score.validity).toBeLessThan(100);
    });

    test("calculates uniqueness score", () => {
      const validation = {
        issues: [],
        issueBreakdown: { duplicates: 5 },
      };
      const score = calculateQualityScore(validation, 100);
      expect(score.uniqueness).toBeLessThan(100);
    });
  });

  describe("Grade Assignment", () => {
    const gradeTests = [
      { score: 100, expected: "A" },
      { score: 95, expected: "A" },
      { score: 90, expected: "A" },
      { score: 89, expected: "B" },
      { score: 80, expected: "B" },
      { score: 79, expected: "C" },
      { score: 70, expected: "C" },
      { score: 69, expected: "D" },
      { score: 60, expected: "D" },
      { score: 59, expected: "F" },
      { score: 0, expected: "F" },
    ];

    gradeTests.forEach(({ score, expected }) => {
      test(`score ${score} gets grade ${expected}`, () => {
        expect(getGrade(score)).toBe(expected);
      });
    });
  });

  describe("Edge Cases", () => {
    test("handles zero rows", () => {
      const validation = { issues: [], issueBreakdown: {} };
      const score = calculateQualityScore(validation, 0);
      expect(score.overall).toBeGreaterThanOrEqual(0);
    });

    test("handles undefined breakdown", () => {
      const validation = { issues: [] };
      expect(() => calculateQualityScore(validation, 100)).not.toThrow();
    });
  });
});

// Self-contained implementation
function calculateQualityScore(validation, rowCount) {
  const { issueBreakdown = {} } = validation;

  const typeErrors = issueBreakdown.typeErrors || 0;
  const missingValues = issueBreakdown.missingValues || 0;
  const duplicates = issueBreakdown.duplicates || 0;
  const outliers = issueBreakdown.outliers || 0;

  const totalCells = rowCount || 1;

  // Component scores
  const completeness = Math.max(0, 100 - (missingValues / totalCells) * 100);
  const validity = Math.max(0, 100 - (typeErrors / totalCells) * 100);
  const uniqueness = Math.max(0, 100 - (duplicates / totalCells) * 100);
  const consistency = Math.max(0, 100 - (outliers / totalCells) * 100);

  // Weighted average
  const overall = Math.round(
    completeness * 0.3 + validity * 0.3 + uniqueness * 0.2 + consistency * 0.2
  );

  return {
    overall: Math.max(0, Math.min(100, overall)),
    completeness: Math.round(completeness),
    validity: Math.round(validity),
    uniqueness: Math.round(uniqueness),
    consistency: Math.round(consistency),
    grade: getGrade(overall),
  };
}

function getGrade(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
