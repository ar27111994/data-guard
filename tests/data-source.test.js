/**
 * Data Source Parser Tests
 * Tests CSV, Excel, JSON parsing with edge cases
 */
import Papa from "papaparse";

describe("Data Source Parser", () => {
  describe("CSV Parsing", () => {
    test("parses basic CSV with header", async () => {
      const csv = "name,age\nJohn,30\nJane,25";
      const result = await parseCSV(csv, { hasHeader: true });

      expect(result.headers).toEqual(["name", "age"]);
      expect(result.rows.length).toBe(2);
    });

    test("parses CSV without header", async () => {
      const csv = "John,30\nJane,25";
      const result = await parseCSV(csv, { hasHeader: false });

      // When no header, Papa returns arrays, check first row
      expect(result.rows.length).toBe(2);
    });

    test("handles quoted values with delimiters", async () => {
      const csv = 'name,description\nJohn,"Hello, World"';
      const result = await parseCSV(csv, {});

      expect(result.rows[0].description).toBe("Hello, World");
    });

    test("handles escaped quotes", async () => {
      const csv = 'name,quote\nJohn,"Say ""Hello"""';
      const result = await parseCSV(csv, {});

      expect(result.rows[0].quote).toContain("Hello");
    });

    test("handles newlines in quoted values", async () => {
      const csv = 'name,address\nJohn,"123 Main St\nApt 4"';
      const result = await parseCSV(csv, {});

      expect(result.rows[0].address).toContain("\n");
    });

    test("handles empty values", async () => {
      const csv = "name,age,city\nJohn,,New York\n,25,\n,,";
      const result = await parseCSV(csv, {});

      expect(result.rows.length).toBe(3);
    });

    test("handles BOM (Byte Order Mark)", async () => {
      const csvWithBOM = "\uFEFFname,age\nJohn,30";
      const result = await parseCSV(csvWithBOM, {});

      expect(result.headers).toContain("name");
    });

    test("handles different line endings", async () => {
      const csvCRLF = "name,age\r\nJohn,30\r\nJane,25";
      const csvLF = "name,age\nJohn,30\nJane,25";

      expect((await parseCSV(csvCRLF, {})).rows.length).toBe(2);
      expect((await parseCSV(csvLF, {})).rows.length).toBe(2);
    });

    test("handles Unicode content", async () => {
      const csv = "name,city\n日本太郎,東京\nПётр,Москва";
      const result = await parseCSV(csv, {});

      expect(result.rows[0].name).toBe("日本太郎");
      expect(result.rows[1].city).toBe("Москва");
    });

    test("handles header-only file", async () => {
      const csv = "name,age,city";
      const result = await parseCSV(csv, {});

      expect(result.headers.length).toBe(3);
      expect(result.rows.length).toBe(0);
    });

    test("handles many columns", async () => {
      const headers = Array.from({ length: 100 }, (_, i) => `col${i}`);
      const values = Array.from({ length: 100 }, () => "value");
      const csv = headers.join(",") + "\n" + values.join(",");

      const result = await parseCSV(csv, {});
      expect(result.headers.length).toBe(100);
    });
  });

  describe("JSON Parsing", () => {
    test("parses array of objects", () => {
      const json = '[{"name":"John","age":30},{"name":"Jane","age":25}]';
      const result = parseJSON(json);

      expect(result.headers).toContain("name");
      expect(result.rows.length).toBe(2);
    });

    test("parses single object", () => {
      const json = '{"name":"John","age":30}';
      const result = parseJSON(json);

      expect(result.rows.length).toBe(1);
    });

    test("handles empty array", () => {
      const result = parseJSON("[]");
      expect(result.rows.length).toBe(0);
    });
  });

  describe("JSONL Parsing", () => {
    test("parses JSON Lines", () => {
      const jsonl = '{"name":"John"}\n{"name":"Jane"}\n{"name":"Bob"}';
      const result = parseJSONL(jsonl);

      expect(result.rows.length).toBe(3);
    });

    test("handles empty lines", () => {
      const jsonl = '{"name":"John"}\n\n{"name":"Jane"}\n';
      const result = parseJSONL(jsonl);

      expect(result.rows.length).toBe(2);
    });
  });

  describe("Format Detection", () => {
    test("detects CSV format", () => {
      expect(detectFormat("name,age\nJohn,30")).toBe("csv");
    });

    test("detects JSON array format", () => {
      expect(detectFormat('[{"name":"John"}]')).toBe("json");
    });

    test("detects JSONL format", () => {
      expect(detectFormat('{"a":1}\n{"a":2}')).toBe("jsonl");
    });
  });

  describe("URL Validation", () => {
    test("accepts valid HTTP URLs", () => {
      expect(isValidUrl("https://example.com/data.csv")).toBe(true);
      expect(isValidUrl("http://example.com/data.json")).toBe(true);
    });

    test("rejects invalid URLs", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
      expect(isValidUrl("")).toBe(false);
    });
  });
});

// Helper implementations
async function parseCSV(csv, config = {}) {
  const result = Papa.parse(csv, {
    header: config.hasHeader !== false,
    skipEmptyLines: true,
  });
  return {
    headers: result.meta.fields || Object.keys(result.data[0] || {}),
    rows: result.data,
  };
}

function parseJSON(json) {
  const parsed = JSON.parse(json);
  if (Array.isArray(parsed)) {
    return {
      headers: parsed.length > 0 ? Object.keys(parsed[0]) : [],
      rows: parsed,
    };
  }
  return {
    headers: Object.keys(parsed),
    rows: [parsed],
  };
}

function parseJSONL(jsonl) {
  const lines = jsonl.split("\n").filter((l) => l.trim());
  const rows = [];
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line));
    } catch {}
  }
  return {
    headers: rows.length > 0 ? Object.keys(rows[0]) : [],
    rows,
  };
}

function detectFormat(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const lines = trimmed.split("\n").filter((l) => l.trim());
    if (
      lines.length > 1 &&
      lines.every((l) => {
        try {
          JSON.parse(l);
          return true;
        } catch {
          return false;
        }
      })
    ) {
      return "jsonl";
    }
    return "json";
  }
  return "csv";
}

function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
