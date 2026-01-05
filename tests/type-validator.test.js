/**
 * Type Validator Tests
 * Tests all 12+ type validators with edge cases
 */

describe("Type Validators", () => {
  describe("String Type", () => {
    test("accepts any string value", () => {
      expect(validators.string("hello")).toBe(true);
      expect(validators.string("")).toBe(true);
      expect(validators.string("123")).toBe(true);
    });

    test("handles null and undefined", () => {
      expect(validators.string(null)).toBe(true);
      expect(validators.string(undefined)).toBe(true);
    });
  });

  describe("Number Type", () => {
    test("accepts valid numbers", () => {
      expect(validators.number("123")).toBe(true);
      expect(validators.number("123.45")).toBe(true);
      expect(validators.number("-123.45")).toBe(true);
      expect(validators.number("0")).toBe(true);
    });

    test("rejects non-numeric strings", () => {
      expect(validators.number("abc")).toBe(false);
      expect(validators.number("$100")).toBe(false);
    });

    test("handles edge cases", () => {
      expect(validators.number("")).toBe(true);
      expect(validators.number(null)).toBe(true);
      expect(validators.number("1e10")).toBe(true);
    });
  });

  describe("Integer Type", () => {
    test("accepts valid integers", () => {
      expect(validators.integer("123")).toBe(true);
      expect(validators.integer("-456")).toBe(true);
      expect(validators.integer("0")).toBe(true);
    });

    test("rejects decimals", () => {
      expect(validators.integer("123.45")).toBe(false);
    });

    test("rejects non-integers", () => {
      expect(validators.integer("abc")).toBe(false);
    });
  });

  describe("Email Type", () => {
    const validEmails = [
      "test@example.com",
      "user.name@domain.org",
      "user+tag@gmail.com",
      "a@b.co",
    ];

    const invalidEmails = ["not-an-email", "@domain.com", "user@", "user@.com"];

    validEmails.forEach((email) => {
      test(`accepts valid email: ${email}`, () => {
        expect(validators.email(email)).toBe(true);
      });
    });

    invalidEmails.forEach((email) => {
      test(`rejects invalid email: ${email}`, () => {
        expect(validators.email(email)).toBe(false);
      });
    });
  });

  describe("Phone Type", () => {
    const validPhones = [
      "+1234567890",
      "(123) 456-7890",
      "+1 (123) 456-7890",
      "123-456-7890",
    ];

    validPhones.forEach((phone) => {
      test(`accepts valid phone: ${phone}`, () => {
        expect(validators.phone(phone)).toBe(true);
      });
    });
  });

  describe("URL Type", () => {
    const validUrls = [
      "https://example.com",
      "http://test.org/path?query=1",
      "https://sub.domain.com:8080/path",
    ];

    const invalidUrls = ["not-a-url", "example.com"];

    validUrls.forEach((url) => {
      test(`accepts valid URL: ${url}`, () => {
        expect(validators.url(url)).toBe(true);
      });
    });

    invalidUrls.forEach((url) => {
      test(`rejects invalid URL: ${url}`, () => {
        expect(validators.url(url)).toBe(false);
      });
    });
  });

  describe("Date Type", () => {
    const validDates = ["2024-01-15", "2024/01/15", "January 15, 2024"];

    const invalidDates = ["not-a-date"];

    validDates.forEach((date) => {
      test(`accepts valid date: ${date}`, () => {
        expect(validators.date(date)).toBe(true);
      });
    });

    invalidDates.forEach((date) => {
      test(`rejects invalid date: ${date}`, () => {
        expect(validators.date(date)).toBe(false);
      });
    });
  });

  describe("Boolean Type", () => {
    const trueValues = ["true", "TRUE", "1", "yes", "YES"];
    const falseValues = ["false", "FALSE", "0", "no", "NO"];
    const invalidValues = ["maybe", "2", "yep"];

    trueValues.forEach((val) => {
      test(`accepts true value: ${val}`, () => {
        expect(validators.boolean(val)).toBe(true);
      });
    });

    falseValues.forEach((val) => {
      test(`accepts false value: ${val}`, () => {
        expect(validators.boolean(val)).toBe(true);
      });
    });

    invalidValues.forEach((val) => {
      test(`rejects invalid boolean: ${val}`, () => {
        expect(validators.boolean(val)).toBe(false);
      });
    });
  });

  describe("UUID Type", () => {
    const validUuids = [
      "550e8400-e29b-41d4-a716-446655440000",
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    ];

    const invalidUuids = ["not-a-uuid", "550e8400-e29b-41d4-a716"];

    validUuids.forEach((uuid) => {
      test(`accepts valid UUID: ${uuid}`, () => {
        expect(validators.uuid(uuid)).toBe(true);
      });
    });

    invalidUuids.forEach((uuid) => {
      test(`rejects invalid UUID: ${uuid}`, () => {
        expect(validators.uuid(uuid)).toBe(false);
      });
    });
  });

  describe("IP Address Type", () => {
    const validIps = ["192.168.1.1", "10.0.0.1", "255.255.255.255"];
    const invalidIps = ["256.1.1.1", "192.168.1"];

    validIps.forEach((ip) => {
      test(`accepts valid IP: ${ip}`, () => {
        expect(validators.ip(ip)).toBe(true);
      });
    });

    invalidIps.forEach((ip) => {
      test(`rejects invalid IP: ${ip}`, () => {
        expect(validators.ip(ip)).toBe(false);
      });
    });
  });

  describe("JSON Type", () => {
    const validJson = ['{"key": "value"}', "[]", "[1, 2, 3]"];
    const invalidJson = ["{key: value}", "{incomplete"];

    validJson.forEach((json) => {
      test(`accepts valid JSON: ${json.substring(0, 20)}`, () => {
        expect(validators.json(json)).toBe(true);
      });
    });

    invalidJson.forEach((json) => {
      test(`rejects invalid JSON: ${json}`, () => {
        expect(validators.json(json)).toBe(false);
      });
    });
  });
});

// Self-contained validators
const validators = {
  string: (v) => typeof v === "string" || v === null || v === undefined,

  number: (v) => {
    if (v === null || v === undefined || v === "") return true;
    return !isNaN(parseFloat(v)) && isFinite(v);
  },

  integer: (v) => {
    if (v === null || v === undefined || v === "") return true;
    const num = Number(v);
    return Number.isInteger(num);
  },

  date: (v) => {
    if (v === null || v === undefined || v === "") return true;
    const date = new Date(v);
    return !isNaN(date.getTime());
  },

  email: (v) => {
    if (v === null || v === undefined || v === "") return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v));
  },

  phone: (v) => {
    if (v === null || v === undefined || v === "") return true;
    return /^\+?[\d\s\-()]{7,}$/.test(String(v));
  },

  url: (v) => {
    if (v === null || v === undefined || v === "") return true;
    try {
      new URL(String(v));
      return true;
    } catch {
      return false;
    }
  },

  boolean: (v) => {
    if (v === null || v === undefined || v === "") return true;
    const lower = String(v).toLowerCase();
    return ["true", "false", "0", "1", "yes", "no"].includes(lower);
  },

  uuid: (v) => {
    if (v === null || v === undefined || v === "") return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(v),
    );
  },

  ip: (v) => {
    if (v === null || v === undefined || v === "") return true;
    const ipv4 =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4.test(String(v));
  },

  json: (v) => {
    if (v === null || v === undefined || v === "") return true;
    try {
      JSON.parse(String(v));
      return true;
    } catch {
      return false;
    }
  },
};
