/**
 * PII Detector Tests
 * Tests PII detection for email, phone, SSN, credit card, and IP
 */

describe("PII Detection", () => {
  // PII pattern definitions
  const PII_PATTERNS = {
    email: /[^\s@]+@[^\s@]+\.[^\s@]+/,
    phone: /\+?[\d\s\-()]{7,}/,
    ssn: /\d{3}-\d{2}-\d{4}/,
    creditCard: /\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}|\d{15,16}/,
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
  };

  describe("Email Detection", () => {
    const validEmails = [
      "user@example.com",
      "first.last@company.org",
      "user+tag@gmail.com",
    ];

    validEmails.forEach((email) => {
      test(`detects email: ${email}`, () => {
        expect(PII_PATTERNS.email.test(email)).toBe(true);
      });
    });
  });

  describe("Phone Detection", () => {
    const validPhones = [
      "+1-555-555-5555",
      "(555) 555-5555",
      "+44 20 7946 0958",
      "555-555-5555",
    ];

    validPhones.forEach((phone) => {
      test(`detects phone: ${phone}`, () => {
        expect(PII_PATTERNS.phone.test(phone)).toBe(true);
      });
    });
  });

  describe("SSN Detection", () => {
    const validSSNs = ["123-45-6789", "987-65-4321"];

    const invalidSSNs = ["12-345-6789", "123-456789"];

    validSSNs.forEach((ssn) => {
      test(`detects SSN: ${ssn}`, () => {
        expect(PII_PATTERNS.ssn.test(ssn)).toBe(true);
      });
    });

    invalidSSNs.forEach((ssn) => {
      test(`rejects invalid SSN: ${ssn}`, () => {
        expect(PII_PATTERNS.ssn.test(ssn)).toBe(false);
      });
    });
  });

  describe("Credit Card Detection", () => {
    const validCards = [
      "4111111111111111",
      "5500000000000004",
      "4111-1111-1111-1111",
      "4111 1111 1111 1111",
    ];

    const invalidCards = ["1234567890", "not-a-card"];

    validCards.forEach((card) => {
      test(`detects credit card: ${card.substring(0, 4)}****`, () => {
        expect(PII_PATTERNS.creditCard.test(card)).toBe(true);
      });
    });

    invalidCards.forEach((card) => {
      test(`rejects invalid card: ${card}`, () => {
        expect(PII_PATTERNS.creditCard.test(card)).toBe(false);
      });
    });
  });

  describe("IP Address Detection", () => {
    const validIPs = ["192.168.1.1", "10.0.0.1", "255.255.255.255"];

    const invalidIPs = ["not.an.ip"];

    validIPs.forEach((ip) => {
      test(`detects IP: ${ip}`, () => {
        expect(PII_PATTERNS.ipAddress.test(ip)).toBe(true);
      });
    });

    invalidIPs.forEach((ip) => {
      test(`rejects invalid IP: ${ip}`, () => {
        expect(PII_PATTERNS.ipAddress.test(ip)).toBe(false);
      });
    });
  });

  describe("Full Data Scan", () => {
    test("detects multiple PII types in single row", () => {
      const row = {
        email: "user@example.com",
        phone: "+1-555-555-5555",
        ssn: "123-45-6789",
        ip: "192.168.1.1",
      };

      const findings = scanForPII(row, ["email", "phone", "ssn", "ipAddress"]);
      expect(findings.length).toBeGreaterThanOrEqual(4);
    });

    test("returns empty for data without PII", () => {
      const row = { name: "John", id: "12345" };
      const findings = scanForPII(row, ["email", "phone", "ssn"]);
      expect(findings.length).toBe(0);
    });

    test("handles null and empty values", () => {
      const row = { email: null, phone: "" };
      const findings = scanForPII(row, ["email", "phone"]);
      expect(findings.length).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    test("handles embedded PII in text", () => {
      const text = "Contact John at john@example.com or call +1-555-555-5555";

      expect(PII_PATTERNS.email.test(text)).toBe(true);
      expect(PII_PATTERNS.phone.test(text)).toBe(true);
    });

    test("handles special characters around PII", () => {
      const text = "(user@example.com)";
      expect(PII_PATTERNS.email.test(text)).toBe(true);
    });
  });
});

// Helper implementation
function scanForPII(row, types) {
  const patterns = {
    email: /[^\s@]+@[^\s@]+\.[^\s@]+/g,
    phone: /\+?[\d\s\-()]{10,}/g,
    ssn: /\d{3}-\d{2}-\d{4}/g,
    creditCard: /\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}/g,
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  };

  const findings = [];

  Object.entries(row).forEach(([column, value]) => {
    if (!value || typeof value !== "string") return;

    types.forEach((type) => {
      const pattern = patterns[type];
      if (pattern && pattern.test(value)) {
        findings.push({ type, column, value: value.substring(0, 20) });
      }
    });
  });

  return findings;
}
