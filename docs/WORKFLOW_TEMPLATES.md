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
  },
);

const run = await response.json();

// Poll for results
const results = await fetch(
  `https://api.apify.com/v2/actor-runs/${run.data.id}/dataset/items`,
);
```

---

## GitHub Actions: CI/CD Data Validation

Validate data files on every pull request.

```yaml
# .github/workflows/data-validation.yml
name: Data Quality Check

on:
  pull_request:
    paths:
      - "data/**/*.csv"
      - "data/**/*.json"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Upload Data to Apify
        id: upload
        run: |
          # Upload file to Apify Key-Value Store
          RESPONSE=$(curl -X PUT \
            "https://api.apify.com/v2/key-value-stores/${{ secrets.APIFY_STORE_ID }}/records/pr-data" \
            -H "Authorization: Bearer ${{ secrets.APIFY_TOKEN }}" \
            -H "Content-Type: text/csv" \
            --data-binary @data/sample.csv)
          echo "Uploaded data file"

      - name: Run DataGuard Validation
        id: validate
        run: |
          RESULT=$(curl -X POST \
            "https://api.apify.com/v2/acts/${{ secrets.ACTOR_ID }}/run-sync-get-dataset-items?token=${{ secrets.APIFY_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "dataSourceUrl": "https://api.apify.com/v2/key-value-stores/${{ secrets.APIFY_STORE_ID }}/records/pr-data",
              "checkDuplicates": true,
              "detectOutliers": "iqr"
            }')

          SCORE=$(echo $RESULT | jq '.[0].summary.qualityScore')
          echo "quality_score=$SCORE" >> $GITHUB_OUTPUT

          if [ $(echo "$SCORE < 80" | bc -l) -eq 1 ]; then
            echo "Quality score $SCORE is below threshold"
            exit 1
          fi

      - name: Comment on PR
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const score = '${{ steps.validate.outputs.quality_score }}';
            const emoji = score >= 90 ? '🟢' : score >= 80 ? '🟡' : '🔴';
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## ${emoji} Data Quality Report\n\n**Quality Score:** ${score}/100`
            });
```

---

## Apache Airflow: Scheduled Data Pipeline

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.http.operators.http import SimpleHttpOperator
from datetime import datetime, timedelta
import json

default_args = {
    'owner': 'data-team',
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
}

def check_quality_score(**context):
    """Check if quality score meets threshold."""
    result = context['ti'].xcom_pull(task_ids='run_validation')
    data = json.loads(result)
    score = data[0]['summary']['qualityScore']

    if score < 80:
        raise ValueError(f"Quality score {score} below threshold 80")

    return score

with DAG(
    'data_quality_pipeline',
    default_args=default_args,
    description='Daily data quality validation',
    schedule_interval='@daily',
    start_date=datetime(2024, 1, 1),
    catchup=False,
) as dag:

    run_validation = SimpleHttpOperator(
        task_id='run_validation',
        http_conn_id='apify_api',
        endpoint='/v2/acts/YOUR_ACTOR_ID/run-sync-get-dataset-items',
        method='POST',
        headers={'Content-Type': 'application/json'},
        data=json.dumps({
            'dataSourceUrl': 'https://your-data-source.com/daily-export.csv',
            'checkDuplicates': True,
            'detectOutliers': 'iqr',
            'detectPII': True
        }),
        response_check=lambda response: response.status_code == 200,
    )

    check_score = PythonOperator(
        task_id='check_quality_score',
        python_callable=check_quality_score,
    )

    run_validation >> check_score
```

---

## LangChain: Advanced AI Agent Integration

### As a Custom Tool

