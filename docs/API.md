# 📚 API Documentation

Complete API reference for the DataGuard Data Quality Checker & ETL Validator.

---

## Authentication

All API requests to the Apify platform require authentication via API token.

### Getting Your Token

1. Log in to [Apify Console](https://console.apify.com)
2. Go to **Settings** → **Integrations**
3. Copy your **Personal API Token**

### Using the Token

Include the token in the `Authorization` header:

```bash
Authorization: Bearer YOUR_API_TOKEN
```

Or as a query parameter:

```text
?token=YOUR_API_TOKEN
```

---

## Endpoints

### Run Actor

Starts a new Actor run with the provided input.

```http
POST https://api.apify.com/v2/acts/{actorId}/runs
```

**Path Parameters:**

| Parameter | Type   | Description                     |
| --------- | ------ | ------------------------------- |
| `actorId` | string | Actor ID or username~actor-name |

**Request Body:**

```json
{
  "dataSourceUrl": "https://example.com/data.csv",
  "format": "auto",
  "hasHeader": true,
  "checkDuplicates": true,
  "detectOutliers": "iqr",
  "detectPII": true
}
```

**Response:**

```json
{
  "data": {
    "id": "run-id-here",
    "actId": "actor-id",
    "status": "RUNNING",
    "startedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### Get Run Status

Check the status of a running or completed Actor run.

```http
GET https://api.apify.com/v2/actor-runs/{runId}
```

**Response:**

```json
{
  "data": {
    "id": "run-id",
    "status": "SUCCEEDED",
    "startedAt": "2024-01-15T10:30:00.000Z",
    "finishedAt": "2024-01-15T10:30:15.000Z"
  }
}
```

**Status Values:**

| Status      | Description            |
| ----------- | ---------------------- |
| `READY`     | Waiting to start       |
| `RUNNING`   | Currently executing    |
| `SUCCEEDED` | Completed successfully |
| `FAILED`    | Completed with errors  |
| `ABORTED`   | Manually stopped       |
| `TIMED-OUT` | Exceeded time limit    |

---

### Get Run Output

Retrieve the output from a completed Actor run.

```http
GET https://api.apify.com/v2/actor-runs/{runId}/dataset/items
```

**Query Parameters:**

| Parameter | Type    | Default | Description                         |
| --------- | ------- | ------- | ----------------------------------- |
| `format`  | string  | `json`  | Output format: `json`, `csv`, `xml` |
| `limit`   | integer | 1000    | Maximum items to return             |
| `offset`  | integer | 0       | Number of items to skip             |

**Response:**

```json
[
  {
    "summary": {
      "totalRows": 10000,
      "validRows": 9500,
      "invalidRows": 500,
      "qualityScore": 95
    },
    "issues": [...],
    "columnAnalysis": [...],
    "recommendations": [...]
  }
]
```

---

## Input Schema Reference

### Data Source Options

| Field              | Type   | Required | Description                |
| ------------------ | ------ | -------- | -------------------------- |
| `dataSourceUrl`    | string | No\*     | URL to CSV/Excel/JSON file |
| `dataSourceInline` | string | No\*     | Inline data content        |
| `dataSourceBase64` | string | No\*     | Base64-encoded file        |

\*At least one data source is required.

### Format Options

| Field          | Type    | Default | Description                                              |
| -------------- | ------- | ------- | -------------------------------------------------------- |
| `format`       | enum    | `auto`  | `auto`, `csv`, `xlsx`, `xls`, `json`, `jsonl`, `parquet` |
| `csvDelimiter` | enum    | `auto`  | `auto`, `,`, `;`, `\t`, `\|`                             |
| `encoding`     | enum    | `utf-8` | `utf-8`, `latin1`, `utf-16`, `ascii`                     |
| `excelSheet`   | string  | -       | Sheet name or index                                      |
| `hasHeader`    | boolean | `true`  | First row contains headers                               |

### Validation Options

| Field                      | Type    | Default | Description                 |
| -------------------------- | ------- | ------- | --------------------------- |
| `checkDuplicates`          | boolean | `true`  | Enable duplicate detection  |
| `duplicateColumns`         | array   | `[]`    | Columns for duplicate check |
| `fuzzyDuplicates`          | boolean | `false` | Enable fuzzy matching       |
| `fuzzySimilarityThreshold` | number  | `0.85`  | Similarity threshold (0-1)  |
| `checkMissingValues`       | boolean | `true`  | Report null/empty values    |
| `detectOutliers`           | enum    | `iqr`   | `none`, `iqr`, `zscore`     |
| `zscoreThreshold`          | number  | `3`     | Z-score threshold (1-5)     |

### Advanced Options

| Field                       | Type    | Default | Description              |
| --------------------------- | ------- | ------- | ------------------------ |
| `detectPII`                 | boolean | `false` | Scan for PII data        |
| `piiTypes`                  | array   | `[...]` | PII types to detect      |
| `enableBenfordsLaw`         | boolean | `false` | Fraud detection analysis |
| `enableCorrelationAnalysis` | boolean | `false` | Column correlations      |
| `generateHTMLReport`        | boolean | `false` | Create HTML report       |
| `enableAuditTrail`          | boolean | `false` | Compliance logging       |

### Google Sheets Options

| Field                | Type   | Required | Description                              |
| -------------------- | ------ | -------- | ---------------------------------------- |
| `googleSheetsId`     | string | No       | Specific sheet GID (from URL `#gid=123`) |
| `googleSheetsApiKey` | string | No       | API key for private sheets               |

### Missing Value Imputation

| Field                | Type   | Default  | Description                                                                   |
| -------------------- | ------ | -------- | ----------------------------------------------------------------------------- |
| `imputationStrategy` | enum   | `remove` | `remove`, `mean`, `median`, `mode`, `forwardFill`, `backwardFill`, `constant` |
| `imputationConstant` | string | -        | Value to use when strategy is `constant`                                      |

### Historical Trend Analysis

| Field                      | Type    | Default | Description                        |
| -------------------------- | ------- | ------- | ---------------------------------- |
| `enableHistoricalAnalysis` | boolean | `false` | Track quality metrics over time    |
| `historicalCompareCount`   | integer | `10`    | Number of previous runs to compare |
| `dataSourceIdentifier`     | string  | -       | Custom identifier for tracking     |

### Seasonal Detection

| Field                     | Type    | Default | Description                    |
| ------------------------- | ------- | ------- | ------------------------------ |
| `enableSeasonalDetection` | boolean | `false` | Detect day/week/month patterns |

### Data Lineage

| Field               | Type    | Default | Description                    |
| ------------------- | ------- | ------- | ------------------------------ |
| `enableDataLineage` | boolean | `false` | Track all data transformations |

### Third-Party Connectors

| Field             | Type   | Required | Description                                       |
| ----------------- | ------ | -------- | ------------------------------------------------- |
| `connectorType`   | enum   | No       | `salesforce`, `hubspot`, `stripe`, `airtable`     |
| `connectorConfig` | object | No       | Connector-specific configuration (API keys, etc.) |

**Connector Configuration Examples:**

**Salesforce:**

```json
{
  "connectorType": "salesforce",
  "connectorConfig": {
    "accessToken": "YOUR_TOKEN",
    "instanceUrl": "https://your-org.salesforce.com"
  }
}
```

**HubSpot:**

```json
{
  "connectorType": "hubspot",
  "connectorConfig": {
    "apiKey": "YOUR_API_KEY"
  }
}
```

**Stripe:**

```json
{
  "connectorType": "stripe",
  "connectorConfig": {
    "secretKey": "sk_live_..."
  }
}
```

**Airtable:**

```json
{
  "connectorType": "airtable",
  "connectorConfig": {
    "apiKey": "YOUR_KEY",
    "baseId": "appXXX",
    "tableId": "tblXXX"
  }
}
```

---

## Output Schema Reference

### Summary Object

```json
{
  "summary": {
    "totalRows": 10000,
    "validRows": 9500,
    "invalidRows": 500,
    "qualityScore": 95,
    "grade": "A",
    "processingTimeMs": 1250
  }
}
```

### Issues Array

```json
{
  "issues": [
    {
      "rowNumber": 42,
      "column": "email",
      "value": "invalid-email",
      "issueType": "type-mismatch",
      "severity": "error",
      "message": "Value 'invalid-email' is not a valid email",
      "suggestion": "Provide a valid email address"
    }
  ]
}
```

**Issue Types:**

| Type                | Description               |
| ------------------- | ------------------------- |
| `null`              | Missing required value    |
| `type-mismatch`     | Wrong data type           |
| `duplicate`         | Duplicate row detected    |
| `pattern-violation` | Regex pattern mismatch    |
| `range-violation`   | Value outside min/max     |
| `outlier`           | Statistical outlier       |
| `enum-violation`    | Value not in allowed list |

---

## Error Codes

| Code                | HTTP Status | Description                    |
| ------------------- | ----------- | ------------------------------ |
| `INVALID_INPUT`     | 400         | Invalid input parameters       |
| `DATA_SOURCE_ERROR` | 400         | Cannot fetch/parse data source |
| `PARSE_ERROR`       | 400         | File parsing failed            |
| `TIMEOUT`           | 408         | Processing exceeded time limit |
| `INTERNAL_ERROR`    | 500         | Unexpected server error        |

**Error Response Format:**

```json
{
  "error": {
    "type": "INVALID_INPUT",
    "message": "No data source provided",
    "details": "Provide dataSourceUrl, dataSourceInline, or dataSourceBase64"
  }
}
```

---

## Rate Limits

The Apify platform enforces rate limits based on your subscription plan.

| Plan       | Requests/min | Concurrent Runs |
| ---------- | ------------ | --------------- |
| Free       | 60           | 1               |
| Personal   | 120          | 5               |
| Team       | 300          | 25              |
| Enterprise | Custom       | Custom          |

**Rate Limit Headers:**

```text
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1705312800
```

---

## Webhooks

Configure webhooks to receive notifications when Actor runs complete.

### Setup

1. Go to Actor settings in Apify Console
2. Add webhook URL under **Integrations**
3. Select events to trigger on

### Payload

```json
{
  "eventType": "ACTOR.RUN.SUCCEEDED",
  "eventData": {
    "actorId": "actor-id",
    "actorRunId": "run-id",
    "status": "SUCCEEDED"
  },
  "createdAt": "2024-01-15T10:30:15.000Z"
}
```

---

## SDK Examples

### Python

```python
from apify_client import ApifyClient

client = ApifyClient("YOUR_API_TOKEN")

run = client.actor("username/dataguard").call(run_input={
    "dataSourceUrl": "https://example.com/data.csv",
    "checkDuplicates": True,
    "detectPII": True
})

print(run["defaultDatasetId"])
```

### JavaScript

```javascript
import { ApifyClient } from "apify-client";

const client = new ApifyClient({ token: "YOUR_API_TOKEN" });

const run = await client.actor("username/dataguard").call({
  dataSourceUrl: "https://example.com/data.csv",
  checkDuplicates: true,
  detectPII: true,
});

console.log(run.defaultDatasetId);
```

---

## Support

- **Documentation**: [Apify Docs](https://docs.apify.com)
- **Discord**: [Apify Community](https://discord.gg/jyEM2PRvMU)
- **GitHub**: [Report Issues](https://github.com/ar27111994/data-guard)
