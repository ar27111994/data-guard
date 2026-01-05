/**
 * HTML Report Tests
 * Tests for report generation utilities
 */

describe("HTML Report Utilities", () => {
  describe("safeNumber", () => {
    test("returns number for valid numbers", () => {
      expect(safeNumber(42)).toBe(42);
      expect(safeNumber(0)).toBe(0);
      expect(safeNumber(-5.5)).toBe(-5.5);
    });

    test("returns fallback for non-numbers", () => {
      expect(safeNumber(null)).toBe(0);
      expect(safeNumber(undefined)).toBe(0);
      expect(safeNumber(NaN)).toBe(0);
      expect(safeNumber(Infinity)).toBe(0);
    });

    test("accepts numeric strings", () => {
      expect(safeNumber("42")).toBe(42);
      expect(safeNumber("3.14")).toBe(3.14);
      expect(safeNumber("-10")).toBe(-10);
      expect(safeNumber("  50  ")).toBe(50);
    });

    test("returns fallback for non-numeric strings", () => {
      expect(safeNumber("abc")).toBe(0);
      expect(safeNumber("")).toBe(0);
      expect(safeNumber("   ")).toBe(0);
      expect(safeNumber("12abc")).toBe(0); // NaN from Number()
    });

    test("uses custom fallback", () => {
      expect(safeNumber(null, 100)).toBe(100);
      expect(safeNumber("invalid", -1)).toBe(-1);
    });
  });

  describe("clamp", () => {
    test("clamps value to range", () => {
      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(150, 0, 100)).toBe(100);
    });

    test("handles edge cases at boundaries", () => {
      expect(clamp(0, 0, 100)).toBe(0);
      expect(clamp(100, 0, 100)).toBe(100);
    });

    test("throws RangeError when min > max", () => {
      expect(() => clamp(50, 100, 0)).toThrow(RangeError);
      expect(() => clamp(50, 100, 0)).toThrow("min (100) must be <= max (0)");
    });

    test("handles equal min and max", () => {
      expect(clamp(50, 25, 25)).toBe(25);
    });
  });

  describe("escapeHtml", () => {
    test("escapes HTML special characters", () => {
      expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
      expect(escapeHtml('test "value"')).toBe("test &quot;value&quot;");
      expect(escapeHtml("a & b")).toBe("a &amp; b");
      expect(escapeHtml("it's")).toBe("it&#39;s");
    });

    test("handles null and undefined", () => {
      expect(escapeHtml(null)).toBe("");
      expect(escapeHtml(undefined)).toBe("");
    });

    test("handles empty string", () => {
      expect(escapeHtml("")).toBe("");
    });

    test("passes through safe strings unchanged", () => {
      expect(escapeHtml("Hello World")).toBe("Hello World");
      expect(escapeHtml("12345")).toBe("12345");
    });
  });
});

// Self-contained test implementations
function safeNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed !== "") {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
}

function clamp(value, min, max) {
  if (min > max) {
    throw new RangeError(`min (${min}) must be <= max (${max})`);
  }
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
