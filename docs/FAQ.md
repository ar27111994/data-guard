# ❓ Frequently Asked Questions

Common questions and answers about the DataGuard Data Quality Checker.

---

## General Questions

### What file formats are supported?

DataGuard supports the following formats:

| Format     | Extensions          | Notes                                                    |
| ---------- | ------------------- | -------------------------------------------------------- |
| CSV        | `.csv`              | Auto-delimiter detection (comma, semicolon, tab, pipe)   |
| Excel      | `.xlsx`, `.xls`     | Multi-sheet support, specify sheet by name or index      |
| JSON       | `.json`             | Arrays of objects                                        |
| JSON Lines | `.jsonl`, `.ndjson` | One JSON object per line                                 |
| Parquet    | `.parquet`          | Apache Parquet columnar format (requires parquetjs-lite) |

### How does auto-detection work?

When `format` is set to `auto`, DataGuard:

1. Checks the file extension from the URL
2. Analyzes the first 1000 bytes of content
3. Tries parsers in order: JSON → JSONL → Excel → CSV
4. Uses the first parser that succeeds

### What's the maximum file size?

- **Recommended**: Up to 100MB for optimal performance
- **Maximum**: 500MB (may require increased memory allocation)
- **Large files**: Use `sampleSize` option to validate a subset

---

## Validation Questions

### How is the Quality Score calculated?

The Quality Score (0-100) is calculated from four components:

| Component    | Weight | Description                       |
| ------------ | ------ | --------------------------------- |
| Completeness | 30%    | Percentage of non-null values     |
| Validity     | 30%    | Percentage of type-valid values   |
| Uniqueness   | 20%    | Percentage of unique rows         |
| Consistency  | 20%    | Format consistency across columns |

**Grade Scale:**

- **A**: 90-100
- **B**: 80-89
- **C**: 70-79
- **D**: 60-69
- **F**: Below 60

### What types can be validated?

DataGuard validates 12+ data types:

| Type      | Example               | Validation                      |
| --------- | --------------------- | ------------------------------- |
| `string`  | "Hello"               | Any text value                  |
| `number`  | 123.45                | Numeric values (int or float)   |
| `integer` | 42                    | Whole numbers only              |
| `date`    | "2024-01-15"          | ISO 8601 and common formats     |
| `email`   | "user@example.com"    | RFC 5322 email format           |
| `phone`   | "+1-555-123-4567"     | International phone patterns    |
| `url`     | "https://example.com" | Valid URL format                |
| `boolean` | true, "yes", 1        | Boolean and boolean-like values |
| `uuid`    | "550e8400-e29b-..."   | UUID v1-v5 format               |
| `ip`      | "192.168.1.1"         | IPv4 and IPv6 addresses         |
| `json`    | '{"key": "value"}'    | Valid JSON strings              |

### How does duplicate detection work?

**Exact Matching:**

- Compares values across specified columns (or all columns)
- Case-sensitive by default
- Reports all duplicate occurrences

**Fuzzy Matching:**

- Uses Levenshtein distance for similarity
- Configurable threshold (default: 0.85 = 85% similar)
- Useful for typos and minor variations

### What outlier detection methods are available?

| Method      | Best For             | Description                            |
| ----------- | -------------------- | -------------------------------------- |
| **IQR**     | General use          | Values beyond 1.5× interquartile range |
| **Z-Score** | Normal distributions | Values beyond N standard deviations    |

---

## Pricing Questions

### How is pricing calculated?

DataGuard uses Pay-per-Event pricing:

| Event             | Cost     |
| ----------------- | -------- |
| Actor Start       | $0.00005 |
| Per Row Validated | $0.001   |

**Example Calculations:**

- 1,000 rows: $1.00
- 10,000 rows: $10.00
- 100,000 rows: $100.00

### Are there any free options?

Yes! Apify offers:

- **Free tier**: Monthly platform credits for new users
- **Sample mode**: Use `sampleSize` to validate fewer rows
- **Local testing**: Run locally with Apify CLI before deployment

### How do I estimate costs?

Use this formula:

```
Cost = $0.00005 + (Number of Rows × $0.001)
```

For large files, use sampling:

