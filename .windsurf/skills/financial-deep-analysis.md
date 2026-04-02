---
id: financial-deep-analysis
name: Financial Deep Analysis
description: Analyze financial documents at scale — annual reports, 10-K filings, earning calls
category: knowledge-work
tools: [kw-os-documents, hledger, excel, chart, filesystem]
triggers: [financial analysis, annual report, 10-K, earnings, financial statements]
---

# Financial Deep Analysis

## Expertise
Analyze financial documents that exceed context limits: annual reports (100+ pages),
10-K filings (200+ pages), multi-year financial data.

## Workflow

### Step 1: Ingest Financial Documents
- `ingest_document` for each financial document
- Multiple years can be ingested for trend analysis

### Step 2: Extract Key Financial Data
- `recursive_analyze`: "Extract all financial figures including revenue, net income,
  EBITDA, total assets, total liabilities, and cash flow for all reported periods"
- `get_entities(type="money")`: Find all monetary amounts
- `query_document`: Targeted queries for specific line items

### Step 3: Build Financial Model
- Export extracted figures to Excel (via openpyxl MCP)
- Calculate ratios: current ratio, debt-to-equity, ROE, ROA, margins
- Create trend charts (via chart MCP)

### Step 4: Risk & Opportunity Analysis
- `recursive_analyze`: "What are the key risk factors and how have they changed?"
- `search_documents`: Compare risk factors across years/companies
- `get_relationships`: Map relationships between entities (subsidiaries, partners, regulators)

### Step 5: Generate Report
- Financial summary with key metrics table
- Trend charts for revenue, margins, growth
- Risk factor analysis
- Entity relationship diagram
- Save as PowerPoint or Word document
