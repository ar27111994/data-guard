/**
 * CSV/Excel Data Quality Checker & ETL Validator
 * Main entry point for the Apify Actor
 *
 * Optimizations:
 * - Memory-efficient chunk processing for large files
 * - Edge case handling for encoding, empty data, malformed input
 * - Performance monitoring and memory pressure detection
 * - Audit trail for compliance
 */
import { Actor } from "apify";
import { parseDataSource } from "./parsers/data-source.js";
import { validateData } from "./validators/index.js";
import { analyzeBenfordsLaw } from "./validators/benfords-law.js";
import { detectPatterns } from "./validators/pattern-detector.js";
import { profileData } from "./profiling/index.js";
import { calculateQualityScore } from "./profiling/quality-scorer.js";
import { generateRecommendations } from "./profiling/recommendations.js";
import { analyzeCorrelations } from "./profiling/correlation-analyzer.js";
import { generateCleanedData } from "./remediation/auto-fixer.js";
import { detectPIIInData } from "./remediation/pii-detector.js";
import { generateHTMLReport } from "./export/html-report.js";
import { validateInput, handleEmptyData } from "./utils/edge-cases.js";
import {
  PerformanceTimer,
  checkMemoryPressure,
  estimateMemoryUsage,
} from "./utils/performance.js";
import { getAuditTrail } from "./compliance/audit-trail.js";
import {
  DataQualityError,
  formatErrorForUser,
  formatErrorForLog,
} from "./utils/error-handler.js";

const DEFAULT_CONFIG = {
  format: "auto",
  csvDelimiter: "auto",
  encoding: "utf-8",
  hasHeader: true,
  autoDetectTypes: true,
  checkDuplicates: true,
  checkMissingValues: true,
  detectOutliers: "iqr",
  zscoreThreshold: 3,
  fuzzySimilarityThreshold: 0.85,
  maxIssuesPerType: 100,
  sampleSize: 0,
  ignoredColumns: [],
  enableBenfordsLaw: false,
  enableCorrelationAnalysis: false,
  enablePatternDetection: false,
  generateHTMLReport: false,
};

/**
 * Filter out ignored columns from headers
 */
function applyIgnoredColumns(headers, rows, ignoredColumns) {
  if (!ignoredColumns || ignoredColumns.length === 0) {
    return { headers, rows };
  }

  const filteredHeaders = headers.filter((h) => !ignoredColumns.includes(h));
  const filteredRows = rows.map((row) => {
    const newRow = {};
    filteredHeaders.forEach((h) => {
      newRow[h] = row[h];
    });
    return newRow;
  });

  return { headers: filteredHeaders, rows: filteredRows };
}

// ============================================================================
// STAGE FUNCTIONS - Modular processing stages for the validation pipeline
// ============================================================================

/**
 * Parse stage - Load and parse data from source
 * @param {Object} config - Configuration
 * @param {Object} timer - Performance timer
 * @returns {Promise<Object>} Parse result with rows, headers, metadata
 */
async function parseStage(config, timer) {
  timer.start("parsing");
  console.log("📁 Step 1: Parsing data source...");
  const result = await parseDataSource(config);
  timer.end("parsing");
  return result;
}

/**
 * Validate stage - Validate data against schema and rules
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} config - Configuration
 * @param {Object} timer - Performance timer
 * @returns {Promise<Object>} Validation result
 */
async function validateStage(rows, headers, config, timer) {
  timer.start("validation");
  console.log("🔍 Step 2: Validating data quality...");
  const result = await validateData(rows, headers, config);
  timer.end("validation");
  console.log(`✅ Found ${result.issues.length} issues`);
  return result;
}

/**
 * Profile stage - Profile data columns
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} config - Configuration
 * @returns {Promise<Object>} Profile result
 */
async function profileStage(rows, headers, config) {
  console.log("📈 Step 3: Profiling data...");
  const result = await profileData(rows, headers, config);
  console.log(`✅ Profiled ${headers.length} columns`);
  return result;
}

/**
 * Score stage - Calculate quality score
 * @param {Object} validationResult - Validation result
 * @param {Object} profileResult - Profile result
 * @param {number} totalRows - Total row count
 * @returns {Object} Quality score
 */
function scoreStage(validationResult, profileResult, totalRows) {
  const score = calculateQualityScore(
    validationResult,
    profileResult,
    totalRows
  );
  console.log(`🎯 Quality Score: ${score.overall}/100`);
  return score;
}

/**
 * Benford's Law analysis stage
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @param {Object} config - Configuration
 * @returns {Object|null} Benford's analysis result
 */
function benfordsAnalysisStage(rows, headers, columnTypes, config) {
  if (!config.enableBenfordsLaw) return null;
  console.log("📊 Step 4a: Benford's Law analysis...");
  const result = analyzeBenfordsLaw(rows, headers, columnTypes, config);
  console.log(
    `✅ Analyzed ${result.columnsAnalyzed} columns, ${result.violations.length} violations`
  );
  return result;
}

