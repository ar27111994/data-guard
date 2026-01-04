/**
 * PII Detector
 * Detects Personally Identifiable Information for compliance
 */

/**
 * PII detection patterns
 */
const PII_PATTERNS = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    name: "Email Address",
    risk: "high",
  },
  phone: {
    pattern: /^\+?[\d\s\-()]{10,}$/,
    name: "Phone Number",
    risk: "medium",
  },
  ssn: {
    pattern: /^\d{3}-?\d{2}-?\d{4}$/,
    name: "Social Security Number",
    risk: "critical",
  },
  creditCard: {
    pattern:
      /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$/,
    name: "Credit Card Number",
    risk: "critical",
  },
  ipAddress: {
    pattern:
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    name: "IP Address",
    risk: "low",
  },
};

/**
 * Detect PII in data
 * @param {Array} rows - Data rows
 * @param {Array} headers - Column headers
 * @param {Object} config - Configuration
 * @returns {Object} PII detection results
 */
export async function detectPIIInData(rows, headers, config) {
  const findings = [];
  const { piiTypes = ["email", "phone", "ssn", "creditCard"] } = config;
  const maxFindings = config.maxIssuesPerType || 100;

  const findingCounts = {};

  headers.forEach((column) => {
    piiTypes.forEach((piiType) => {
      const pattern = PII_PATTERNS[piiType];
      if (!pattern) return;

      findingCounts[piiType] = findingCounts[piiType] || 0;

      rows.forEach((row, rowIndex) => {
        const value = row[column];
        if (value === null || value === undefined || value === "") return;

        const stringValue = String(value).trim();

        // Check if value matches PII pattern
        if (pattern.pattern.test(stringValue)) {
          findingCounts[piiType]++;

          if (findingCounts[piiType] <= maxFindings) {
            findings.push({
              rowNumber: rowIndex + 1,
              column,
              piiType,
              piiName: pattern.name,
              risk: pattern.risk,
              maskedValue: maskValue(stringValue, piiType),
              message: `Potential ${pattern.name} detected`,
            });
          }
        }
      });
    });
  });

  // Summary by type
  const summary = {};
  piiTypes.forEach((type) => {
    summary[type] = findingCounts[type] || 0;
  });

  return {
    findings,
    summary,
    totalFindings: Object.values(findingCounts).reduce((a, b) => a + b, 0),
    hasHighRiskPII: findings.some(
      (f) => f.risk === "critical" || f.risk === "high"
    ),
  };
}

/**
 * Mask sensitive value for display
 */
function maskValue(value, piiType) {
  const str = String(value);

  switch (piiType) {
    case "email":
      const [local, domain] = str.split("@");
      return `${local[0]}***@${domain}`;

    case "phone":
      return str.slice(0, 3) + "***" + str.slice(-2);

    case "ssn":
      return "***-**-" + str.slice(-4);

    case "creditCard":
      return "****-****-****-" + str.slice(-4);

    case "ipAddress":
      return str.split(".").slice(0, 2).join(".") + ".xxx.xxx";

    default:
      return str.slice(0, 3) + "***";
  }
}

export { PII_PATTERNS };
