<p align="center">
  <img src="docs/logo.png" alt="DataGuard Logo" width="120" height="120">
</p>

<h1 align="center">🛡️ DataGuard</h1>
<p align="center"><strong>Data Quality Checker & ETL Validator</strong></p>

<p align="center">
  <a href="https://github.com/ar27111994/data-guard"><img src="https://img.shields.io/badge/version-1.1.0-blue.svg" alt="Version"></a>
  <a href="https://github.com/ar27111994/data-guard/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-ISC-green.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/tests-491%20passed-brightgreen.svg" alt="Tests">
  <img src="https://img.shields.io/coderabbit/prs/github/ar27111994/data-guard?utm_source=oss&utm_medium=github&utm_campaign=ar27111994%2Fdata-guard&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews" alt="CodeRabbit Pull Request Reviews">
</p>

<p align="center">
Enterprise-grade data quality validation for CSV, Excel, JSON, and Parquet files.<br>
Detect type mismatches, duplicates, outliers, missing values, and PII—all without writing code.
</p>

## 🏆 Why This Tool?

| Feature               |    Other Tools     |     This Actor      |
| --------------------- | :----------------: | :-----------------: |
| **No-Code Interface** | ❌ Requires coding |  ✅ Point & click   |
| **Multi-Format**      |    ⚠️ CSV only     | ✅ CSV, Excel, JSON |
| **Outlier Detection** |     ❌ Manual      |  ✅ IQR & Z-Score   |
| **PII Detection**     |  ❌ Separate tool  |     ✅ Built-in     |
| **Quality Score**     |     ❌ Custom      | ✅ 0-100 automatic  |
| **Pay-per-Use**       |  ❌ Monthly fees   |    ✅ $0.001/row    |

## ⚡ Quick Start

1. **Provide your data** via URL, inline text, or base64
2. **Configure validation rules** (or use auto-detection)
3. **Run the Actor** and get instant results

### Example Input

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

### Example Output

```json
{
  "qualityScore": 85,
  "totalRows": 10000,
  "validRows": 9250,
  "invalidRows": 750,
  "issues": [
    {
      "rowNumber": 42,
      "column": "email",
      "issueType": "type-mismatch",
      "message": "Value 'not-an-email' is not a valid email"
    }
  ]
}
```

## 🔧 Features

### Core Validation

- **Type Validation**: 12+ types (string, number, date, email, phone, URL, UUID, IP, boolean, JSON)
- **Required Fields**: Ensure mandatory fields are present
- **Pattern Matching**: Validate against regex patterns
- **Range Constraints**: Min/max for numbers, length limits for strings
- **Enum Validation**: Restrict to allowed values

### Duplicate Detection

- **Exact Matching**: Find identical rows
- **Fuzzy Matching**: Detect near-duplicates with configurable similarity threshold
- **Custom Columns**: Choose which columns to check for duplicates

### Statistical Analysis

- **Outlier Detection**: IQR and Z-Score methods
- **Data Profiling**: Statistics per column (min, max, mean, median, std dev)
- **Quality Scoring**: 0-100 score based on completeness, validity, uniqueness, consistency

### Compliance & Security

- **PII Detection**: Email, phone, SSN, credit card, IP address patterns
- **Risk Assessment**: Critical/High/Medium/Low risk categorization
- **Value Masking**: Sensitive data displayed with masking

### Data Remediation

- **Auto-Fix**: Trim whitespace, normalize case, remove empty rows
- **Duplicate Removal**: Automatically deduplicate data
- **Export**: Download cleaned CSV

### Missing Value Imputation

- **Mean/Median/Mode**: Statistical filling strategies
- **Forward/Backward Fill**: Time-series aware filling
- **Constant Value**: Custom default values

### Advanced Analytics

- **Benford's Law**: Fraud detection for financial data
- **Correlation Analysis**: Detect relationships between columns
- **Seasonal Detection**: Day/week/month pattern analysis
- **Historical Trend Analysis**: Track quality over time with predictions

### Data Lineage

- **Transformation Tracking**: Full audit trail of all changes
- **Flow Diagrams**: Visual representation of data pipeline
- **Compliance Reports**: GDPR/CCPA audit support

### Third-Party Integrations

- **Google Sheets**: Direct validation from spreadsheets
- **Salesforce**: Validate CRM exports
- **HubSpot**: Check contact/company data quality
- **Stripe**: Validate payment data
- **Airtable**: Database validation

## 📊 Supported Formats

| Format     | Extension       | Features                                   |
| ---------- | --------------- | ------------------------------------------ |
| CSV        | .csv            | Auto-delimiter detection, encoding support |
| Excel      | .xlsx, .xls     | Multi-sheet, cell formatting preservation  |
| JSON       | .json           | Object arrays, nested structure handling   |
| JSON Lines | .jsonl, .ndjson | Streaming support for large files          |
| Parquet    | .parquet        | Columnar format, schema extraction         |

## 💰 Pricing (Pay-per-Event)

| Event         | Price    |
| ------------- | -------- |
| Actor Start   | $0.00005 |
| Row Validated | $0.001   |

**Example**: 100,000 rows = $100

## 🔌 Integration Examples

### n8n Workflow

```javascript
// After HTTP Request node
{
  "dataSourceUrl": "{{ $json.fileUrl }}",
  "checkDuplicates": true,
  "detectPII": true
}
```

### Make (Integromat)

Connect the Apify module to any data source and trigger validation on schedule.

### API Call

```bash
curl -X POST "https://api.apify.com/v2/acts/YOUR_ACTOR_ID/runs" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"dataSourceUrl": "https://example.com/data.csv"}'
```

## 📈 Use Cases

1. **ETL Pipeline Validation**: Validate data before warehouse load
2. **Data Migration QA**: Ensure data integrity during migrations
3. **Compliance Audits**: Detect PII for GDPR/CCPA compliance
4. **Lead Quality Check**: Validate CRM data quality
5. **API Response Validation**: Verify external API data quality

## 🤝 Support

- **Documentation**: See input schema for all options
- **Issues**: [GitHub Issues](https://github.com/ar27111994)
- **Updates**: Follow for new features and improvements

---

**🛡️ DataGuard - Built with ❤️ for data quality enthusiasts**
