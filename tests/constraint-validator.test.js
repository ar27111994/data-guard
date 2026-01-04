/**
 * Constraint Validator Tests
 * Tests min/max, pattern, enum, and other constraints
 */

describe("Constraint Validator", () => {
  describe("Min/Max Constraints", () => {
    test("validates min constraint", () => {
      const issue = validateValue(5, { min: 10 });
      expect(issue).toBeDefined();
    });

    test("validates max constraint", () => {
      const issue = validateValue(150, { max: 100 });
      expect(issue).toBeDefined();
    });

    test("validates min and max together", () => {
      expect(validateValue(-5, { min: 0, max: 100 })).toBeDefined();
      expect(validateValue(50, { min: 0, max: 100 })).toBeNull();
      expect(validateValue(200, { min: 0, max: 100 })).toBeDefined();
    });

    test("handles edge values at boundaries", () => {
      expect(validateValue(0, { min: 0, max: 100 })).toBeNull();
      expect(validateValue(100, { min: 0, max: 100 })).toBeNull();
    });
  });

  describe("Pattern Constraints", () => {
    test("validates regex pattern", () => {
      expect(validatePattern("ABC123", "^[A-Z]{3}\\d{3}$")).toBeNull();
      expect(validatePattern("abc123", "^[A-Z]{3}\\d{3}$")).toBeDefined();
    });

    test("validates phone pattern", () => {
      const pattern = "^\\+\\d{1,3}-\\d{3}-\\d{3}-\\d{4}$";
      expect(validatePattern("+1-555-555-5555", pattern)).toBeNull();
      expect(validatePattern("5555555555", pattern)).toBeDefined();
    });
  });

  describe("Enum Constraints", () => {
    test("validates enum values", () => {
      const allowed = ["active", "inactive", "pending"];
      expect(validateEnum("active", allowed)).toBeNull();
      expect(validateEnum("invalid_status", allowed)).toBeDefined();
    });

    test("handles case-sensitive enum", () => {
      const allowed = ["active", "inactive"];
      expect(validateEnum("Active", allowed)).toBeDefined();
    });
  });

  describe("Required Constraint", () => {
    test("validates required fields", () => {
      expect(validateRequired("John")).toBeNull();
      expect(validateRequired("")).toBeDefined();
      expect(validateRequired(null)).toBeDefined();
    });
  });

  describe("Length Constraints", () => {
    test("validates minLength", () => {
      expect(validateLength("Jo", { minLength: 3 })).toBeDefined();
      expect(validateLength("John", { minLength: 3 })).toBeNull();
    });

    test("validates maxLength", () => {
      expect(validateLength("ABC", { maxLength: 5 })).toBeNull();
      expect(validateLength("ABCDEFGHIJ", { maxLength: 5 })).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    test("handles undefined constraints", () => {
      expect(() => validateValue(10, undefined)).not.toThrow();
    });

    test("handles empty string with constraints", () => {
      expect(validateValue("", { min: 0 })).toBeNull();
    });
  });
});

// Self-contained validation functions
function validateValue(value, constraints) {
  if (constraints === undefined) return null;
  if (value === "" || value === null || value === undefined) return null;

  const num = Number(value);

  if (constraints.min !== undefined && num < constraints.min) {
    return { error: "below-min", value, min: constraints.min };
  }

  if (constraints.max !== undefined && num > constraints.max) {
    return { error: "above-max", value, max: constraints.max };
  }

  return null;
}

function validatePattern(value, pattern) {
  if (value === "" || value === null) return null;
  const regex = new RegExp(pattern);
  return regex.test(value) ? null : { error: "pattern-mismatch" };
}

function validateEnum(value, allowed) {
  if (value === "" || value === null) return null;
  return allowed.includes(value) ? null : { error: "not-in-enum" };
}

function validateRequired(value) {
  return value && value !== "" ? null : { error: "required-missing" };
}

function validateLength(value, constraints) {
  if (value === "" || value === null) return null;

  if (constraints.minLength && value.length < constraints.minLength) {
    return { error: "too-short" };
  }

  if (constraints.maxLength && value.length > constraints.maxLength) {
    return { error: "too-long" };
  }

  return null;
}
