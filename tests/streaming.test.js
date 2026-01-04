/**
 * Streaming Parser Tests
 * Tests streaming and batch processing for large files
 */

describe("Streaming Parser", () => {
  describe("Batch Processor", () => {
    test("processes rows in batches", async () => {
      const rows = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      const batches = [];

      await processBatches(rows, 10, (batch) => {
        batches.push(batch.length);
      });

      expect(batches.length).toBe(10);
      expect(batches.every((b) => b === 10)).toBe(true);
    });

    test("handles partial last batch", async () => {
      const rows = Array.from({ length: 95 }, (_, i) => ({ id: i }));
      const batches = [];

      await processBatches(rows, 10, (batch) => {
        batches.push(batch.length);
      });

      expect(batches.length).toBe(10);
      expect(batches[9]).toBe(5); // Last batch has 5 items
    });

    test("handles empty data", async () => {
      const batches = [];

      await processBatches([], 10, (batch) => {
        batches.push(batch);
      });

      expect(batches.length).toBe(0);
    });
  });

  describe("Optimized Duplicate Detection", () => {
    test("detects duplicates in large dataset", () => {
      const rows = Array.from({ length: 10000 }, (_, i) => ({
        id: String(i % 5000), // 5000 unique, 5000 duplicates
        name: `Name${i}`,
      }));

      const duplicates = detectDuplicatesOptimized(rows, ["id"]);

      expect(duplicates.length).toBe(5000);
    });

    test("uses sampling for very large datasets", () => {
      const rows = Array.from({ length: 100000 }, (_, i) => ({
        id: String(i),
        name: `Name${i}`,
      }));

      const start = Date.now();
      const duplicates = detectDuplicatesOptimized(rows, ["id"], {
        sampleSize: 10000,
      });
      const duration = Date.now() - start;

      // Should be fast even for large datasets
      expect(duration).toBeLessThan(5000);
    });

    test("handles composite keys", () => {
      const rows = [
        { first: "John", last: "Doe" },
        { first: "Jane", last: "Doe" },
        { first: "John", last: "Doe" }, // Duplicate
      ];

      const duplicates = detectDuplicatesOptimized(rows, ["first", "last"]);

      expect(duplicates.length).toBe(1);
    });
  });

  describe("Memory Efficiency", () => {
    test("batch processing maintains stable memory", async () => {
      const rows = Array.from({ length: 50000 }, (_, i) => ({
        id: String(i),
        data: "x".repeat(100), // 100 bytes per row
      }));

      const initialMemory = process.memoryUsage().heapUsed;

      await processBatches(rows, 1000, (batch) => {
        // Simulate processing
        batch.forEach((r) => r.id);
      });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Should not increase memory significantly during processing
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
    });
  });

  describe("Generator-based Processing", () => {
    test("yields rows one at a time", () => {
      const rows = [{ a: 1 }, { a: 2 }, { a: 3 }];
      const processed = [];

      for (const row of streamRows(rows)) {
        processed.push(row);
      }

      expect(processed.length).toBe(3);
    });

    test("supports early termination", () => {
      const rows = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      let count = 0;

      for (const row of streamRows(rows)) {
        count++;
        if (count >= 10) break;
      }

      expect(count).toBe(10);
    });
  });
});

// Helper implementations
async function processBatches(rows, batchSize, processor) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await processor(batch);
  }
}

function detectDuplicatesOptimized(rows, columns, options = {}) {
  const { sampleSize } = options;
  const dataToCheck =
    sampleSize && rows.length > sampleSize ? rows.slice(0, sampleSize) : rows;

  const seen = new Map();
  const duplicates = [];

  dataToCheck.forEach((row, idx) => {
    const key = columns.map((c) => row[c]).join("|");
    if (seen.has(key)) {
      duplicates.push({ rowIndex: idx, key });
    } else {
      seen.set(key, idx);
    }
  });

  return duplicates;
}

function* streamRows(rows) {
  for (const row of rows) {
    yield row;
  }
}
