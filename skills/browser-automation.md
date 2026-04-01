---
id: browser-automation
name: Browser Automation
description: Web scraping, form filling, site monitoring, and data extraction using Playwright MCP and agent-browser
category: automation
tools: [playwright, fetch, read-website-fast, memory]
triggers: [scrape, browse, website, form, login, extract, automate, web]
---

# Browser Automation

## Tools Available

### Playwright MCP (MCP Server — 35+ tools)
Full browser automation via MCP protocol. Best for long-running, stateful tasks.

Key tools:
- `browser_navigate` — Go to URL
- `browser_click` — Click element by ref or text
- `browser_fill` — Type into input by ref
- `browser_snapshot` — Get accessibility tree with interactive refs
- `browser_screenshot` — Take screenshot
- `browser_pdf_save` — Save page as PDF
- `browser_tab_list` / `browser_tab_new` / `browser_tab_select` — Tab management
- `browser_console_messages` — Read JS console
- `browser_network_requests` — Monitor network traffic

### agent-browser CLI (Terminal Command — Rust, fast)
Token-efficient browser automation via terminal. Best for quick tasks.

Core workflow:
1. `agent-browser open <url>` — Navigate to page
2. `agent-browser snapshot -i` — Get interactive elements with refs (@e1, @e2...)
3. `agent-browser click @e1` — Click element by ref
4. `agent-browser fill @e2 "text"` — Type into input
5. `agent-browser snapshot` — Re-snapshot after changes

## Workflows

### Data Extraction from Website
1. Navigate to target URL with playwright
2. Take snapshot to identify page structure
3. Extract text content from relevant sections
4. Handle pagination (click "next" + re-snapshot)
5. Compile extracted data into CSV or Excel

### Form Automation
1. Navigate to form page
2. Snapshot to get form field refs
3. Fill each field using refs
4. Click submit
5. Verify result page

### Multi-Page Research
1. Search on target site
2. Extract result links from snapshot
3. Visit each result page
4. Extract key content
5. Store in memory
6. Move to next result

### Site Monitoring
1. Navigate to page with playwright
2. Take snapshot of current state
3. Extract key metrics/text
4. Compare with previous values (from memory)
5. Alert if significant changes detected

## Best Practices
- Always snapshot before interacting (to get current refs)
- Re-snapshot after any page change (navigation, click, form submit)
- Use playwright for complex multi-step flows
- Use agent-browser for quick single-page extractions
- Respect robots.txt and site terms of service
- Add delays between requests to avoid rate limiting
- Use read-website-fast for simple article extraction (more token-efficient)
- Store intermediate results in memory for multi-session work
- No API keys needed — both tools use local Chrome
