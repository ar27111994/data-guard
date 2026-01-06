# Changelog

All notable changes to **DataGuard** will be documented in this file.

## [1.1.0] - 2026-01-06

### Added

#### Phase 2: Premium Features

- **Parquet File Support**: Parse Apache Parquet files with schema extraction
  - Requires optional `parquetjs-lite` package
  - Full type mapping to DataGuard types
- **Missing Value Imputation**: 7 strategies for handling missing data

  - `remove` - Remove rows with missing values
  - `mean` - Fill numeric columns with average
  - `median` - Fill with median value
  - `mode` - Fill with most frequent value
  - `forwardFill` - Use previous row's value (time-series)
  - `backwardFill` - Use next row's value
  - `constant` - Fill with custom value

- **Seasonal Anomaly Detection**: Time-based pattern analysis

  - Day-of-week pattern detection
  - Monthly seasonality analysis
  - Hourly patterns for timestamp data
  - Linear regression trend detection

- **Data Lineage Tracking**: Full transformation audit trail
  - Records all data transformations
  - Column-level change tracking
  - Mermaid flow diagram generation
  - Key-Value Store persistence

#### Phase 3: Integration & Ecosystem

- **Third-Party Connectors**: Direct API integrations

  - **Salesforce**: OAuth authentication, SOQL queries
  - **HubSpot**: Contacts, Companies, Deals validation
  - **Stripe**: Charges, Customers, Invoices, Subscriptions
  - **Airtable**: Any table from any base

- **Enhanced Google Sheets**: Improved integration

  - `googleSheetsId` - Select specific sheet by GID
  - `googleSheetsApiKey` - Access private sheets

- **Historical Trend Analysis**: ML-inspired quality tracking
  - Store metrics in Key-Value Store
  - Calculate trends (improving/declining/stable)
  - Z-score based anomaly detection
  - Predict next run quality score
  - Generate actionable recommendations

### Changed

- Updated input schema with 8 new configuration options
- Added `parquet` to format enum
- Enhanced error handling for all new modules

### Documentation

- Updated README.md with all new features
- Added 80+ lines to API.md with new parameters
- Added 50+ lines to FAQ.md with new Q&A entries
- Updated supported formats table with Parquet

### Testing

- **491 tests** across 26 test suites (up from 334)
- New test files:
  - `imputation.test.js` (20+ tests)
  - `seasonal-detector.test.js` (25+ tests)
  - `data-lineage.test.js` (20+ tests)
  - `connectors.test.js` (25+ tests)
  - `historical-analyzer.test.js` (39 tests)
  - `google-sheets.test.js` (26 tests)

---

## [1.0.0] - 2026-01-05

### Added

#### Core Features

- **Multi-format parsing**: CSV, JSON, JSONL, Excel (XLSX/XLS)
- **12+ type validators**: string, number, integer, date, email, phone, url, boolean, uuid, ip, json
- **Schema validation**: Define column types, constraints, and required fields
- **Constraint validation**: min/max, pattern (regex), enum, minLength/maxLength

#### Data Quality

- **Duplicate detection**: Exact and fuzzy matching with configurable similarity threshold
- **Outlier detection**: IQR and Z-Score methods with configurable thresholds
- **PII detection**: Email, phone, SSN, credit card, IP address detection with masking
- **Quality scoring**: 0-100 score with A-F grade based on completeness, validity, uniqueness

#### Advanced Analytics

- **Benford's Law analysis**: Fraud detection using first-digit distribution
- **Correlation analysis**: Pearson coefficient calculation for numeric columns
- **Pattern detection**: ML-inspired statistical pattern recognition
- **Histogram profiling**: Cardinality and distribution analysis

#### Data Remediation

- **Auto-fixer**: Trim, case normalization, duplicate removal, empty row removal
- **Duplicate handler**: Multiple strategies (flag, keep first/last, merge, remove all)
- **Cleaned data export**: Generate remediated dataset

#### Reporting & Export

- **HTML reports**: Professional styled reports with all metrics
- **Cloud storage**: S3, GCS, Azure Blob via presigned URLs
- **Audit trail**: Compliance tracking for all operations
- **Recommendations engine**: Actionable improvement suggestions

#### Integrations

- **Google Sheets**: Direct sheet validation via public URLs
- **Workflow templates**: n8n, Make, Zapier, LangChain integration guides

#### Performance & Reliability

- **Streaming parser**: Batch processing for large files
- **Memory management**: Chunk processing, pressure monitoring
- **Comprehensive error handling**: Categorized errors, retry logic, user-friendly messages

### Security

- Replaced vulnerable `xlsx` package with `exceljs` (0 vulnerabilities)
- XSS prevention in HTML reports
- PII masking for sensitive data

### Testing

- **334 tests** across 18 test suites
- Coverage: type validation, parsing, duplicates, outliers, PII, errors, scoring, analytics

---

## [0.1.0] - 2025-12-XX

### Added

- Initial release with basic CSV validation
- Type checking and null detection
- Simple quality scoring
