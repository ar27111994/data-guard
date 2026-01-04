/**
 * Performance Utilities Tests
 * Tests memory management and performance optimization utilities
 */

describe("Performance Utilities", () => {
  describe("Chunk Processing", () => {
    test("processes array in chunks", async () => {
      const data = Array.from({ length: 100 }, (_, i) => i);
      const processed = [];

      await processInChunks(data, 10, async (chunk) => {
        processed.push(...chunk.map((x) => x * 2));
      });

      expect(processed.length).toBe(100);
      expect(processed[0]).toBe(0);
      expect(processed[99]).toBe(198);
    });

    test("handles empty array", async () => {
      const processed = [];
      await processInChunks([], 10, async (chunk) => {
        processed.push(...chunk);
      });
      expect(processed).toEqual([]);
    });

    test("handles chunk size larger than array", async () => {
      const data = [1, 2, 3];
      let callCount = 0;
      await processInChunks(data, 100, async () => {
        callCount++;
      });
      expect(callCount).toBe(1);
    });
  });

  describe("Performance Timer", () => {
    test("tracks execution time", () => {
      const timer = new PerformanceTimer();
      timer.start("test");
      const start = Date.now();
      while (Date.now() - start < 10) {}
      timer.end("test");

      const times = timer.getTimings();
      expect(times.test).toBeGreaterThan(0);
    });

    test("tracks multiple operations", () => {
      const timer = new PerformanceTimer();
      timer.start("op1");
      timer.end("op1");
      timer.start("op2");
      timer.end("op2");

      const times = timer.getTimings();
      expect(times.op1).toBeDefined();
      expect(times.op2).toBeDefined();
    });
  });

  describe("Memory Usage Estimation", () => {
    test("estimates string size", () => {
      const str = "a".repeat(1000);
      const estimate = estimateMemoryUsage(str);
      expect(estimate).toBeGreaterThan(1000);
    });

    test("estimates array size", () => {
      const arr = Array(100).fill("test");
      const estimate = estimateMemoryUsage(arr);
      expect(estimate).toBeGreaterThan(0);
    });

    test("handles null and undefined", () => {
      expect(estimateMemoryUsage(null)).toBe(0);
      expect(estimateMemoryUsage(undefined)).toBe(0);
    });
  });

  describe("Memory Pressure Check", () => {
    test("returns memory status", () => {
      const status = checkMemoryPressure();

      expect(status).toHaveProperty("heapUsed");
      expect(status).toHaveProperty("heapTotal");
      expect(status).toHaveProperty("percentUsed");
    });
  });

  describe("Hash Index Creation", () => {
    test("creates index from array", () => {
      const rows = [
        { id: "1", name: "John" },
        { id: "2", name: "Jane" },
        { id: "3", name: "Bob" },
      ];

      const index = createHashIndex(rows, ["id"]);

      expect(index.size).toBe(3);
      expect(index.get("1")).toContain(0);
    });

    test("groups duplicates in index", () => {
      const rows = [
        { id: "1", name: "John" },
        { id: "1", name: "John2" },
        { id: "2", name: "Jane" },
      ];

      const index = createHashIndex(rows, ["id"]);
      expect(index.get("1").length).toBe(2);
    });

    test("handles empty array", () => {
      const index = createHashIndex([], ["id"]);
      expect(index.size).toBe(0);
    });
  });
});

// Self-contained implementations
async function processInChunks(array, chunkSize, processor) {
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    await processor(chunk);
  }
}

class PerformanceTimer {
  constructor() {
    this.starts = {};
    this.timings = {};
  }

  start(name) {
    this.starts[name] = Date.now();
  }

  end(name) {
    if (this.starts[name]) {
      this.timings[name] = Date.now() - this.starts[name];
    }
  }

  getTimings() {
    return this.timings;
  }
}

function estimateMemoryUsage(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") return value.length * 2;
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + estimateMemoryUsage(item), 0);
  }
  if (typeof value === "object") {
    return Object.values(value).reduce(
      (sum, v) => sum + estimateMemoryUsage(v),
      0
    );
  }
  return 8;
}

function checkMemoryPressure() {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    percentUsed: (mem.heapUsed / mem.heapTotal) * 100,
    isHighPressure: mem.heapUsed / mem.heapTotal > 0.9,
  };
}

function createHashIndex(rows, columns) {
  const index = new Map();
  rows.forEach((row, idx) => {
    const key = columns.map((c) => row[c]).join("|");
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key).push(idx);
  });
  return index;
}
