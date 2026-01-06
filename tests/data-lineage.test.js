/**
 * Data Lineage Tracking Tests
 */

import {
  createLineageTracker,
  TRANSFORMATION_TYPES,
  generateFlowDiagram,
} from "../src/compliance/data-lineage.js";

describe("Data Lineage Tracking", () => {
  describe("Lineage Tracker Creation", () => {
    test("creates tracker with default options", () => {
      const tracker = createLineageTracker();
      expect(tracker).toBeDefined();
      expect(tracker.getSource).toBeDefined();
      expect(tracker.recordTransformation).toBeDefined();
    });

    test("creates tracker with source info", () => {
      const tracker = createLineageTracker({
        sourceId: "src_123",
        sourceName: "test-data.csv",
        sourceType: "csv",
      });

      const source = tracker.getSource();
      expect(source.id).toBe("src_123");
      expect(source.name).toBe("test-data.csv");
      expect(source.type).toBe("csv");
    });
  });

  describe("Transformation Recording", () => {
    test("records parse transformation", () => {
      const tracker = createLineageTracker();

      tracker.recordParse({
        format: "csv",
        encoding: "utf-8",
        rowCount: 1000,
        columnCount: 10,
        headers: ["id", "name", "value"],
      });

      const transformations = tracker.getTransformations();
      expect(transformations.length).toBe(1);
      expect(transformations[0].type).toBe(TRANSFORMATION_TYPES.PARSE);
      expect(transformations[0].format).toBe("csv");
    });

    test("records validation transformation", () => {
      const tracker = createLineageTracker();

      tracker.recordValidation({
        issuesFound: 25,
        validRows: 975,
        invalidRows: 25,
        qualityScore: 97.5,
      });

      const transformations = tracker.getTransformations();
      expect(transformations[0].type).toBe(TRANSFORMATION_TYPES.VALIDATE);
      expect(transformations[0].issuesFound).toBe(25);
    });

    test("records imputation transformation", () => {
      const tracker = createLineageTracker();

      tracker.recordImputation({
        strategy: "mean",
        columnsAffected: ["price", "quantity"],
        valuesImputed: 50,
      });

      const transformations = tracker.getTransformations();
      expect(transformations[0].strategy).toBe("mean");
    });

    test("records cleaning transformation", () => {
      const tracker = createLineageTracker();

      tracker.recordCleaning({
        actions: ["trim", "lowercase"],
        rowsRemoved: 10,
        valuesModified: 500,
      });

      const transformations = tracker.getTransformations();
      expect(transformations[0].actions).toContain("trim");
    });

    test("records deduplication", () => {
      const tracker = createLineageTracker();

      tracker.recordDeduplication({
        strategy: "keepFirst",
        duplicatesFound: 50,
        rowsRemoved: 45,
      });

      const transformations = tracker.getTransformations();
      expect(transformations[0].type).toBe(TRANSFORMATION_TYPES.DEDUPLICATE);
    });

    test("records export", () => {
      const tracker = createLineageTracker();

      tracker.recordExport({
        format: "json",
        destination: "dataset",
        rowCount: 950,
      });

      const transformations = tracker.getTransformations();
      expect(transformations[0].format).toBe("json");
    });
  });

  describe("Column Changes", () => {
    test("records column changes", () => {
      const tracker = createLineageTracker();

      tracker.recordColumnChange("email", "normalized", {
        action: "lowercase",
        rowsAffected: 100,
      });

      const changes = tracker.getColumnChanges();
      expect(changes.email).toBeDefined();
      expect(changes.email.length).toBe(1);
      expect(changes.email[0].changeType).toBe("normalized");
    });

    test("tracks multiple changes per column", () => {
      const tracker = createLineageTracker();

      tracker.recordColumnChange("name", "trimmed", {});
      tracker.recordColumnChange("name", "titlecased", {});

      const changes = tracker.getColumnChanges();
      expect(changes.name.length).toBe(2);
    });
  });

  describe("Lineage Report", () => {
    test("generates complete report", () => {
      const tracker = createLineageTracker({
        sourceName: "sales.csv",
        sourceType: "csv",
      });

      tracker.recordParse({ format: "csv", rowCount: 1000 });
      tracker.recordValidation({ issuesFound: 10 });

      const report = tracker.getLineageReport();

      expect(report.source.name).toBe("sales.csv");
      expect(report.transformationCount).toBe(2);
      expect(report.startTime).toBeDefined();
      expect(report.endTime).toBeDefined();
    });

    test("includes summary", () => {
      const tracker = createLineageTracker();

      tracker.recordParse({});
      tracker.recordValidation({});
      tracker.recordCleaning({});

      const report = tracker.getLineageReport();
      expect(report.summary.totalTransformations).toBe(3);
    });

    test("includes column changes in report", () => {
      const tracker = createLineageTracker();

      tracker.recordColumnChange("col1", "modified", {});
      tracker.recordColumnChange("col2", "normalized", {});

      const report = tracker.getLineageReport();
      expect(report.columnChanges.length).toBe(2);
    });
  });

  describe("Flow Diagram Generation", () => {
    test("generates Mermaid diagram", () => {
      const tracker = createLineageTracker({
        sourceName: "data.csv",
      });

      tracker.recordParse({ format: "csv" });
      tracker.recordValidation({ issuesFound: 5 });

      const report = tracker.getLineageReport();
      const diagram = generateFlowDiagram(report);

      expect(diagram).toContain("graph TD");
      expect(diagram).toContain("source");
      expect(diagram).toContain("Parse");
      expect(diagram).toContain("output");
    });

    test("handles empty transformations", () => {
      const tracker = createLineageTracker();
      const report = tracker.getLineageReport();
      const diagram = generateFlowDiagram(report);

      expect(diagram).toContain("graph TD");
      expect(diagram).toContain("source");
    });
  });

  describe("Edge Cases", () => {
    test("handles rapid transformations", () => {
      const tracker = createLineageTracker();

      for (let i = 0; i < 100; i++) {
        tracker.recordTransformation("test", { index: i });
      }

      expect(tracker.getTransformations().length).toBe(100);
    });

    test("handles special characters in details", () => {
      const tracker = createLineageTracker();

      tracker.recordTransformation("test", {
        message: "Value with 'quotes' and \"double quotes\"",
        data: { nested: { value: 123 } },
      });

      expect(tracker.getTransformations()[0].message).toContain("quotes");
    });
  });
});
