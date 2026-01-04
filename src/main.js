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

/**
 * Main Actor initialization and execution
 */
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
    // Step 1: Parse input data source
    timer.start("parsing");
    console.log("📁 Step 1: Parsing data source...");
    const parseResult = await parseDataSource(config);
    timer.end("parsing");

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

    // Step 2: Validate data against schema
    timer.start("validation");
    console.log("🔍 Step 2: Validating data quality...");
    const validationResult = await validateData(
      dataToValidate,
      headers,
      config
    );
    timer.end("validation");
    console.log(`✅ Found ${validationResult.issues.length} issues`);

    // Step 3: Profile data
    console.log("📈 Step 3: Profiling data...");
    const profileResult = await profileData(dataToValidate, headers, config);
    console.log(`✅ Profiled ${headers.length} columns`);

    // Step 4: Calculate quality score
    const qualityScore = calculateQualityScore(
      validationResult,
      profileResult,
      rows.length
    );
    console.log(`🎯 Quality Score: ${qualityScore.overall}/100`);

    // Step 5: Benford's Law analysis (if enabled)
    let benfordsResult = null;
    if (config.enableBenfordsLaw) {
      console.log("📊 Step 5a: Benford's Law analysis...");
      benfordsResult = analyzeBenfordsLaw(
        dataToValidate,
        headers,
        validationResult.columnTypes,
        config
      );
      console.log(
        `✅ Analyzed ${benfordsResult.columnsAnalyzed} columns, ${benfordsResult.violations.length} violations`
      );
    }

    // Step 6: Correlation analysis (if enabled)
    let correlationsResult = null;
    if (config.enableCorrelationAnalysis) {
      console.log("📊 Step 5b: Correlation analysis...");
      correlationsResult = analyzeCorrelations(
        dataToValidate,
        headers,
        validationResult.columnTypes
      );
      console.log(
        `✅ Found ${correlationsResult.strongCorrelations.length} strong correlations`
      );
    }

    // Step 5c: Pattern detection (if enabled)
    let patternResult = null;
    if (config.enablePatternDetection) {
      console.log("🔬 Step 5c: ML-based pattern detection...");
      patternResult = detectPatterns(
        dataToValidate,
        headers,
        validationResult.columnTypes,
        config
      );
      console.log(
        `✅ Found ${patternResult.summary.patternsFound} patterns, ${patternResult.summary.anomaliesFound} anomalies`
      );
    }

    // Step 7: PII Detection (if enabled)
    let piiResult = null;
    if (config.detectPII) {
      console.log("🔒 Step 6: Detecting PII...");
      piiResult = await detectPIIInData(dataToValidate, headers, config);
      console.log(`✅ Found ${piiResult.findings.length} PII instances`);
    }

    // Step 8: Generate recommendations
    console.log("💡 Step 7: Generating recommendations...");
    const recommendations = generateRecommendations(
      validationResult,
      profileResult,
      qualityScore,
      config
    );
    console.log(`✅ Generated ${recommendations.length} recommendations`);

    // Step 9: Generate cleaned data (if enabled)
    let cleanedDataUrl = null;
    if (config.generateCleanData) {
      console.log("🧹 Step 8: Generating cleaned data...");
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
    const summary = {
      totalRows: rows.length,
      validRows: rows.length - validationResult.invalidRowCount,
      invalidRows: validationResult.invalidRowCount,
      qualityScore: qualityScore.overall,
      processingTimeMs: processingTime,
    };

    const dataQuality = {
      completeness: qualityScore.completeness,
      uniqueness: qualityScore.uniqueness,
      consistency: qualityScore.consistency,
      validity: qualityScore.validity,
      accuracy: qualityScore.overall, // Based on overall assessment
    };

    const columnAnalysis = headers.map((header) => {
      const col = profileResult.columns[header];
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

    // Group duplicates by matching values
    const duplicateIssues = validationResult.issues.filter(
      (i) => i.issueType === "duplicate"
    );
    const duplicates = {
      totalDuplicates: duplicateIssues.length,
      duplicateRows: groupDuplicates(duplicateIssues),
    };

    // Group outliers
    const outlierIssues = validationResult.issues.filter(
      (i) => i.issueType === "outlier"
    );
    const outliers = {
      detected: outlierIssues.length,
      method: config.detectOutliers,
      details: outlierIssues.slice(0, 100).map((o) => ({
        column: o.column,
        rowNumber: o.rowNumber,
        value: parseFloat(o.value) || o.value,
        reason: o.message,
      })),
    };

    // Push summary to dataset
    await Actor.pushData({
      type: "summary",
      ...summary,
      dataQuality,
      timestamp: new Date().toISOString(),
    });

    // Push issues to dataset (with limit)
    for (const issue of validationResult.issues.slice(
      0,
      config.maxIssuesPerType * 10
    )) {
      await Actor.pushData(issue);
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
    console.log(`📊 Total Rows: ${rows.length}`);
    console.log(
      `✅ Valid Rows: ${rows.length - validationResult.invalidRowCount}`
    );
    console.log(`❌ Invalid Rows: ${validationResult.invalidRowCount}`);
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
