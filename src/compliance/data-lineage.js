/**
 * Data Lineage Tracking
 * Track data transformations and source-to-output mapping
 */

import { Actor } from "apify";

/**
 * Transformation types
 */
export const TRANSFORMATION_TYPES = {
  PARSE: "parse",
  VALIDATE: "validate",
  IMPUTE: "impute",
  CLEAN: "clean",
  DEDUPLICATE: "deduplicate",
  FILTER: "filter",
  TRANSFORM: "transform",
  EXPORT: "export",
};

/**
 * Create a new lineage tracker
 * @param {Object} options - Tracker options
 * @returns {Object} Lineage tracker instance
 */
export function createLineageTracker(options = {}) {
  const {
    sourceId = null,
    sourceName = null,
    sourceType = "unknown",
    runId = Actor.getEnv()?.actorRunId || `local_${Date.now()}`,
  } = options;

  const transformations = [];
  const columnChanges = {};
  const startTime = Date.now();

  return {
    /**
     * Get source information
     */
    getSource() {
      return {
        id: sourceId,
        name: sourceName,
        type: sourceType,
      };
    },

    /**
     * Record a transformation
     * @param {string} type - Transformation type
     * @param {Object} details - Transformation details
     */
    recordTransformation(type, details = {}) {
      const transformation = {
        id: `${type}_${transformations.length + 1}`,
        type,
        timestamp: new Date().toISOString(),
        timeElapsedMs: Date.now() - startTime,
        ...details,
      };

      transformations.push(transformation);
      return transformation.id;
    },

    /**
     * Record column change
     * @param {string} column - Column name
     * @param {string} changeType - Type of change
     * @param {Object} details - Change details
     */
    recordColumnChange(column, changeType, details = {}) {
      if (!columnChanges[column]) {
        columnChanges[column] = [];
      }

      columnChanges[column].push({
        changeType,
        timestamp: new Date().toISOString(),
        ...details,
      });
    },

    /**
     * Record parsing operation
     * @param {Object} parseInfo - Parse information
     */
    recordParse(parseInfo) {
      return this.recordTransformation(TRANSFORMATION_TYPES.PARSE, {
        format: parseInfo.format,
        encoding: parseInfo.encoding,
        rowCount: parseInfo.rowCount,
        columnCount: parseInfo.columnCount,
        headers: parseInfo.headers,
      });
    },

    /**
     * Record validation operation
     * @param {Object} validationInfo - Validation information
     */
    recordValidation(validationInfo) {
      return this.recordTransformation(TRANSFORMATION_TYPES.VALIDATE, {
        issuesFound: validationInfo.issuesFound,
        validRows: validationInfo.validRows,
        invalidRows: validationInfo.invalidRows,
        qualityScore: validationInfo.qualityScore,
      });
    },

    /**
     * Record imputation operation
     * @param {Object} imputationInfo - Imputation information
     */
    recordImputation(imputationInfo) {
      return this.recordTransformation(TRANSFORMATION_TYPES.IMPUTE, {
        strategy: imputationInfo.strategy,
        columnsAffected: imputationInfo.columnsAffected,
        valuesImputed: imputationInfo.valuesImputed,
      });
    },

    /**
     * Record cleaning operation
     * @param {Object} cleaningInfo - Cleaning information
     */
    recordCleaning(cleaningInfo) {
      return this.recordTransformation(TRANSFORMATION_TYPES.CLEAN, {
        actions: cleaningInfo.actions,
        rowsRemoved: cleaningInfo.rowsRemoved,
        valuesModified: cleaningInfo.valuesModified,
      });
    },

    /**
     * Record deduplication operation
     * @param {Object} dedupInfo - Deduplication information
     */
    recordDeduplication(dedupInfo) {
      return this.recordTransformation(TRANSFORMATION_TYPES.DEDUPLICATE, {
        strategy: dedupInfo.strategy,
        duplicatesFound: dedupInfo.duplicatesFound,
        rowsRemoved: dedupInfo.rowsRemoved,
      });
    },

    /**
     * Record filter operation
     * @param {Object} filterInfo - Filter information
     */
    recordFilter(filterInfo) {
      return this.recordTransformation(TRANSFORMATION_TYPES.FILTER, {
        criteria: filterInfo.criteria,
        rowsBefore: filterInfo.rowsBefore,
        rowsAfter: filterInfo.rowsAfter,
        rowsFiltered: filterInfo.rowsFiltered,
      });
    },

    /**
     * Record export operation
     * @param {Object} exportInfo - Export information
     */
    recordExport(exportInfo) {
      return this.recordTransformation(TRANSFORMATION_TYPES.EXPORT, {
        format: exportInfo.format,
        destination: exportInfo.destination,
        rowCount: exportInfo.rowCount,
        fileSize: exportInfo.fileSize,
      });
    },

    /**
     * Get all transformations
     * @returns {Array} List of transformations
     */
    getTransformations() {
      return transformations;
    },

    /**
     * Get column changes
     * @returns {Object} Column change history
     */
    getColumnChanges() {
      return columnChanges;
    },

    /**
     * Get complete lineage report
     * @returns {Object} Full lineage report
     */
    getLineageReport() {
      const endTime = Date.now();

      return {
        runId,
        source: this.getSource(),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        totalDurationMs: endTime - startTime,
        transformationCount: transformations.length,
        transformations,
        columnChanges: Object.entries(columnChanges).map(
          ([column, changes]) => ({
            column,
            changeCount: changes.length,
            changes,
          })
        ),
        summary: this.getSummary(),
      };
    },

    /**
     * Get summary of transformations
     * @returns {Object} Summary
     */
    getSummary() {
      const typeCounts = {};

      for (const t of transformations) {
        typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
      }

      return {
        transformationTypes: typeCounts,
        totalTransformations: transformations.length,
        columnsModified: Object.keys(columnChanges).length,
        timeline: transformations.map((t) => ({
          type: t.type,
          timeElapsedMs: t.timeElapsedMs,
        })),
      };
    },
  };
}

