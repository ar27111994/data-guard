# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please
report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email us at **ar27111994@gmail.com** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-48 hours
  - High: 7 days
  - Medium: 30 days
  - Low: Next release

### Security Best Practices for Users

1. **API Keys**: Never commit API keys or credentials
2. **PII Detection**: Enable `detectPII` for sensitive data
3. **Data Sources**: Only use trusted data source URLs
4. **Third-party Connectors**: Use secure credential storage

## Scope

This security policy covers:

- The DataGuard Actor source code
- Dependencies and their known vulnerabilities
- Data handling and processing

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers
in our release notes (with permission).
