/**
 * Audit Trail
 * Tracks all validation actions and changes for compliance
 */
import { Actor } from "apify";

/**
 * Audit trail manager for tracking validation operations
 */
class AuditTrail {
  constructor() {
    this.entries = [];
    this.startTime = new Date().toISOString();
    this.runId = process.env.APIFY_ACTOR_RUN_ID || `local-${Date.now()}`;
  }

  /**
   * Log an audit entry
   */
  log(action, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      ...details,
    };
    this.entries.push(entry);
    return entry;
  }

  /**
   * Log data source access
   */
  logDataSource(sourceType, sourceUrl, rowCount, columnCount) {
    return this.log("DATA_SOURCE_ACCESSED", {
      sourceType,
      sourceUrl: sourceUrl ? this.maskSensitiveUrl(sourceUrl) : null,
      rowCount,
      columnCount,
    });
  }

  /**
   * Log validation start
   */
  logValidationStart(config) {
    return this.log("VALIDATION_STARTED", {
      config: {
        checkDuplicates: config.checkDuplicates,
        detectOutliers: config.detectOutliers,
        detectPII: config.detectPII,
        sampleSize: config.sampleSize,
      },
    });
  }

  /**
   * Log validation complete
   */
  logValidationComplete(summary) {
    return this.log("VALIDATION_COMPLETED", {
      totalRows: summary.totalRows,
      validRows: summary.validRows,
      invalidRows: summary.invalidRows,
      qualityScore: summary.qualityScore,
      processingTimeMs: summary.processingTimeMs,
    });
  }

  /**
   * Log PII detection
   */
  logPIIDetection(findingsCount, piiTypes) {
    return this.log("PII_DETECTED", {
      findingsCount,
      piiTypesScanned: piiTypes,
      gdprCompliance: findingsCount > 0 ? "REVIEW_REQUIRED" : "COMPLIANT",
    });
  }

  /**
   * Log data modification
   */
  logDataModification(action, affectedRows, details = {}) {
    return this.log("DATA_MODIFIED", {
      modificationAction: action,
      affectedRows,
      ...details,
    });
  }

  /**
   * Log data export
   */
  logDataExport(destination, format, rowCount) {
    return this.log("DATA_EXPORTED", {
      destination,
      format,
      rowCount,
    });
  }

  /**
   * Get full audit report
   */
  getReport() {
    return {
      runId: this.runId,
      startTime: this.startTime,
      endTime: new Date().toISOString(),
      entriesCount: this.entries.length,
      entries: this.entries,
      summary: this.getSummary(),
    };
  }

  /**
   * Get audit summary
   */
  getSummary() {
    const actionCounts = {};
    this.entries.forEach((e) => {
      actionCounts[e.action] = (actionCounts[e.action] || 0) + 1;
    });
    return {
      actionCounts,
      dataModifications: this.entries.filter(
        (e) => e.action === "DATA_MODIFIED"
      ).length,
      piiDetected: this.entries.some(
        (e) => e.action === "PII_DETECTED" && e.findingsCount > 0
      ),
    };
  }

  /**
   * Mask sensitive parts of URL
   */
  maskSensitiveUrl(url) {
    try {
      const parsed = new URL(url);
      // Mask credentials
      if (parsed.password) parsed.password = "***";
      if (parsed.username) parsed.username = "***";
      // Mask query params that might contain secrets
      const sensitiveParams = [
        "key",
        "token",
        "secret",
        "password",
        "apikey",
        "api_key",
      ];
      for (const param of sensitiveParams) {
        if (parsed.searchParams.has(param)) {
          parsed.searchParams.set(param, "***");
        }
      }
      return parsed.toString();
    } catch {
      return url.substring(0, 50) + "...";
    }
  }

  /**
   * Save audit trail to key-value store
   */
  async save() {
    const report = this.getReport();
    await Actor.setValue("AUDIT_TRAIL", report);
    return report;
  }
}

// Singleton instance
let auditTrailInstance = null;

export function getAuditTrail() {
  if (!auditTrailInstance) {
    auditTrailInstance = new AuditTrail();
  }
  return auditTrailInstance;
}

export function resetAuditTrail() {
  auditTrailInstance = new AuditTrail();
  return auditTrailInstance;
}

export { AuditTrail };