/**
 * Correlation analysis stage
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @param {Object} config - Configuration
 * @returns {Object|null} Correlation analysis result
 */
function correlationAnalysisStage(rows, headers, columnTypes, config) {
  if (!config.enableCorrelationAnalysis) return null;
  console.log("📊 Step 4b: Correlation analysis...");
  const result = analyzeCorrelations(rows, headers, columnTypes);
  console.log(
    `✅ Found ${result.strongCorrelations.length} strong correlations`
  );
  return result;
}

/**
 * Pattern detection stage
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} columnTypes - Column type definitions
 * @param {Object} config - Configuration
 * @returns {Object|null} Pattern detection result
 */
function patternDetectionStage(rows, headers, columnTypes, config) {
  if (!config.enablePatternDetection) return null;
  console.log("🔬 Step 4c: ML-based pattern detection...");
  const result = detectPatterns(rows, headers, columnTypes, config);
  console.log(
    `✅ Found ${result.summary.patternsFound} patterns, ${result.summary.anomaliesFound} anomalies`
  );
  return result;
}

/**
 * PII detection stage
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} config - Configuration
 * @returns {Promise<Object|null>} PII detection result
 */
async function piiDetectionStage(rows, headers, config) {
  if (!config.detectPII) return null;
  console.log("🔒 Step 5: Detecting PII...");
  const result = await detectPIIInData(rows, headers, config);
  console.log(`✅ Found ${result.findings.length} PII instances`);
  return result;
}

/**
 * Output generation stage - Build quality report object
 * @param {Object} context - Processing context with all results
 * @returns {Object} Quality report
 */
function outputGenerationStage(context) {
  const {
    rows,
    headers,
    validationResult,
    profileResult,
    qualityScore,
    benfordsResult,
    correlationsResult,
    patternResult,
    piiResult,
    cleanedDataUrl,
    parseResult,
    config,
    processingTime,
  } = context;

  const validatedRowCount = Array.isArray(context.dataToValidate)
    ? context.dataToValidate.length
    : rows.length;

  const summary = {
    totalRows: validatedRowCount,
    validRows: validatedRowCount - validationResult.invalidRowCount,
    invalidRows: validationResult.invalidRowCount,
    qualityScore: qualityScore.overall,
    processingTimeMs: processingTime,
  };

  const dataQuality = {
    completeness: qualityScore.completeness,
    uniqueness: qualityScore.uniqueness,
    consistency: qualityScore.consistency,
    validity: qualityScore.validity,
    accuracy: qualityScore.overall,
  };

  const columnAnalysis = headers.map((header) => {
    const col = profileResult?.columns?.[header];
    if (!col) {
      return {
        column: header,
        type: "unknown",
        stats: {
          nullCount: 0,
          uniqueCount: 0,
          nullPercent: 0,
          duplicates: 0,
        },
      };
    }

    return {
      column: header,
      type: col.detectedType,
      stats: {
        nullCount: col.nullCount,
        uniqueCount: col.uniqueCount,
        nullPercent: parseFloat(col.nullPercent),
        duplicates: col.totalCount - col.uniqueCount,
      },
      ...(col.numericStats && { numericStats: col.numericStats }),
      ...(col.stringStats && { stringStats: col.stringStats }),
    };
  });

  const duplicateIssues = validationResult.issues.filter(
    (i) => i.issueType === "duplicate"
  );
  const duplicates = {
    totalDuplicates: duplicateIssues.length,
    duplicateRows: groupDuplicates(duplicateIssues),
  };

  const outlierIssues = validationResult.issues.filter(
    (i) => i.issueType === "outlier"
  );
  const outliers = {
    detected: outlierIssues.length,
    method: config.detectOutliers,
    details: outlierIssues.slice(0, 100).map((o) => ({
      column: o.column,
      rowNumber: o.rowNumber,
      value: (() => {
        const parsed = parseFloat(o.value);
        return isNaN(parsed) ? o.value : parsed;
      })(),
      reason: o.message,
    })),
  };

  return {
    summary,
    dataQuality,
    columnAnalysis,
    duplicates,
    outliers,
    benfordsResult,
    correlationsResult,
    patternResult,
    piiResult,
    cleanedDataUrl,
    parseResult,
  };
}

