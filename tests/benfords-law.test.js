/**
 * Benford's Law Analyzer Tests
 * Tests fraud detection using Benford's Law
 */

describe("Benford's Law Analysis", () => {
  describe("First Digit Extraction", () => {
    test("extracts first digit from positive numbers", () => {
      expect(getFirstDigit(123)).toBe(1);
      expect(getFirstDigit(456)).toBe(4);
      expect(getFirstDigit(999)).toBe(9);
    });

    test("extracts first digit from decimals", () => {
      expect(getFirstDigit(0.123)).toBe(1);
      expect(getFirstDigit(0.00456)).toBe(4);
    });

    test("handles negative numbers", () => {
      expect(getFirstDigit(-123)).toBe(1);
      expect(getFirstDigit(-456)).toBe(4);
    });

    test("returns 0 for zero", () => {
      expect(getFirstDigit(0)).toBe(0);
    });
  });

  describe("Distribution Calculation", () => {
    test("calculates correct digit distribution", () => {
      const values = [100, 200, 300, 100];
      const distribution = calculateDistribution(values);

      expect(distribution[1]).toBe(2);
      expect(distribution[2]).toBe(1);
      expect(distribution[3]).toBe(1);
    });

    test("handles empty array", () => {
      const distribution = calculateDistribution([]);
      expect(Object.values(distribution).every((v) => v === 0)).toBe(true);
    });
  });

  describe("Conformance Detection", () => {
    test("detects Benford-conforming data", () => {
      const benfordData = generateBenfordData(1000);
      const result = analyzeBenford(benfordData);
      expect(result.conformsToBenford).toBe(true);
    });

    test("detects uniform distribution as non-conforming", () => {
      const uniformData = Array.from(
        { length: 1000 },
        (_, i) => ((i % 9) + 1) * 100,
      );
      const result = analyzeBenford(uniformData);
      expect(result.conformsToBenford).toBe(false);
    });

    test("detects fabricated data as non-conforming", () => {
      const fabricated = Array(1000).fill(555);
      const result = analyzeBenford(fabricated);
      expect(result.conformsToBenford).toBe(false);
    });
  });

  describe("Chi-Square Test", () => {
    test("calculates chi-square statistic", () => {
      const values = Array.from({ length: 100 }, (_, i) => ((i % 9) + 1) * 100);
      const result = analyzeBenford(values);
      expect(result.chiSquare).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    test("handles empty data", () => {
      const result = analyzeBenford([]);
      expect(result.sampleSize).toBe(0);
    });

    test("handles small dataset", () => {
      const result = analyzeBenford([100, 200]);
      expect(result.sampleSize).toBe(2);
    });

    test("ignores zeros", () => {
      const values = [0, 100, 0];
      const result = analyzeBenford(values);
      expect(result.sampleSize).toBe(1);
    });
  });
});

// Self-contained implementations
function getFirstDigit(num) {
  if (num === 0) return 0;
  const abs = Math.abs(num);
  const str = abs
    .toString()
    .replace(/^0+\.?0*/, "")
    .replace(/\D/g, "");
  return parseInt(str[0], 10) || 0;
}

function calculateDistribution(values) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  values.forEach((v) => {
    const digit = getFirstDigit(v);
    if (digit >= 1 && digit <= 9) {
      distribution[digit]++;
    }
  });
  return distribution;
}

function analyzeBenford(values) {
  const nonZero = values.filter((v) => v !== 0);
  if (nonZero.length === 0) {
    return { sampleSize: 0, conformsToBenford: false, chiSquare: 0 };
  }

  const distribution = calculateDistribution(nonZero);
  const total = nonZero.length;

  const expected = {
    1: 0.301,
    2: 0.176,
    3: 0.125,
    4: 0.097,
    5: 0.079,
    6: 0.067,
    7: 0.058,
    8: 0.051,
    9: 0.046,
  };

  let chiSquare = 0;
  for (let d = 1; d <= 9; d++) {
    const observed = distribution[d] / total;
    const exp = expected[d];
    chiSquare += Math.pow(observed - exp, 2) / exp;
  }
  chiSquare *= total;

  const conformsToBenford = chiSquare < 15.5;

  return {
    sampleSize: total,
    distribution,
    chiSquare,
    conformsToBenford,
  };
}

function generateBenfordData(count) {
  const data = [];
  for (let i = 0; i < count; i++) {
    const exp = Math.pow(10, Math.random() * 6);
    data.push(Math.round(exp));
  }
  return data;
}
