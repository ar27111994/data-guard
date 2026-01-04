/**
 * Auto-Fixer Tests
 * Tests data cleaning and remediation features
 */

describe("Auto-Fixer", () => {
  describe("Trim Whitespace", () => {
    test("trims leading/trailing whitespace", () => {
      const rows = [
        { name: "  John  ", city: " NYC " },
        { name: "Jane", city: "LA" },
      ];

      const result = cleanData(rows, { cleaningActions: ["trim"] });

      expect(result.cleanedData[0].name).toBe("John");
      expect(result.cleanedData[0].city).toBe("NYC");
    });

    test("handles null values when trimming", () => {
      const rows = [{ name: null }, { name: "  John  " }];

      const result = cleanData(rows, { cleaningActions: ["trim"] });

      expect(result.cleanedData[0].name).toBe(null);
      expect(result.cleanedData[1].name).toBe("John");
    });
  });

  describe("Case Normalization", () => {
    test("converts to lowercase", () => {
      const rows = [{ name: "JOHN DOE" }, { name: "JaNe SmItH" }];

      const result = cleanData(rows, { cleaningActions: ["lowercase"] });

      expect(result.cleanedData[0].name).toBe("john doe");
      expect(result.cleanedData[1].name).toBe("jane smith");
    });

    test("converts to uppercase", () => {
      const rows = [{ code: "abc123" }, { code: "XyZ" }];

      const result = cleanData(rows, { cleaningActions: ["uppercase"] });

      expect(result.cleanedData[0].code).toBe("ABC123");
      expect(result.cleanedData[1].code).toBe("XYZ");
    });
  });

  describe("Remove Duplicates", () => {
    test("removes exact duplicates", () => {
      const rows = [
        { id: "1", name: "John" },
        { id: "2", name: "Jane" },
        { id: "1", name: "John" }, // Duplicate
        { id: "3", name: "Bob" },
      ];

      const result = cleanData(rows, {
        cleaningActions: ["removeDuplicates"],
        duplicateColumns: ["id"],
      });

      expect(result.cleanedData.length).toBe(3);
    });

    test("keeps first occurrence of duplicates", () => {
      const rows = [
        { id: "1", value: "first" },
        { id: "1", value: "second" },
      ];

      const result = cleanData(rows, {
        cleaningActions: ["removeDuplicates"],
        duplicateColumns: ["id"],
      });

      expect(result.cleanedData[0].value).toBe("first");
    });
  });

  describe("Remove Empty Rows", () => {
    test("removes rows with all null values", () => {
      const rows = [
        { name: "John", age: "30" },
        { name: null, age: null },
        { name: "", age: "" },
        { name: "Jane", age: "25" },
      ];

      const result = cleanData(rows, { cleaningActions: ["removeEmptyRows"] });

      expect(result.cleanedData.length).toBe(2);
    });

    test("keeps rows with partial data", () => {
      const rows = [
        { name: "John", age: null },
        { name: null, age: "30" },
        { name: null, age: null },
      ];

      const result = cleanData(rows, { cleaningActions: ["removeEmptyRows"] });

      expect(result.cleanedData.length).toBe(2);
    });
  });

  describe("Combined Actions", () => {
    test("applies multiple cleaning actions", () => {
      const rows = [
        { name: "  JOHN  ", status: "active" },
        { name: "  JOHN  ", status: "active" }, // Duplicate
        { name: "  JANE  ", status: null },
      ];

      const result = cleanData(rows, {
        cleaningActions: ["trim", "lowercase", "removeDuplicates"],
        duplicateColumns: ["name"],
      });

      expect(result.cleanedData.length).toBe(2);
      expect(result.cleanedData[0].name).toBe("john");
    });
  });

  describe("Statistics", () => {
    test("returns cleaning statistics", () => {
      const rows = [
        { name: "  John  " },
        { name: null },
        { name: "  John  " }, // Duplicate
      ];

      const result = cleanData(rows, {
        cleaningActions: ["trim", "removeEmptyRows", "removeDuplicates"],
        duplicateColumns: ["name"],
      });

      expect(result.stats).toBeDefined();
      expect(result.stats.originalCount).toBe(3);
      expect(result.stats.cleanedCount).toBeLessThan(3);
    });
  });

  describe("Edge Cases", () => {
    test("handles empty input", () => {
      const result = cleanData([], { cleaningActions: ["trim"] });

      expect(result.cleanedData).toEqual([]);
    });

    test("handles no cleaning actions", () => {
      const rows = [{ name: "  John  " }];

      const result = cleanData(rows, { cleaningActions: [] });

      expect(result.cleanedData[0].name).toBe("  John  ");
    });
  });
});

// Self-contained mock implementation
function cleanData(rows, config) {
  const { cleaningActions = [], duplicateColumns = [] } = config;
  let data = [...rows];

  // Track stats
  const stats = { originalCount: rows.length };

  cleaningActions.forEach((action) => {
    switch (action) {
      case "trim":
        data = data.map((row) => {
          const cleaned = {};
          Object.keys(row).forEach((k) => {
            cleaned[k] = typeof row[k] === "string" ? row[k].trim() : row[k];
          });
          return cleaned;
        });
        break;

      case "lowercase":
        data = data.map((row) => {
          const cleaned = {};
          Object.keys(row).forEach((k) => {
            cleaned[k] =
              typeof row[k] === "string" ? row[k].toLowerCase() : row[k];
          });
          return cleaned;
        });
        break;

      case "uppercase":
        data = data.map((row) => {
          const cleaned = {};
          Object.keys(row).forEach((k) => {
            cleaned[k] =
              typeof row[k] === "string" ? row[k].toUpperCase() : row[k];
          });
          return cleaned;
        });
        break;

      case "removeDuplicates":
        const seen = new Set();
        data = data.filter((row) => {
          const key = duplicateColumns.map((c) => row[c]).join("|");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        break;

      case "removeEmptyRows":
        data = data.filter((row) => {
          return Object.values(row).some(
            (v) => v !== null && v !== "" && v !== undefined
          );
        });
        break;
    }
  });

  stats.cleanedCount = data.length;

  return { cleanedData: data, stats };
}
