---
id: research-deep-dive
name: Research Deep Dive
description: Multi-document research synthesis using document intelligence
category: knowledge-work
tools: [kw-os-documents, web-search, read-fast, filesystem, memory]
triggers: [research, literature review, multi-source analysis, deep dive, synthesis]
---

# Research Deep Dive

## Expertise
Conduct comprehensive research by combining web sources with document analysis.
Can process research paper collections, reports, and large reference documents.

## Workflow

### Phase 1: Gather Sources
1. Search web for relevant sources using `web-search`
2. Download key documents (PDFs, reports) using browser automation
3. Collect all reference documents provided by user

### Phase 2: Build Knowledge Base
1. Ingest ALL gathered documents using `ingest_document`
2. Review entities across all documents: `get_entities`
3. Map relationships: `get_relationships` for key entities
4. Identify themes: `search_documents` with thematic queries

### Phase 3: Deep Analysis
1. For each key document, use `recursive_analyze` for comprehensive understanding
2. Cross-reference findings: `search_documents` across all docs
3. Identify contradictions, gaps, and consensus
4. Build timeline if temporal data exists

### Phase 4: Synthesis
1. Compile findings into structured report
2. Use `get_relationships` to create network diagrams of key connections
3. Generate charts for quantitative findings (via chart MCP)
4. Create final deliverable (Word doc, PowerPoint, or Markdown)

## Output Formats
- Executive summary (1-2 pages)
- Detailed research report (section per theme)
- Entity relationship map
- Source citation index
