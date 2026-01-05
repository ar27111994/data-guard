# 🔧 Troubleshooting Guide

Solutions to common issues when using the DataGuard Data Quality Checker.

---

## Data Source Issues

### Error: "No data source provided"

**Cause:** No valid data source was specified in the input.

**Solution:** Provide at least one of:

- `dataSourceUrl` - URL to your file
- `dataSourceInline` - Paste data directly
- `dataSourceBase64` - Base64-encoded file content

```json
{
  "dataSourceUrl": "https://example.com/data.csv"
}
```

---

### Error: "Failed to fetch URL"

**Possible Causes:**

1. URL is not accessible
2. URL requires authentication
3. SSL certificate issues
4. Firewall blocking requests

**Solutions:**

1. **Verify URL is public:**

   ```bash
   curl -I "https://example.com/data.csv"
   ```

2. **Check for redirects:** Use the final URL after redirects

3. **For authenticated URLs:** Use base64 encoding instead:

   ```bash
   # Download locally, then encode
   base64 -w 0 data.csv > data.b64
   ```

4. **For Apify storage:** Use the raw URL format:
   ```
   https://api.apify.com/v2/key-value-stores/{storeId}/records/{key}
   ```

---

### Error: "Invalid base64 format"

**Cause:** The base64 data is malformed or contains invalid characters.

**Solution:**

1. **Encode correctly:**

   ```bash
   # Linux/Mac
   base64 -w 0 yourfile.csv

   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("yourfile.csv"))
   ```

2. **Remove line breaks:** Ensure the base64 string has no newlines

3. **Check for padding:** Valid base64 ends with 0-2 `=` characters

---

## Parsing Issues

### Error: "Failed to parse CSV"

**Common Causes:**

1. Wrong delimiter detected
2. Encoding issues
3. Malformed quotes

**Solutions:**

1. **Specify delimiter explicitly:**

   ```json
   {
     "csvDelimiter": ";",
     "dataSourceUrl": "https://example.com/data.csv"
   }
   ```

2. **Specify encoding:**

   ```json
   {
     "encoding": "latin1",
     "dataSourceUrl": "https://example.com/data.csv"
   }
   ```

3. **Check for quote issues:** Ensure quoted fields use proper escaping:
   - Correct: `"value with ""quotes"""`
   - Wrong: `"value with "quotes""`

---

### Error: "Failed to parse Excel file"

**Possible Causes:**

1. File is password-protected
2. File is corrupted
3. Unsupported Excel version

**Solutions:**

1. **Remove password protection** before uploading

2. **Try opening in Excel** to verify file integrity

3. **Convert to CSV** if Excel parsing continues to fail:

   ```
   File → Save As → CSV (Comma delimited)
   ```

4. **Specify sheet explicitly:**
   ```json
   {
     "excelSheet": "Sheet1",
     "format": "xlsx"
   }
   ```

---

### Error: "No data rows found"

**Cause:** The file was parsed but contains no data rows.

**Solutions:**

1. **Check if file is empty**

2. **Verify header setting:**

   ```json
   {
     "hasHeader": true
   }
   ```

   Set to `false` if there's no header row.

3. **Check file format:** Ensure it's actually the format you think it is

---

## Validation Issues

### All values show as type "string"

**Cause:** Type detection is disabled or no schema provided.

**Solutions:**

1. **Enable auto-detection:**

   ```json
   {
     "autoDetectTypes": true
   }
   ```

2. **Provide explicit schema:**
   ```json
   {
     "schemaDefinition": [
       { "name": "id", "type": "integer" },
       { "name": "price", "type": "number" }
     ]
   }
   ```

---

### Too many issues reported

**Cause:** Large file with many quality problems.

**Solutions:**

1. **Limit issues per type:**

   ```json
   {
     "maxIssuesPerType": 50
   }
   ```

2. **Use sampling for initial analysis:**

   ```json
   {
     "sampleSize": 1000
   }
   ```

3. **Focus on specific columns:**
   ```json
   {
     "ignoredColumns": ["internal_id", "metadata"]
   }
   ```

---

### Outliers not detected

**Possible Causes:**

1. Outlier detection is disabled
2. Column is not numeric
3. Not enough data points

**Solutions:**

1. **Enable outlier detection:**

   ```json
   {
     "detectOutliers": "iqr"
   }
   ```

2. **Adjust Z-score threshold:**

   ```json
   {
     "detectOutliers": "zscore",
     "zscoreThreshold": 2
   }
   ```

3. **Ensure numeric columns:** Check that values are actually numbers, not strings

---

### Duplicates not found

**Possible Causes:**

1. Duplicate detection disabled
2. Using wrong columns
3. Case sensitivity

**Solutions:**

1. **Enable duplicate checking:**

   ```json
   {
     "checkDuplicates": true
   }
   ```

2. **Specify columns to check:**

   ```json
   {
     "duplicateColumns": ["email", "phone"]
   }
   ```

3. **Enable fuzzy matching for near-duplicates:**
   ```json
   {
     "fuzzyDuplicates": true,
     "fuzzySimilarityThreshold": 0.8
   }
   ```

---

## Performance Issues

### Run times out

**Cause:** File is too large or processing takes too long.

**Solutions:**

1. **Increase memory:**

   ```json
   {
     "memory": 4096
   }
   ```

2. **Use sampling:**

   ```json
   {
     "sampleSize": 10000
   }
   ```

3. **Disable expensive features:**
   ```json
   {
     "enableBenfordsLaw": false,
     "enableCorrelationAnalysis": false,
     "fuzzyDuplicates": false
   }
   ```

---

### High memory usage

**Cause:** Large file loaded entirely into memory.

**Solutions:**

1. **Use sampling** to reduce memory footprint

2. **Split large files** into smaller chunks

3. **Allocate more memory** in run configuration

---

## Output Issues

### HTML report not generated

**Cause:** HTML report generation is disabled.

**Solution:**

```json
{
  "generateHTMLReport": true
}
```

The report URL will be in `htmlReportUrl` in the output.

---

### Missing fields in output

**Cause:** Certain analyses are disabled by default.

**Solution:** Enable the features you need:

```json
{
  "enableBenfordsLaw": true,
  "enableCorrelationAnalysis": true,
  "enablePatternDetection": true,
  "detectPII": true
}
```

---

## Integration Issues

### Webhook not firing

**Checklist:**

1. ✅ Webhook URL is accessible from the internet
2. ✅ URL accepts POST requests
3. ✅ Correct events are selected
4. ✅ No firewall blocking Apify IPs

**Test webhook:**

```bash
curl -X POST your-webhook-url \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

### API authentication failing

**Solutions:**

1. **Check token validity** at console.apify.com

2. **Use correct header format:**

   ```
   Authorization: Bearer YOUR_TOKEN
   ```

3. **URL-encode tokens** if using query parameter

---

## Still Stuck?

### Debug Mode

Check the Actor logs for detailed error messages:

1. Go to Apify Console → Actors → Your Actor → Runs
2. Click on the failed run
3. View the **Log** tab for details

### Get Help

- **Discord**: [Apify Community](https://discord.gg/jyEM2PRvMU)
- **GitHub**: [Open an Issue](https://github.com/ar27111994/data-guard/issues)
- **Email**: support@apify.com
