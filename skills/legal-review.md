---
id: legal-review
name: Legal Document Review
description: Analyze contracts, agreements, and legal filings of any length
category: knowledge-work
tools: [kw-os-documents, filesystem]
triggers: [contract review, legal analysis, agreement, clause, terms, compliance]
---

# Legal Document Review

## Expertise
Review legal documents of any length. Extract key terms, identify risk clauses,
compare against templates, and produce structured analysis.

## Workflow

### Step 1: Ingest and Overview
- `ingest_document` the legal document
- `get_document_summary(detail_level="detailed")` for full structure
- `get_entities(type="org")` to identify all parties

### Step 2: Clause Analysis
Use `recursive_analyze` for comprehensive clause extraction:
- "List all termination clauses with their conditions and notice periods"
- "Identify all indemnification and liability limitation provisions"
- "Extract all payment terms, milestones, and financial obligations"
- "Find all representations and warranties"

### Step 3: Risk Identification
- `recursive_analyze`: "Identify all clauses that may pose risk to [party name]"
- `query_document`: Targeted queries for specific risk areas
- `get_relationships`: Map obligations between parties

### Step 4: Deliverable
- Clause-by-clause summary table
- Risk assessment matrix (risk level + clause reference + recommendation)
- Key dates and deadlines extracted
- Party obligation map