/**
 * Generate data flow diagram (Mermaid format)
 * @param {Object} lineageReport - Lineage report
 * @returns {string} Mermaid diagram
 */
export function generateFlowDiagram(lineageReport) {
  const { source, transformations } = lineageReport;

  let diagram = "graph TD\n";
  diagram += `    source["📁 ${source.name || "Data Source"}"]\n`;

  let previousNode = "source";

  for (let i = 0; i < transformations.length; i++) {
    const t = transformations[i];
    const nodeId = `t${i}`;
    const icon = getTransformationIcon(t.type);
    const label = getTransformationLabel(t);

    diagram += `    ${nodeId}["${icon} ${label}"]\n`;
    diagram += `    ${previousNode} --> ${nodeId}\n`;
    previousNode = nodeId;
  }

  diagram += `    output["📊 Output"]\n`;
  diagram += `    ${previousNode} --> output\n`;

  return diagram;
}

/**
 * Get icon for transformation type
 */
function getTransformationIcon(type) {
  const icons = {
    [TRANSFORMATION_TYPES.PARSE]: "📥",
    [TRANSFORMATION_TYPES.VALIDATE]: "✅",
    [TRANSFORMATION_TYPES.IMPUTE]: "🔧",
    [TRANSFORMATION_TYPES.CLEAN]: "🧹",
    [TRANSFORMATION_TYPES.DEDUPLICATE]: "🔗",
    [TRANSFORMATION_TYPES.FILTER]: "🔍",
    [TRANSFORMATION_TYPES.TRANSFORM]: "🔄",
    [TRANSFORMATION_TYPES.EXPORT]: "📤",
  };
  return icons[type] || "⚙️";
}

/**
 * Get label for transformation
 */
function getTransformationLabel(transformation) {
  const { type } = transformation;

  switch (type) {
    case TRANSFORMATION_TYPES.PARSE:
      return `Parse (${transformation.format || "auto"})`;
    case TRANSFORMATION_TYPES.VALIDATE:
      return `Validate (${transformation.issuesFound || 0} issues)`;
    case TRANSFORMATION_TYPES.IMPUTE:
      return `Impute (${transformation.valuesImputed || 0} values)`;
    case TRANSFORMATION_TYPES.CLEAN:
      return `Clean (${transformation.actions?.length || 0} actions)`;
    case TRANSFORMATION_TYPES.DEDUPLICATE:
      return `Deduplicate (${transformation.rowsRemoved || 0} removed)`;
    case TRANSFORMATION_TYPES.FILTER:
      return `Filter (${transformation.rowsFiltered || 0} filtered)`;
    case TRANSFORMATION_TYPES.EXPORT:
      return `Export (${transformation.format || "csv"})`;
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

/**
 * Store lineage report in Key-Value Store
 * @param {Object} lineageReport - Lineage report
 * @param {string} key - Storage key
 * @returns {Promise<void>}
 */
export async function storeLineageReport(lineageReport, key = null) {
  try {
    const store = await Actor.openKeyValueStore("data-lineage");
    const storageKey = key || `lineage_${lineageReport.runId}`;

    await store.setValue(storageKey, lineageReport);
    console.log(`   Stored lineage report: ${storageKey}`);

    // Also maintain an index of recent lineage reports
    const indexKey = "lineage_index";
    let index = (await store.getValue(indexKey)) || [];

    index.push({
      key: storageKey,
      runId: lineageReport.runId,
      timestamp: lineageReport.endTime,
      transformationCount: lineageReport.transformationCount,
    });

    // Keep only last 100 entries
    if (index.length > 100) {
      index = index.slice(-100);
    }

    await store.setValue(indexKey, index);
  } catch (error) {
    console.warn(`   Failed to store lineage report: ${error.message}`);
  }
}

/**
 * Load lineage report from Key-Value Store
 * @param {string} key - Storage key
 * @returns {Promise<Object|null>} Lineage report
 */
export async function loadLineageReport(key) {
  try {
    const store = await Actor.openKeyValueStore("data-lineage");
    return await store.getValue(key);
  } catch (error) {
    console.warn(`   Failed to load lineage report: ${error.message}`);
    return null;
  }
}

/**
 * Get recent lineage reports
 * @param {number} limit - Maximum reports to return
 * @returns {Promise<Array>} Recent lineage reports
 */
export async function getRecentLineageReports(limit = 10) {
  try {
    const store = await Actor.openKeyValueStore("data-lineage");
    const index = (await store.getValue("lineage_index")) || [];

    return index.slice(-limit).reverse();
  } catch (error) {
    console.warn(`   Failed to get lineage index: ${error.message}`);
    return [];
  }
}