async function main() {
  await Actor.init();

  const timer = new PerformanceTimer();
  timer.start("total");

  const startTime = Date.now();
  const input = (await Actor.getInput()) || {};
  const config = { ...DEFAULT_CONFIG, ...input };

  // Initialize audit trail
  const audit = config.enableAuditTrail ? getAuditTrail() : null;

  console.log("🚀 CSV/Excel Data Quality Checker starting...");
  console.log(
    `📊 Configuration: format=${config.format}, hasHeader=${config.hasHeader}`
  );

  // Validate input configuration
  const inputValidation = validateInput(input);
  if (!inputValidation.isValid) {
    console.error("❌ Input validation failed:");
    inputValidation.errors.forEach((e) => console.error(`   - ${e}`));
    throw new Error(`Invalid input: ${inputValidation.errors.join("; ")}`);
  }
  if (inputValidation.warnings.length > 0) {
    inputValidation.warnings.forEach((w) => console.warn(`⚠️  ${w}`));
  }

  try {
    // Step 1: Parse input data source (using stage function)
    const parseResult = await parseStage(config, timer);

    // Handle empty data gracefully
    const dataCheck = handleEmptyData(parseResult.rows, parseResult.headers);
    if (dataCheck.isEmpty) {
      console.warn(`⚠️  ${dataCheck.reason}`);
      await Actor.pushData({
        type: "summary",
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        qualityScore: 100,
        message: dataCheck.reason,
        timestamp: new Date().toISOString(),
      });
      await Actor.exit();
      return;
    }

    // Apply ignored columns
    const { headers, rows } = applyIgnoredColumns(
      parseResult.headers,
      parseResult.rows,
      config.ignoredColumns
    );

    console.log(`✅ Parsed ${rows.length} rows with ${headers.length} columns`);

    // Log audit entry
    if (audit) {
      audit.logDataSource(
        input.dataSourceUrl
          ? "url"
          : input.dataSourceInline
          ? "inline"
          : "base64",
        input.dataSourceUrl,
        rows.length,
        headers.length
      );
      audit.logValidationStart(config);
    }

    // Memory estimation for large files
    const memoryEstimate = estimateMemoryUsage(rows, headers);
    if (memoryEstimate.bytes > 50 * 1024 * 1024) {
      // > 50MB
      console.log(`📊 Estimated memory usage: ${memoryEstimate.formatted}`);
      const memCheck = checkMemoryPressure();
      if (memCheck.isHighPressure) {
        console.warn(
          "⚠️  High memory pressure detected. Consider using sampleSize option."
        );
      }
    }

    if (config.ignoredColumns?.length > 0) {
      console.log(`   Ignored: ${config.ignoredColumns.join(", ")}`);
    }

    // Apply sample size if specified
    let dataToValidate = rows;
    if (config.sampleSize > 0 && config.sampleSize < rows.length) {
      dataToValidate = rows.slice(0, config.sampleSize);
      console.log(`   Sampling first ${config.sampleSize} rows`);
    }

    // Step 2: Validate data against schema (using stage function)
    const validationResult = await validateStage(
      dataToValidate,
      headers,
      config,
      timer
    );

    // Step 3: Profile data (using stage function)
    const profileResult = await profileStage(dataToValidate, headers, config);

    // Step 4: Calculate quality score (using stage function)
    const qualityScore = scoreStage(
      validationResult,
      profileResult,
      rows.length
    );

    // Step 4a: Benford's Law analysis (using stage function)
    const benfordsResult = benfordsAnalysisStage(
      dataToValidate,
      headers,
      validationResult.columnTypes,
      config
    );

    // Step 4b: Correlation analysis (using stage function)
    const correlationsResult = correlationAnalysisStage(
      dataToValidate,
      headers,
      validationResult.columnTypes,
      config
    );

    // Step 4c: Pattern detection (using stage function)
    const patternResult = patternDetectionStage(
      dataToValidate,
      headers,
      validationResult.columnTypes,
      config
    );

    // Step 5: PII Detection (using stage function)
    const piiResult = await piiDetectionStage(dataToValidate, headers, config);

    // Step 6: Generate recommendations
    console.log("💡 Step 6: Generating recommendations...");
    const recommendations = generateRecommendations(
      validationResult,
      profileResult,
      qualityScore,
      config
    );
    console.log(`✅ Generated ${recommendations.length} recommendations`);

    // Step 7: Generate cleaned data (if enabled)
    let cleanedDataUrl = null;
    if (config.generateCleanData) {
      console.log("🧹 Step 7: Generating cleaned data...");
      cleanedDataUrl = await generateCleanedData(
        dataToValidate,
        headers,
        validationResult,
        config
      );
      console.log(`✅ Cleaned data saved`);
    }

    const processingTime = Date.now() - startTime;

    // Build comprehensive output per masterclass schema
    // Build comprehensive output using stage function
    const outputContext = {
      rows,
      headers,
      validationResult,
      profileResult,
      qualityScore,
      benfordsResult,
      correlationsResult,
      patternResult,
      piiResult,
      cleanedDataUrl,
      parseResult,
      config,
      processingTime,
      dataToValidate, // Needed for consistent row counts
    };
    const { summary, dataQuality, columnAnalysis, duplicates, outliers } =
      outputGenerationStage(outputContext);

    // Push summary to dataset
    await Actor.pushData({
      type: "summary",
      ...summary,
      dataQuality,
      timestamp: new Date().toISOString(),
    });

    // Push issues to dataset (batched for performance)
    const issuesToPush = validationResult.issues.slice(
      0,
      config.maxIssuesPerType * 10
    );
    if (issuesToPush.length > 0) {
      await Actor.pushData(issuesToPush);
    }

    // Build comprehensive quality report
    const qualityReport = {
      summary,
      dataQuality,
      issues: validationResult.issues.slice(0, 1000),
      issueBreakdown: validationResult.issueBreakdown,
      columnAnalysis,
      duplicates,
      outliers,
      recommendations: recommendations.map((r) => r.description),
      recommendationsDetailed: recommendations,
      ...(benfordsResult && { benfordsLaw: benfordsResult }),
      ...(correlationsResult && { correlations: correlationsResult }),
      ...(patternResult && { patterns: patternResult }),
      ...(piiResult && { pii: piiResult }),
      ...(cleanedDataUrl && { cleanDataUrl: cleanedDataUrl }),
      metadata: {
        ...parseResult.metadata,
        validatedAt: new Date().toISOString(),
        columnsValidated: headers.length,
        ignoredColumns: config.ignoredColumns || [],
      },
    };

    await Actor.setValue("QUALITY_REPORT", qualityReport);

    // Generate HTML report (if enabled)
    if (config.generateHTMLReport) {
      console.log("📄 Generating HTML report...");
      await generateHTMLReport(qualityReport, config);
      console.log("✅ HTML report saved");
    }

    // Complete audit trail
    if (audit) {
      audit.logValidationComplete(summary);
      if (piiResult && piiResult.totalFindings > 0) {
        audit.logPIIDetection(piiResult.totalFindings, config.piiTypes);
      }
      if (config.generateCleanData) {
        audit.logDataExport("key-value-store", "csv", dataToValidate.length);
      }
      await audit.save();
      console.log("📋 Audit trail saved");
    }

    // End total timer
    timer.end("total");
    const timings = timer.getReport();

    // Console summary
    console.log("\n" + "=".repeat(50));
    console.log("🎉 Data Quality Check Complete!");
    console.log("=".repeat(50));
    console.log(`📊 Total Rows: ${summary.totalRows}`);
    console.log(`✅ Valid Rows: ${summary.validRows}`);
    console.log(`❌ Invalid Rows: ${summary.invalidRows}`);
    console.log(
      `🎯 Quality Score: ${qualityScore.overall}/100 (Grade: ${qualityScore.grade})`
    );
    console.log(`💡 Recommendations: ${recommendations.length}`);
    console.log(`⏱️  Processing Time: ${processingTime}ms`);
    if (timings.parsing)
      console.log(`   ├─ Parsing: ${Math.round(timings.parsing)}ms`);
    if (timings.validation)
      console.log(`   ├─ Validation: ${Math.round(timings.validation)}ms`);
    console.log("=".repeat(50));
  } catch (error) {
    // Format error for display
    const isKnownError = error instanceof DataQualityError;
    const errorMessage = isKnownError
      ? formatErrorForUser(error)
      : `❌ Error during validation: ${error.message}`;

    console.error(errorMessage);

    // Prepare error data for storage
    const errorData = isKnownError
      ? formatErrorForLog(error)
      : {
          name: error?.name || "Error",
          message: error?.message || String(error),
          stack: error?.stack,
          timestamp: new Date().toISOString(),
        };

    // Push error to dataset
    await Actor.pushData({
      type: "error",
      ...errorData,
    });

    // Save detailed error report
    await Actor.setValue("ERROR_REPORT", {
      ...errorData,
      input: {
        format: config.format,
        hasDataUrl: !!config.dataSourceUrl,
        hasInline: !!config.dataSourceInline,
        hasBase64: !!config.dataSourceBase64,
      },
    });

    // Log error to audit trail
    if (config.enableAuditTrail) {
      try {
        const audit = getAuditTrail();
        audit.log("VALIDATION_ERROR", {
          error: error.message,
          code: error.code || "UNKNOWN",
          category: error.category || "INTERNAL",
        });
        await audit.save();
      } catch (auditError) {
        console.error("Failed to save audit trail:", auditError.message);
      }
    }

    throw error;
  }

  await Actor.exit();
}

/**
 * Group duplicate issues by matching values
 */
function groupDuplicates(duplicateIssues) {
  const groups = {};

  duplicateIssues.forEach((issue) => {
    const key = issue.value;
    if (!groups[key]) {
      groups[key] = {
        rowNumbers: [],
        matchingValues: key,
      };
    }
    groups[key].rowNumbers.push(issue.rowNumber);
  });

  return Object.values(groups);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
