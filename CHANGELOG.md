# Changelog

All notable changes to **DataGuard** will be documented in this file.

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

## [0.1.0] - 2025-12-XX

### Added

- Initial release with basic CSV validation
- Type checking and null detection
- Simple quality scoring
