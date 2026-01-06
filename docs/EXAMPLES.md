# 💻 Code Examples

Complete code examples for integrating DataGuard in various languages and platforms.

---

## Table of Contents

- [cURL](#curl)
- [Python](#python)
- [JavaScript/Node.js](#javascriptnodejs)
- [TypeScript](#typescript)
- [Go](#go)
- [PHP](#php)

---

## cURL

### Basic Validation

```bash
curl -X POST "https://api.apify.com/v2/acts/YOUR_USERNAME~dataguard/runs?token=YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataSourceUrl": "https://example.com/data.csv",
    "checkDuplicates": true,
    "detectOutliers": "iqr"
  }'
```

### With Inline Data

```bash
curl -X POST "https://api.apify.com/v2/acts/YOUR_USERNAME~dataguard/runs?token=YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataSourceInline": "id,name,email\n1,John,john@example.com\n2,Jane,invalid-email",
    "format": "csv",
    "hasHeader": true
  }'
```

### Get Results

```bash
# Get run status
curl "https://api.apify.com/v2/actor-runs/RUN_ID?token=YOUR_API_TOKEN"

# Get output data
curl "https://api.apify.com/v2/actor-runs/RUN_ID/dataset/items?token=YOUR_API_TOKEN"
```

### Synchronous Run (Wait for Result)

```bash
curl -X POST "https://api.apify.com/v2/acts/YOUR_USERNAME~dataguard/run-sync-get-dataset-items?token=YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataSourceUrl": "https://example.com/small-file.csv"
  }'
```

---

## Python

### Installation

```bash
pip install apify-client
```

### Basic Usage

```python
from apify_client import ApifyClient

# Initialize the client
client = ApifyClient("YOUR_API_TOKEN")

# Run the Actor
run_input = {
    "dataSourceUrl": "https://example.com/data.csv",
    "checkDuplicates": True,
    "detectOutliers": "iqr",
    "detectPII": True
}

run = client.actor("YOUR_USERNAME/dataguard").call(run_input=run_input)

# Get results
dataset = client.dataset(run["defaultDatasetId"])
results = list(dataset.iterate_items())

# Process results
for result in results:
    print(f"Quality Score: {result['summary']['qualityScore']}")
    print(f"Total Rows: {result['summary']['totalRows']}")
    print(f"Issues Found: {len(result['issues'])}")
```

### With Schema Definition

```python
from apify_client import ApifyClient

client = ApifyClient("YOUR_API_TOKEN")

run_input = {
    "dataSourceUrl": "https://example.com/customers.csv",
    "schemaDefinition": [
        {
            "name": "customer_id",
            "type": "integer",
            "required": True,
            "unique": True
        },
        {
            "name": "email",
            "type": "email",
            "required": True
        },
        {
            "name": "age",
            "type": "integer",
            "constraints": {
                "min": 0,
                "max": 150
            }
        },
        {
            "name": "status",
            "type": "string",
            "constraints": {
                "allowedValues": ["active", "inactive", "pending"]
            }
        }
    ]
}

run = client.actor("YOUR_USERNAME/dataguard").call(run_input=run_input)
print(run)
```

### Async Processing

```python
import asyncio
from apify_client import ApifyClientAsync

async def validate_data():
    client = ApifyClientAsync("YOUR_API_TOKEN")

    run_input = {
        "dataSourceUrl": "https://example.com/large-file.csv",
        "sampleSize": 10000
    }

    # Start the run
    run = await client.actor("YOUR_USERNAME/dataguard").start(run_input=run_input)

    # Wait for completion
    run_info = await client.run(run["id"]).wait_for_finish()

    # Get results
    dataset = client.dataset(run_info["defaultDatasetId"])
    results = []
    async for item in dataset.iterate_items():
        results.append(item)

    return results

# Run
results = asyncio.run(validate_data())
```

### Error Handling

```python
from apify_client import ApifyClient
from apify_client.exceptions import ApifyApiError

client = ApifyClient("YOUR_API_TOKEN")

try:
    run = client.actor("YOUR_USERNAME/dataguard").call(
        run_input={"dataSourceUrl": "https://example.com/data.csv"}
    )

    if run["status"] == "SUCCEEDED":
        dataset = client.dataset(run["defaultDatasetId"])
        for item in dataset.iterate_items():
            if item["summary"]["qualityScore"] < 80:
                print("Warning: Low quality score!")
    else:
        print(f"Run failed with status: {run['status']}")

except ApifyApiError as e:
    print(f"API Error: {e.message}")
except Exception as e:
    print(f"Error: {str(e)}")
```

---

## JavaScript/Node.js

### Installation

```bash
npm install apify-client
```

### Basic Usage

```javascript
import { ApifyClient } from "apify-client";

const client = new ApifyClient({
  token: "YOUR_API_TOKEN",
});

async function validateData() {
  const run = await client.actor("YOUR_USERNAME/dataguard").call({
    dataSourceUrl: "https://example.com/data.csv",
    checkDuplicates: true,
    detectOutliers: "iqr",
    detectPII: true,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  for (const result of items) {
    console.log(`Quality Score: ${result.summary.qualityScore}`);
    console.log(`Issues: ${result.issues.length}`);
  }

  return items;
}

validateData().catch(console.error);
```

### With Webhooks

```javascript
import { ApifyClient } from "apify-client";

const client = new ApifyClient({ token: "YOUR_API_TOKEN" });

async function startValidationWithWebhook() {
  const run = await client.actor("YOUR_USERNAME/dataguard").start(
    {
      dataSourceUrl: "https://example.com/data.csv",
    },
    {
      webhooks: [
        {
          eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
          requestUrl: "https://your-app.com/webhook",
        },
      ],
    },
  );

  console.log(`Started run: ${run.id}`);
  return run.id;
}
```

### Express.js Webhook Handler

```javascript
import express from "express";
import { ApifyClient } from "apify-client";

const app = express();
const client = new ApifyClient({ token: "YOUR_API_TOKEN" });

app.use(express.json());

app.post("/webhook", async (req, res) => {
  const { eventType, eventData } = req.body;

  if (eventType === "ACTOR.RUN.SUCCEEDED") {
    const runId = eventData.actorRunId;
    const run = await client.run(runId).get();
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Process results
    console.log("Validation complete:", items[0].summary);
  }

  res.status(200).send("OK");
});

app.listen(3000);
```

---

## TypeScript

### Type Definitions

```typescript
interface ValidationInput {
  dataSourceUrl?: string;
  dataSourceInline?: string;
  dataSourceBase64?: string;
  format?: "auto" | "csv" | "xlsx" | "xls" | "json" | "jsonl";
  checkDuplicates?: boolean;
  detectOutliers?: "none" | "iqr" | "zscore";
  detectPII?: boolean;
  schemaDefinition?: SchemaColumn[];
}

interface SchemaColumn {
  name: string;
  type:
    | "string"
    | "number"
    | "integer"
    | "date"
    | "email"
    | "phone"
    | "url"
    | "boolean"
    | "uuid"
    | "ip"
    | "json";
  required?: boolean;
  unique?: boolean;
  constraints?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    allowedValues?: string[];
  };
}

interface ValidationResult {
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    qualityScore: number;
    grade: string;
    processingTimeMs: number;
  };
  issues: Issue[];
  columnAnalysis: ColumnAnalysis[];
  recommendations: string[];
}

interface Issue {
  rowNumber: number;
  column: string;
  value: string;
  issueType: string;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
}
```

### Usage with Types

```typescript
import { ApifyClient } from "apify-client";

const client = new ApifyClient({ token: "YOUR_API_TOKEN" });

async function validateData(
  input: ValidationInput,
): Promise<ValidationResult[]> {
  const run = await client.actor("YOUR_USERNAME/dataguard").call(input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items as ValidationResult[];
}

// Usage
const results = await validateData({
  dataSourceUrl: "https://example.com/data.csv",
  checkDuplicates: true,
  schemaDefinition: [
    { name: "id", type: "integer", required: true, unique: true },
    { name: "email", type: "email", required: true },
  ],
});

console.log(`Quality: ${results[0].summary.qualityScore}%`);
```

---

## Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

const apiToken = "YOUR_API_TOKEN"
const actorID = "YOUR_USERNAME~dataguard"

type ValidationInput struct {
    DataSourceURL   string `json:"dataSourceUrl"`
    CheckDuplicates bool   `json:"checkDuplicates"`
    DetectOutliers  string `json:"detectOutliers"`
}

type RunResponse struct {
    Data struct {
        ID               string `json:"id"`
        DefaultDatasetID string `json:"defaultDatasetId"`
        Status           string `json:"status"`
    } `json:"data"`
}

func main() {
    input := ValidationInput{
        DataSourceURL:   "https://example.com/data.csv",
        CheckDuplicates: true,
        DetectOutliers:  "iqr",
    }

    jsonData, _ := json.Marshal(input)

    url := fmt.Sprintf("https://api.apify.com/v2/acts/%s/run-sync?token=%s", actorID, apiToken)

    resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)

    var result RunResponse
    json.Unmarshal(body, &result)

    fmt.Printf("Run ID: %s\n", result.Data.ID)
    fmt.Printf("Status: %s\n", result.Data.Status)
}
```

---

## PHP

```php
<?php

$apiToken = 'YOUR_API_TOKEN';
$actorId = 'YOUR_USERNAME~dataguard';

$input = [
    'dataSourceUrl' => 'https://example.com/data.csv',
    'checkDuplicates' => true,
    'detectOutliers' => 'iqr'
];

$url = "https://api.apify.com/v2/acts/{$actorId}/run-sync-get-dataset-items?token={$apiToken}";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($input));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
curl_close($ch);

$results = json_decode($response, true);

foreach ($results as $result) {
    echo "Quality Score: " . $result['summary']['qualityScore'] . "\n";
    echo "Total Rows: " . $result['summary']['totalRows'] . "\n";
    echo "Issues Found: " . count($result['issues']) . "\n";
}
```

---

## More Examples

For workflow-specific examples, see:

- [Workflow Templates](./WORKFLOW_TEMPLATES.md) - n8n, Make, Zapier, LangChain
- [API Documentation](./API.md) - Complete API reference
