/**
 * Outlier Detector Tests
 * Tests IQR and Z-Score outlier detection with edge cases
 */

describe("Outlier Detection", () => {
  describe("IQR Method", () => {
    test("detects outliers beyond 1.5 IQR", () => {
      const values = [10, 11, 12, 13, 14, 100];
      const outliers = findOutliersIQR(values);
      expect(outliers).toContain(100);
    });

    test("handles negative outliers", () => {
      const values = [10, 11, 12, 13, -100];
      const outliers = findOutliersIQR(values);
      expect(outliers).toContain(-100);
    });

    test("returns no outliers for uniform data", () => {
      const values = Array(10).fill(50);
      const outliers = findOutliersIQR(values);
      expect(outliers.length).toBe(0);
    });
  });

  describe("Z-Score Method", () => {
    test("detects outliers beyond threshold", () => {
      const values = [10, 11, 12, 13, 14, 100];
      const outliers = findOutliersZScore(values, 2);
      expect(outliers.length).toBeGreaterThan(0);
    });

    test("respects threshold configuration", () => {
      const values = [10, 11, 12, 50];
      const outliersLow = findOutliersZScore(values, 1);
      const outliersHigh = findOutliersZScore(values, 5);
      expect(outliersLow.length).toBeGreaterThanOrEqual(outliersHigh.length);
    });
  });

  describe("Edge Cases", () => {
    test("handles empty array", () => {
      const outliers = findOutliersIQR([]);
      expect(outliers).toEqual([]);
    });

    test("handles single value", () => {
      const outliers = findOutliersIQR([10]);
      expect(outliers).toEqual([]);
    });

    test("handles two values", () => {
      const outliers = findOutliersIQR([10, 100]);
      expect(outliers).toBeDefined();
    });

    test("handles very large dataset efficiently", () => {
      const values = Array.from({ length: 10000 }, (_, i) => i % 100);
      values.push(10000);

      const start = Date.now();
      const outliers = findOutliersIQR(values);
      const duration = Date.now() - start;

      expect(outliers.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000);
    });

    test("handles negative numbers", () => {
      const values = [-10, -11, -12, -100];
      const outliers = findOutliersIQR(values);
      expect(outliers).toBeDefined();
    });

    test("handles decimal numbers", () => {
      const values = [1.1, 1.2, 1.3, 1.4, 1.5, 50.0];
      const outliers = findOutliersIQR(values);
      expect(outliers.length).toBeGreaterThan(0);
    });
  });
});

// Self-contained implementations
function findOutliersIQR(values) {
  if (values.length < 3) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Idx];
  const q3 = sorted[q3Idx];
  const iqr = q3 - q1;

  if (iqr === 0) return [];

  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;

  return values.filter((v) => v < lower || v > upper);
}

function findOutliersZScore(values, threshold = 3) {
  if (values.length < 2) return [];

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return [];

  return values.filter((v) => Math.abs((v - mean) / stdDev) > threshold);
}