```python
from langchain.tools import BaseTool
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from apify_client import ApifyClient
from pydantic import BaseModel, Field
from typing import Optional

class DataQualityInput(BaseModel):
    """Input schema for data quality validation."""
    data_url: str = Field(description="URL to the CSV/Excel/JSON file to validate")
    check_duplicates: bool = Field(default=True, description="Whether to check for duplicates")
    detect_pii: bool = Field(default=False, description="Whether to scan for PII")

class DataQualityTool(BaseTool):
    """Tool for validating data quality using DataGuard."""

    name: str = "data_quality_checker"
    description: str = """
    Validates CSV, Excel, or JSON data files for quality issues.
    Returns a quality score (0-100), detected issues, and recommendations.
    Use this tool before loading data into databases or training ML models.
    """
    args_schema: type[BaseModel] = DataQualityInput

    def __init__(self, api_token: str, actor_id: str):
        super().__init__()
        self.client = ApifyClient(api_token)
        self.actor_id = actor_id

    def _run(
        self,
        data_url: str,
        check_duplicates: bool = True,
        detect_pii: bool = False
    ) -> str:
        """Run data quality validation."""
        run = self.client.actor(self.actor_id).call(run_input={
            'dataSourceUrl': data_url,
            'checkDuplicates': check_duplicates,
            'detectPII': detect_pii,
            'detectOutliers': 'iqr'
        })

        dataset = self.client.dataset(run['defaultDatasetId'])
        results = list(dataset.iterate_items())[0]

        summary = results['summary']
        issues_count = len(results.get('issues', []))

        return f"""
Data Quality Report:
- Quality Score: {summary['qualityScore']}/100 (Grade: {summary.get('grade', 'N/A')})
- Total Rows: {summary['totalRows']}
- Valid Rows: {summary['validRows']}
- Invalid Rows: {summary['invalidRows']}
- Issues Found: {issues_count}

Top Issues: {results.get('issues', [])[:3]}

Recommendations: {results.get('recommendations', [])[:3]}
"""

# Usage with an agent
llm = ChatOpenAI(model="gpt-4", temperature=0)
tool = DataQualityTool(
    api_token="YOUR_APIFY_TOKEN",
    actor_id="YOUR_ACTOR_ID"
)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a data quality analyst. Use the data quality checker tool to validate datasets."),
    ("human", "{input}")
])

agent = create_openai_functions_agent(llm, [tool], prompt)
agent_executor = AgentExecutor(agent=agent, tools=[tool], verbose=True)

# Run
result = agent_executor.invoke({
    "input": "Check the data quality of https://example.com/sales_data.csv and tell me if it's ready for analytics"
})
```

### In RAG Pipelines

```python
from langchain.chains import LLMChain
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate

def validate_before_embedding(data_url: str, client: ApifyClient) -> dict:
    """Validate data quality before creating embeddings."""

    # Run validation
    run = client.actor("YOUR_ACTOR_ID").call(run_input={
        'dataSourceUrl': data_url,
        'checkDuplicates': True,
        'detectPII': True  # Important for RAG to avoid embedding PII
    })

    results = list(client.dataset(run['defaultDatasetId']).iterate_items())[0]

    # Check for PII
    pii_findings = results.get('piiFindings', {})
    if pii_findings.get('totalFindings', 0) > 0:
        raise ValueError(f"PII detected in data: {pii_findings}")

    # Check quality threshold
    if results['summary']['qualityScore'] < 80:
        raise ValueError("Data quality too low for embedding")

    return {
        'valid': True,
        'score': results['summary']['qualityScore'],
        'rows': results['summary']['validRows']
    }
```

---

## Webhook Integration: Real-time Notifications

### Express.js Webhook Server

```javascript
import express from "express";
import { ApifyClient } from "apify-client";

const app = express();
app.use(express.json());

// Slack notification helper
async function sendSlackAlert(webhookUrl, message) {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
}

app.post("/apify-webhook", async (req, res) => {
  const { eventType, eventData } = req.body;

  if (eventType === "ACTOR.RUN.SUCCEEDED") {
    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    const run = await client.run(eventData.actorRunId).get();
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    const result = items[0];
    const score = result.summary.qualityScore;

    // Send alerts based on score
    if (score < 80) {
      await sendSlackAlert(
        process.env.SLACK_WEBHOOK,
        `⚠️ Data Quality Alert!\nScore: ${score}/100\nIssues: ${result.issues.length}`,
      );
    }
  }

  res.status(200).json({ received: true });
});

app.listen(3000);
```

---

## More Resources

- [API Documentation](./API.md) - Complete API reference
- [Code Examples](./EXAMPLES.md) - Multi-language examples
- [FAQ](./FAQ.md) - Common questions
- [Troubleshooting](./TROUBLESHOOTING.md) - Problem solving
