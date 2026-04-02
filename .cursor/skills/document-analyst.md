---
id: document-analyst
name: Document Analyst
description: Analyze documents of any size using ingestion, RAG, and recursive analysis
category: knowledge-work
tools: [kw-os-documents, filesystem]
triggers: [analyze document, read PDF, review contract, study report, large document]
---

# Document Analyst

## When to Use
Use this skill when the user provides a document (PDF, DOCX, XLSX, etc.) for analysis,
especially when the document is large (>20 pages) or requires deep understanding.

## Workflow

### Step 1: Ingest the Document
Always ingest the document first using `ingest_document`:
- This creates searchable chunks, embeddings, and a knowledge graph
- Only needs to be done once per document; check `list_documents` first

### Step 2: Understand the Document
Get an overview before diving into details:
- Use `get_document_stats` to see size, structure, entity counts
- Use `get_document_summary` with detail_level "standard" for a section-by-section overview
- Use `get_entities` to see key people, organizations, concepts

### Step 3: Answer Questions
Choose the right tool based on the question type:

| Question Type | Tool | Example |
|---|---|---|
| Find specific information | `query_document` | "What is the termination clause?" |
| Broad analysis | `recursive_analyze` | "Summarize all financial risks" |
| Cross-document | `search_documents` | "Compare pricing across all proposals" |
| Relationship mapping | `get_relationships` | "Who are all parties related to Company X?" |

### Step 4: Present Findings
- Cite specific sections/pages from source chunks
- Include relevant entities and relationships
- Use charts/tables for structured data (via chart MCP)
- Save analysis to a report (via python-docx or powerpoint MCP)

## Best Practices
- Always ingest before querying — never try to read a 200-page PDF directly
- Use `query_document` for factual retrieval (faster, cheaper)
- Use `recursive_analyze` for analytical questions requiring full-document understanding
- For multi-document analysis, ingest all documents then use `search_documents`
- Check `list_documents` before ingesting to avoid duplicates
