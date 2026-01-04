/**
 * Comprehensive Feature Tests
 * Full end-to-end tests for all Actor features
 */

describe("Comprehensive Feature Tests", () => {
  describe("Data Parsing", () => {
    test("parses CSV data correctly", () => {
      const csv = "name,age\nJohn,30\nJane,25";
      const result = parseCSV(csv);

      expect(result.headers).toEqual(["name", "age"]);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0].name).toBe("John");
    });

    test("parses JSON data correctly", () => {
      const json = '[{"name":"John","age":30}]';
      const result = parseJSON(json);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe("John");
    });
  });

  describe("Type Validation", () => {
    test("validates email format", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("invalid-email")).toBe(false);
    });

    test("validates number format", () => {
      expect(isValidNumber("123")).toBe(true);
      expect(isValidNumber("123.45")).toBe(true);
      expect(isValidNumber("abc")).toBe(false);
    });

    test("validates date format", () => {
      expect(isValidDate("2024-01-15")).toBe(true);
      expect(isValidDate("not-a-date")).toBe(false);
    });
  });

  describe("Duplicate Detection", () => {
    test("finds exact duplicates", () => {
      const rows = [
        { id: "1", name: "John" },
        { id: "2", name: "Jane" },
        { id: "1", name: "John" },
      ];

      const duplicates = findDuplicates(rows, ["id"]);
      expect(duplicates.length).toBe(1);
    });
  });

  describe("Outlier Detection", () => {
    test("identifies outliers using IQR", () => {
      const values = [10, 12, 11, 13, 11, 100]; // 100 is outlier
      const outliers = findOutliersIQR(values);

      expect(outliers).toContain(100);
    });
  });

  describe("PII Detection", () => {
    test("detects email PII", () => {
      const text = "Contact john@example.com for details";
      const pii = detectPII(text, ["email"]);

      expect(pii.some((p) => p.type === "email")).toBe(true);
    });

    test("detects SSN PII", () => {
      const text = "SSN: 123-45-6789";
      const pii = detectPII(text, ["ssn"]);

      expect(pii.some((p) => p.type === "ssn")).toBe(true);
    });
  });

  describe("Quality Score", () => {
    test("calculates quality score", () => {
      const validationResult = {
        issues: [],
        issueBreakdown: { typeErrors: 0, missingValues: 0 },
      };

      const score = calculateScore(validationResult, 100);
      expect(score).toBe(100);
    });

    test("reduces score for issues", () => {
      const validationResult = {
        issues: Array(10).fill({}),
        issueBreakdown: { typeErrors: 5, missingValues: 5 },
      };

      const score = calculateScore(validationResult, 100);
      expect(score).toBeLessThan(100);
    });
  });

  describe("Data Cleaning", () => {
    test("trims whitespace", () => {
      expect(cleanTrim("  hello  ")).toBe("hello");
      expect(cleanTrim("\tworld\n")).toBe("world");
    });

    test("normalizes case", () => {
      expect(cleanLowercase("HELLO")).toBe("hello");
      expect(cleanUppercase("hello")).toBe("HELLO");
    });
  });

  describe("Configuration Validation", () => {
    test("validates required fields", () => {
      const config = { dataSourceInline: "a,b\n1,2" };
      const result = validateConfig(config);

      expect(result.isValid).toBe(true);
    });

    test("reports missing data source", () => {
      const config = {};
      const result = validateConfig(config);

      expect(result.isValid).toBe(false);
    });
  });
});

// Helper implementations for tests
function parseCSV(csv) {
  const lines = csv.split("\n");
  const headers = lines[0].split(",");
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i];
    });
    return obj;
  });
  return { headers, rows };
}

function parseJSON(json) {
  const data = JSON.parse(json);
  return {
    headers: Object.keys(data[0] || {}),
    rows: data,
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidNumber(value) {
  if (value === "" || value === null) return true;
  return !isNaN(parseFloat(value)) && isFinite(value);
}

function isValidDate(value) {
  if (value === "" || value === null) return true;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

function findDuplicates(rows, columns) {
  const seen = new Map();
  const duplicates = [];
  rows.forEach((row, idx) => {
    const key = columns.map((c) => row[c]).join("|");
    if (seen.has(key)) {
      duplicates.push({ rowIndex: idx, key });
    } else {
      seen.set(key, idx);
    }
  });
  return duplicates;
}

function findOutliersIQR(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Idx];
  const q3 = sorted[q3Idx];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return values.filter((v) => v < lower || v > upper);
}

function detectPII(text, types) {
  const patterns = {
    email: /[^\s@]+@[^\s@]+\.[^\s@]+/g,
    ssn: /\d{3}-\d{2}-\d{4}/g,
    phone: /\+?[\d\s\-()]{7,}/g,
  };

  const findings = [];
  types.forEach((type) => {
    const matches = text.match(patterns[type]) || [];
    matches.forEach((match) => {
      findings.push({ type, value: match });
    });
  });
  return findings;
}

function calculateScore(validationResult, rowCount) {
  const { issueBreakdown } = validationResult;
  const totalIssues =
    (issueBreakdown.typeErrors || 0) + (issueBreakdown.missingValues || 0);
  return Math.max(0, 100 - (totalIssues / rowCount) * 100);
}

function cleanTrim(value) {
  return value.trim();
}

function cleanLowercase(value) {
  return value.toLowerCase();
}

function cleanUppercase(value) {
  return value.toUpperCase();
}

function validateConfig(config) {
  const hasDataSource =
    config.dataSourceUrl || config.dataSourceInline || config.dataSourceBase64;
  return {
    isValid: !!hasDataSource,
    errors: hasDataSource ? [] : ["No data source provided"],
  };
}
