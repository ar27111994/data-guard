/**
 * Correlation Analyzer Tests
 * Tests Pearson correlation coefficient calculation
 */

describe("Correlation Analyzer", () => {
  describe("Perfect Correlations", () => {
    test("detects perfect positive correlation", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const correlation = pearsonCorrelation(x, y);
      expect(correlation).toBeCloseTo(1.0, 2);
    });

    test("detects perfect negative correlation", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [10, 8, 6, 4, 2];
      const correlation = pearsonCorrelation(x, y);
      expect(correlation).toBeCloseTo(-1.0, 2);
    });
  });

  describe("Partial Correlations", () => {
    test("detects strong positive correlation", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2.1, 3.9, 6.2, 7.8, 10.1];
      const correlation = pearsonCorrelation(x, y);
      expect(correlation).toBeGreaterThan(0.9);
    });

    test("detects no correlation", () => {
      const x = [1, 2, 3, 4, 5, 6, 7, 8];
      const y = [5, 2, 8, 1, 9, 3, 7, 4];
      const correlation = pearsonCorrelation(x, y);
      expect(Math.abs(correlation)).toBeLessThan(0.5);
    });
  });

  describe("Multi-Column Analysis", () => {
    test("analyzes all numeric column pairs", () => {
      const data = [
        { a: 1, b: 2, c: 3 },
        { a: 2, b: 4, c: 6 },
        { a: 3, b: 6, c: 9 },
      ];

      const pairs = getColumnPairs(["a", "b", "c"]);
      expect(pairs.length).toBe(3); // a-b, a-c, b-c
    });
  });

  describe("Strong Correlation Detection", () => {
    test("identifies strong correlations above threshold", () => {
      const correlations = [
        { col1: "a", col2: "b", coefficient: 0.95 },
        { col1: "a", col2: "c", coefficient: 0.3 },
        { col1: "b", col2: "c", coefficient: -0.85 },
      ];

      const strong = correlations.filter((c) => Math.abs(c.coefficient) > 0.7);
      expect(strong.length).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    test("handles empty arrays", () => {
      const correlation = pearsonCorrelation([], []);
      expect(isNaN(correlation) || correlation === 0).toBe(true);
    });

    test("handles single value", () => {
      const correlation = pearsonCorrelation([1], [2]);
      expect(isNaN(correlation)).toBe(true);
    });

    test("handles constant values", () => {
      const x = [5, 5, 5, 5];
      const y = [10, 20, 30, 40];
      const correlation = pearsonCorrelation(x, y);
      // Correlation undefined for constant x
      expect(isNaN(correlation)).toBe(true);
    });

    test("handles null values", () => {
      const x = [1, null, 3, 4];
      const y = [2, 4, null, 8];
      const { filteredX, filteredY } = filterPairs(x, y);
      expect(filteredX.length).toBeLessThan(4);
    });
  });

  describe("Result Format", () => {
    test("returns coefficient between -1 and 1", () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 4, 3, 2, 1];
      const correlation = pearsonCorrelation(x, y);

      expect(correlation).toBeGreaterThanOrEqual(-1);
      expect(correlation).toBeLessThanOrEqual(1);
    });
  });
});

// Helper functions
function pearsonCorrelation(x, y) {
  const n = x.length;
  if (n < 2) return NaN;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return NaN;

  return numerator / denom;
}

function getColumnPairs(columns) {
  const pairs = [];
  for (let i = 0; i < columns.length; i++) {
    for (let j = i + 1; j < columns.length; j++) {
      pairs.push([columns[i], columns[j]]);
    }
  }
  return pairs;
}

function filterPairs(x, y) {
  const filteredX = [];
  const filteredY = [];
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== null && y[i] !== null) {
      filteredX.push(x[i]);
      filteredY.push(y[i]);
    }
  }
  return { filteredX, filteredY };
}
