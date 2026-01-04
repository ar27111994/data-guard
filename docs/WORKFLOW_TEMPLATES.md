# Workflow Templates

Pre-built workflow configurations for popular automation platforms.

## n8n: Validate CSV Before Warehouse Load

```json
{
  "name": "CSV Validation Pipeline",
  "nodes": [
    {
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://your-data-source.com/export.csv",
        "method": "GET"
      }
    },
    {
      "name": "Apify Actor",
      "type": "@apify/n8n-nodes-apify.apifyActor",
      "parameters": {
        "actorId": "YOUR_ACTOR_ID",
        "input": {
          "dataSourceUrl": "={{ $json.url }}",
          "checkDuplicates": true,
          "detectOutliers": "iqr",
          "generateCleanData": true
        }
      }
    },
    {
      "name": "IF",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{ $json.qualityScore }}",
              "operation": "largerEqual",
              "value2": 80
            }
          ]
        }
      }
    },
    {
      "name": "Load to Warehouse",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "insert"
      }
    }
  ]
}
```

## Make (Integromat): Data Quality Check in ETL Pipeline

1. **Trigger**: Schedule (daily) or Webhook
2. **Module 1**: HTTP - Download CSV from source
3. **Module 2**: Apify - Run Data Quality Checker
   - Actor ID: `YOUR_ACTOR_ID`
   - Input:
     ```json
     {
       "dataSourceUrl": "{{1.url}}",
       "checkDuplicates": true,
       "detectPII": true,
       "generateCleanData": true
     }
     ```
4. **Module 3**: Router
   - Route 1: If `qualityScore >= 80` → Load to database
   - Route 2: If `qualityScore < 80` → Send alert email

## Zapier: Validate Exported Spreadsheets

**Trigger**: New File in Google Drive / Dropbox

**Action 1**: Apify - Run Actor

- Actor: CSV/Excel Data Quality Checker
- Input:
  ```json
  {
    "dataSourceUrl": "{{file_url}}",
    "format": "auto",
    "checkDuplicates": true,
    "detectOutliers": "iqr"
  }
  ```

**Action 2**: Filter

- Condition: `qualityScore < 80`

**Action 3**: Send Email Alert

```
Subject: Data Quality Alert - {{file_name}}
Body:
Quality Score: {{qualityScore}}/100
Invalid Rows: {{invalidRows}}
Issues Found: {{issueCount}}
```

## LangChain: Ensure Dataset Quality for ML

```python
from langchain.tools import ApifyWrapperTool
from langchain.agents import initialize_agent, AgentType
from langchain.llms import OpenAI

# Initialize the Apify tool
apify_tool = ApifyWrapperTool(
    apify_actor_id="YOUR_ACTOR_ID",
    name="data_quality_checker",
    description="Validates CSV/Excel data quality before ML training"
)

# Create an agent
llm = OpenAI(temperature=0)
agent = initialize_agent(
    [apify_tool],
    llm,
    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True
)

# Use in your ML pipeline
def validate_training_data(data_url: str) -> dict:
    """Validate data quality before training."""
    result = agent.run(f"""
    Validate the data at {data_url} for ML training:
    1. Check for duplicates
    2. Detect outliers using IQR method
    3. Identify missing values
    4. Calculate overall quality score

    Return the quality score and any critical issues.
    """)
    return result
```

---

## API Integration Example

```javascript
// Direct API call
const response = await fetch(
  "https://api.apify.com/v2/acts/YOUR_ACTOR_ID/runs",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer YOUR_API_TOKEN",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dataSourceUrl: "https://example.com/data.csv",
      checkDuplicates: true,
      detectOutliers: "iqr",
      detectPII: true,
      generateCleanData: true,
    }),
  }
);

const run = await response.json();

// Poll for results
const results = await fetch(
  `https://api.apify.com/v2/actor-runs/${run.data.id}/dataset/items`
);
```
