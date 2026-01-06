/**
 * Historical Trend Analyzer Tests
 * Tests trend calculation, anomaly detection, and predictions
 */

import {
  generateDataSourceId,
  extractMetrics,
  calculateTrends,
  detectAnomalies,
  predictNextRun,
} from "../src/profiling/historical-analyzer.js";

describe("Historical Trend Analyzer", () => {
  describe("Data Source ID Generation", () => {
    test("uses provided identifier", () => {
      const config = { dataSourceIdentifier: "my-data-source" };
      const id = generateDataSourceId(config);
      expect(id).toBe("my_data_source");
    });

    test("generates from URL", () => {
      const config = { dataSourceUrl: "https://example.com/data/file.csv" };
      const id = generateDataSourceId(config);
      expect(id).toContain("example_com");
    });

    test("handles complex URLs", () => {
      const config = {
        dataSourceUrl: "https://api.example.com/v2/data.csv?token=abc",
      };
      const id = generateDataSourceId(config);
      expect(id).toBeDefined();
      expect(id.length).toBeLessThanOrEqual(100);
    });

    test("generates hash for inline data", () => {
      const config = { dataSourceInline: "id,name\n1,John\n2,Jane" };
      const id = generateDataSourceId(config);
      expect(id).toMatch(/^inline_/);
    });

    test("sanitizes special characters", () => {
      const config = { dataSourceIdentifier: "My Data!@#$%^&*()Source" };
      const id = generateDataSourceId(config);
      expect(id).not.toMatch(/[^a-z0-9_]/);
    });

    test("truncates long identifiers", () => {
      const config = { dataSourceIdentifier: "a".repeat(200) };
      const id = generateDataSourceId(config);
      expect(id.length).toBeLessThanOrEqual(100);
    });

    test("handles missing sources", () => {
      const config = {};
      const id = generateDataSourceId(config);
      expect(id).toMatch(/^unknown_/);
    });
  });

  describe("Metrics Extraction", () => {
    test("extracts quality score", () => {
      const qualityScore = { overall: 85, grade: "A" };
      const metrics = extractMetrics({}, {}, qualityScore);
      expect(metrics.qualityScore).toBe(85);
      expect(metrics.grade).toBe("A");
    });

    test("extracts issue counts", () => {
      const validationResult = {
        issues: [{ type: "error" }, { type: "warning" }],
        issueBreakdown: {
          typeErrors: 5,
          missingValues: 10,
        },
      };
      const metrics = extractMetrics(validationResult, {}, {});
      expect(metrics.totalIssues).toBe(2);
      expect(metrics.issueBreakdown.typeErrors).toBe(5);
    });

    test("extracts row count", () => {
      const profileResult = { totalRows: 1000 };
      const metrics = extractMetrics({}, profileResult, {});
      expect(metrics.totalRows).toBe(1000);
    });

    test("includes timestamp", () => {
      const metrics = extractMetrics({}, {}, {});
      expect(metrics.timestamp).toBeDefined();
      expect(new Date(metrics.timestamp)).toBeInstanceOf(Date);
    });

    test("handles missing data gracefully", () => {
      const metrics = extractMetrics(null, null, null);
      expect(metrics.qualityScore).toBe(0);
      expect(metrics.totalRows).toBe(0);
      expect(metrics.totalIssues).toBe(0);
    });
  });

  describe("Trend Calculation", () => {
    test("requires minimum history for trends", () => {
      const history = [{ qualityScore: 80 }];
      const trends = calculateTrends(history);
      expect(trends.hasEnoughData).toBe(false);
    });

    test("detects improving trend", () => {
      const history = [
        { qualityScore: 70, totalIssues: 50, totalRows: 100 },
        { qualityScore: 75, totalIssues: 40, totalRows: 100 },
        { qualityScore: 80, totalIssues: 30, totalRows: 100 },
        { qualityScore: 85, totalIssues: 20, totalRows: 100 },
        { qualityScore: 90, totalIssues: 10, totalRows: 100 },
      ];
      const trends = calculateTrends(history);
      expect(trends.hasEnoughData).toBe(true);
      expect(trends.qualityScore.direction).toBe("improving");
    });

    test("detects declining trend", () => {
      const history = [
        { qualityScore: 95, totalIssues: 10, totalRows: 100 },
        { qualityScore: 85, totalIssues: 20, totalRows: 100 },
        { qualityScore: 75, totalIssues: 30, totalRows: 100 },
        { qualityScore: 65, totalIssues: 40, totalRows: 100 },
      ];
      const trends = calculateTrends(history);
      expect(trends.qualityScore.direction).toBe("declining");
    });

    test("detects stable trend", () => {
      const history = [
        { qualityScore: 80, totalIssues: 25, totalRows: 100 },
        { qualityScore: 80.2, totalIssues: 24, totalRows: 100 },
        { qualityScore: 79.8, totalIssues: 26, totalRows: 100 },
        { qualityScore: 80.1, totalIssues: 25, totalRows: 100 },
      ];
      const trends = calculateTrends(history);
      expect(trends.qualityScore.direction).toBe("stable");
    });

    test("calculates statistics", () => {
      const history = [
        { qualityScore: 70, totalIssues: 30, totalRows: 100 },
        { qualityScore: 80, totalIssues: 20, totalRows: 100 },
        { qualityScore: 90, totalIssues: 10, totalRows: 100 },
      ];
      const trends = calculateTrends(history);
      expect(trends.qualityScore.stats.mean).toBe(80);
      expect(trends.qualityScore.stats.min).toBe(70);
      expect(trends.qualityScore.stats.max).toBe(90);
    });

    test("calculates confidence score", () => {
      const history = [
        { qualityScore: 70, totalIssues: 50, totalRows: 100 },
        { qualityScore: 80, totalIssues: 40, totalRows: 100 },
        { qualityScore: 90, totalIssues: 30, totalRows: 100 },
      ];
      const trends = calculateTrends(history);
      expect(trends.qualityScore.confidence).toBeGreaterThanOrEqual(0);
      expect(trends.qualityScore.confidence).toBeLessThanOrEqual(1);
    });

    test("includes timespan", () => {
      const history = [
        {
          qualityScore: 80,
          totalIssues: 20,
          totalRows: 100,
          timestamp: "2024-01-01T00:00:00Z",
        },
        {
          qualityScore: 85,
          totalIssues: 15,
          totalRows: 100,
          timestamp: "2024-01-02T00:00:00Z",
        },
        {
          qualityScore: 90,
          totalIssues: 10,
          totalRows: 100,
          timestamp: "2024-01-03T00:00:00Z",
        },
      ];
      const trends = calculateTrends(history);
      expect(trends.timespan.firstRun).toBe("2024-01-01T00:00:00Z");
      expect(trends.timespan.lastRun).toBe("2024-01-03T00:00:00Z");
    });
  });

  describe("Anomaly Detection", () => {
    test("detects no anomalies in normal data", () => {
      const history = [
        { qualityScore: 80, totalIssues: 20, totalRows: 100 },
        { qualityScore: 82, totalIssues: 18, totalRows: 100 },
        { qualityScore: 78, totalIssues: 22, totalRows: 100 },
        { qualityScore: 81, totalIssues: 19, totalRows: 100 },
      ];
      const current = { qualityScore: 79, totalIssues: 21, totalRows: 100 };
      const anomalies = detectAnomalies(history, current);
      expect(anomalies).toHaveLength(0);
    });

    test("detects quality score anomaly", () => {
      const history = [
        { qualityScore: 80, totalIssues: 20, totalRows: 100 },
        { qualityScore: 82, totalIssues: 18, totalRows: 100 },
        { qualityScore: 78, totalIssues: 22, totalRows: 100 },
        { qualityScore: 81, totalIssues: 19, totalRows: 100 },
      ];
      const current = { qualityScore: 45, totalIssues: 80, totalRows: 100 };
      const anomalies = detectAnomalies(history, current);
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some((a) => a.key === "qualityScore")).toBe(true);
    });

    test("assigns severity levels", () => {
      // Need variance in history for Z-score calculation
      const history = [
        { qualityScore: 78, totalIssues: 18, totalRows: 100 },
        { qualityScore: 82, totalIssues: 22, totalRows: 100 },
        { qualityScore: 79, totalIssues: 21, totalRows: 100 },
        { qualityScore: 81, totalIssues: 19, totalRows: 100 },
        { qualityScore: 80, totalIssues: 20, totalRows: 100 },
      ];
      // Use extreme values to trigger high/critical severity
      const current = { qualityScore: 30, totalIssues: 150, totalRows: 100 };
      const anomalies = detectAnomalies(history, current);
      expect(anomalies.length).toBeGreaterThan(0);
      expect(
        anomalies.some(
          (a) =>
            a.severity === "critical" ||
            a.severity === "high" ||
            a.severity === "medium",
        ),
      ).toBe(true);
    });

    test("identifies positive anomalies", () => {
      // Need variance for Z-score calculation
      const history = [
        { qualityScore: 58, totalIssues: 48, totalRows: 100 },
        { qualityScore: 62, totalIssues: 52, totalRows: 100 },
        { qualityScore: 60, totalIssues: 50, totalRows: 100 },
        { qualityScore: 59, totalIssues: 49, totalRows: 100 },
        { qualityScore: 61, totalIssues: 51, totalRows: 100 },
      ];
      // Extremely high quality score is a positive anomaly
      const current = { qualityScore: 99, totalIssues: 1, totalRows: 100 };
      const anomalies = detectAnomalies(history, current);
      const positiveAnomaly = anomalies.find(
        (a) => a.key === "qualityScore" && a.impact === "positive",
      );
      expect(positiveAnomaly).toBeDefined();
    });

    test("includes deviation details", () => {
      // Need variance for Z-score calculation
      const history = [
        { qualityScore: 78, totalIssues: 18, totalRows: 100 },
        { qualityScore: 82, totalIssues: 22, totalRows: 100 },
        { qualityScore: 79, totalIssues: 21, totalRows: 100 },
        { qualityScore: 81, totalIssues: 19, totalRows: 100 },
        { qualityScore: 80, totalIssues: 20, totalRows: 100 },
      ];
      // Use extreme value to trigger anomaly
      const current = { qualityScore: 30, totalIssues: 100, totalRows: 100 };
      const anomalies = detectAnomalies(history, current);
      const anomaly = anomalies.find((a) => a.key === "qualityScore");
      expect(anomaly).toBeDefined();
      expect(anomaly.deviation).toBeDefined();
      expect(anomaly.percentDeviation).toBeDefined();
      expect(anomaly.zscore).toBeDefined();
    });

    test("requires minimum history", () => {
      const history = [{ qualityScore: 80, totalIssues: 20, totalRows: 100 }];
      const current = { qualityScore: 40, totalIssues: 80, totalRows: 100 };
      const anomalies = detectAnomalies(history, current);
      expect(anomalies).toHaveLength(0);
    });
  });

  describe("Predictions", () => {
    test("predicts next run score", () => {
      const history = [
        { qualityScore: 70 },
        { qualityScore: 75 },
        { qualityScore: 80 },
        { qualityScore: 85 },
      ];
      const prediction = predictNextRun(history);
      expect(prediction).not.toBeNull();
      expect(prediction.qualityScore).toBeGreaterThan(80);
    });

    test("clamps prediction to valid range", () => {
      const history = [
        { qualityScore: 95 },
        { qualityScore: 97 },
        { qualityScore: 99 },
        { qualityScore: 100 },
      ];
      const prediction = predictNextRun(history);
      expect(prediction.qualityScore).toBeLessThanOrEqual(100);
    });

    test("includes confidence score", () => {
      const history = [
        { qualityScore: 70 },
        { qualityScore: 80 },
        { qualityScore: 90 },
      ];
      const prediction = predictNextRun(history);
      expect(prediction.confidence).toBeDefined();
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });

    test("returns null for insufficient history", () => {
      const history = [{ qualityScore: 80 }];
      const prediction = predictNextRun(history);
      expect(prediction).toBeNull();
    });

    test("indicates trend direction", () => {
      const history = [
        { qualityScore: 60 },
        { qualityScore: 70 },
        { qualityScore: 80 },
        { qualityScore: 90 },
      ];
      const prediction = predictNextRun(history);
      expect(prediction.trend).toBe("improving");
    });
  });

  describe("Edge Cases", () => {
    test("handles empty history", () => {
      expect(() => calculateTrends([])).not.toThrow();
      expect(() => detectAnomalies([], {})).not.toThrow();
      expect(() => predictNextRun([])).not.toThrow();
    });

    test("handles history with missing values", () => {
      const history = [
        { qualityScore: 80 },
        { qualityScore: null },
        { qualityScore: undefined },
        { qualityScore: 85 },
      ];
      expect(() => calculateTrends(history)).not.toThrow();
    });

    test("handles all identical values", () => {
      const history = Array(10).fill({
        qualityScore: 80,
        totalIssues: 20,
        totalRows: 100,
      });
      const trends = calculateTrends(history);
      expect(trends.qualityScore.direction).toBe("stable");
      expect(trends.qualityScore.stats.stdDev).toBe(0);
    });

    test("handles single very large value", () => {
      const history = [
        { qualityScore: 80, totalIssues: 20, totalRows: 100 },
        { qualityScore: 82, totalIssues: 18, totalRows: 100 },
        { qualityScore: 78, totalIssues: 22, totalRows: 100 },
      ];
      const current = { qualityScore: 80, totalIssues: 10000, totalRows: 100 };
      expect(() => detectAnomalies(history, current)).not.toThrow();
    });

    test("handles negative quality scores gracefully", () => {
      // Shouldn't happen but let's be safe
      const history = [
        { qualityScore: -10, totalIssues: 100, totalRows: 100 },
        { qualityScore: 0, totalIssues: 90, totalRows: 100 },
        { qualityScore: 10, totalIssues: 80, totalRows: 100 },
      ];
      expect(() => calculateTrends(history)).not.toThrow();
    });

    test("handles very small decimal differences", () => {
      const history = [
        { qualityScore: 80.0001, totalIssues: 20, totalRows: 100 },
        { qualityScore: 80.0002, totalIssues: 20, totalRows: 100 },
        { qualityScore: 80.0003, totalIssues: 20, totalRows: 100 },
      ];
      const trends = calculateTrends(history);
      expect(trends.qualityScore.direction).toBe("stable");
    });
  });

  describe("Statistical Calculations", () => {
    test("calculates correct mean", () => {
      const history = [
        { qualityScore: 60, totalIssues: 40, totalRows: 100 },
        { qualityScore: 80, totalIssues: 20, totalRows: 100 },
        { qualityScore: 100, totalIssues: 0, totalRows: 100 },
      ];
      const trends = calculateTrends(history);
      expect(trends.qualityScore.stats.mean).toBe(80);
    });

    test("calculates correct median", () => {
      const history = [
        { qualityScore: 10, totalIssues: 90, totalRows: 100 },
        { qualityScore: 50, totalIssues: 50, totalRows: 100 },
        { qualityScore: 90, totalIssues: 10, totalRows: 100 },
      ];
      const trends = calculateTrends(history);
      expect(trends.qualityScore.stats.median).toBe(50);
    });

    test("calculates moving average", () => {
      const history = [
        { qualityScore: 70, totalIssues: 30, totalRows: 100 },
        { qualityScore: 80, totalIssues: 20, totalRows: 100 },
        { qualityScore: 90, totalIssues: 10, totalRows: 100 },
        { qualityScore: 85, totalIssues: 15, totalRows: 100 },
      ];
      const trends = calculateTrends(history);
      expect(trends.qualityScore.movingAverage).toBeDefined();
      expect(trends.qualityScore.movingAverage.length).toBeGreaterThan(0);
    });
  });
});