```json
{
  "sampleSize": 1000,
  "dataSourceUrl": "https://example.com/large-file.csv"
}
```

---

## Feature Questions

### What is Benford's Law analysis?

Benford's Law states that in naturally occurring datasets, the first digit is more likely to be small. DataGuard uses this to detect:

- **Fabricated data**: Manufactured numbers often don't follow Benford's Law
- **Fraud indicators**: Unusual first-digit distributions

Enable with: `"enableBenfordsLaw": true`

### What PII types can be detected?

| PII Type    | Pattern               | Example             |
| ----------- | --------------------- | ------------------- |
| Email       | Standard email format | user@example.com    |
| Phone       | International formats | +1-555-123-4567     |
| SSN         | US Social Security    | 123-45-6789         |
| Credit Card | Major card patterns   | 4111-1111-1111-1111 |
| IP Address  | IPv4/IPv6             | 192.168.1.1         |

### Can I define custom validation rules?

Yes! Use the `schemaDefinition` input:

```json
{
  "schemaDefinition": [
    {
      "name": "product_code",
      "type": "string",
      "required": true,
      "constraints": {
        "pattern": "^[A-Z]{3}-\\d{4}$",
        "minLength": 8,
        "maxLength": 8
      }
    }
  ]
}
```

### How do I handle missing values?

Use the `imputationStrategy` option:

| Strategy       | Description                     |
| -------------- | ------------------------------- |
| `remove`       | Remove rows with missing values |
| `mean`         | Fill with column average        |
| `median`       | Fill with column median         |
| `mode`         | Fill with most frequent value   |
| `forwardFill`  | Use previous row's value        |
| `backwardFill` | Use next row's value            |
| `constant`     | Use custom value                |

### How does historical trend analysis work?

When `enableHistoricalAnalysis` is true, DataGuard:

1. Stores quality metrics after each run
2. Compares with previous runs (last 10 by default)
3. Calculates trends (improving/declining/stable)
4. Detects anomalies using Z-score analysis
5. Predicts next run's quality score

### What third-party connectors are available?

| Connector  | Auth Type | Description                  |
| ---------- | --------- | ---------------------------- |
| Salesforce | OAuth     | Validate any SOQL query      |
| HubSpot    | API Key   | Contacts, Companies, Deals   |
| Stripe     | API Key   | Charges, Customers, Invoices |
| Airtable   | API Key   | Any table in any base        |

### How does seasonal detection work?

When `enableSeasonalDetection` is enabled, DataGuard analyzes:

- **Day-of-week patterns**: Detect weekend vs. weekday anomalies
- **Monthly patterns**: Identify month-over-month trends
- **Overall trends**: Linear regression on time-series data

### What is data lineage tracking?

When `enableDataLineage` is true, DataGuard tracks:

- All transformations applied to data
- Column-level changes
- Timing and sequence of operations
- Generates a visual flow diagram

---

## Integration Questions

### Can I use this with n8n/Make/Zapier?

Yes! See our [Workflow Templates](./WORKFLOW_TEMPLATES.md) for detailed integration guides.

### How do I get results via webhook?

1. Configure a webhook URL in Actor settings
2. The webhook fires when the run completes
3. Fetch results using the `runId` from the webhook payload

### Can I schedule regular validations?

Yes, using Apify Schedules:

1. Go to Actor page → **Schedules**
2. Create new schedule with cron expression
3. Define input configuration
4. Enable the schedule

---

## Troubleshooting

### Why is my file not parsing?

See our [Troubleshooting Guide](./TROUBLESHOOTING.md) for common parsing issues.

### Why are all my values showing as strings?

This usually means:

1. Auto-detection is disabled (`autoDetectTypes: false`)
2. No schema is defined
3. The column has mixed types

Solution: Enable auto-detection or provide explicit schema.

### Why is the Quality Score low?

Check the `issues` array for specific problems:

- High null percentage → Incomplete data
- Many type mismatches → Schema issues
- Excessive duplicates → Data quality problems

---

## Still Have Questions?

- **Discord**: [Apify Community](https://discord.gg/jyEM2PRvMU)
- **GitHub**: [Open an Issue](https://github.com/ar27111994/data-guard/issues)
- **Documentation**: [Apify Docs](https://docs.apify.com)
