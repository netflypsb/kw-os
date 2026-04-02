---
id: global-intelligence
name: Global Intelligence
description: Monitor news, geopolitical signals, economic indicators, and market trends using browser automation
category: knowledge-work
tools: [playwright, read-website-fast, fetch, memory, chart]
triggers: [news, trends, geopolitical, market, monitor, intelligence, brief, worldmonitor]
---

# Global Intelligence

## Expertise
- News monitoring and trend analysis
- Geopolitical signal detection
- Economic indicator tracking
- Market sentiment analysis
- Intelligence brief generation
- Source reliability assessment

## Target Sources (all accessed via browser automation, zero APIs)
- **News**: Reuters, AP News, BBC News, Al Jazeera, NPR
- **Finance**: Yahoo Finance, Google Finance, TradingView (free), MarketWatch
- **Economic Data**: Trading Economics (free tables), FRED (public data)
- **Crypto**: CoinCap (via MCP), CoinGecko (free pages)
- **Tech**: Hacker News, TechCrunch, The Verge
- **Geopolitical**: CSIS, Brookings, Council on Foreign Relations (free articles)

## Workflows

### Daily Intelligence Brief
1. Navigate to 3-5 key news sites with playwright
2. Extract top headlines and summaries
3. Search for specific topics with web-search
4. Fetch full articles with read-website-fast
5. Store key findings in memory
6. Analyze patterns with sequentialthinking
7. Generate brief in Word or PowerPoint
8. Save to `reports/intelligence/daily-YYYY-MM-DD/`

### Market Trend Monitor
1. Navigate to Yahoo Finance / TradingView with playwright
2. Extract market data from tables (indices, commodities, forex)
3. Store in Excel for historical tracking
4. Generate trend charts with chart-mcp
5. Identify anomalies with sequentialthinking
6. Write market summary report

### Sector/Region Deep Dive
1. Define scope (sector or region)
2. Search across 5+ sources with web-search
3. Fetch full articles with playwright for paywalled previews
4. Cross-reference findings across sources
5. Build analysis matrix in Excel
6. Generate presentation with key findings

## Data Extraction Patterns

### News Sites
- Use playwright to navigate to homepage
- snapshot to get article links
- Click into articles, extract title + body text
- Store headline + summary + URL + timestamp

### Financial Portals
- Navigate to market overview pages
- Extract data tables using snapshot + text extraction
- Parse numbers from table cells
- Store as CSV or Excel rows

### Economic Dashboards
- Navigate to indicator pages
- Extract current values and historical charts data
- Screenshot charts for visual reference
- Store numeric data in Excel for trending

## Best Practices
- Always include source URLs and access timestamps
- Cross-reference claims across 3+ independent sources
- Distinguish between fact, analysis, and speculation
- Track confidence levels for each finding
- Store all findings in memory for longitudinal analysis
- Respect robots.txt and rate-limit browser requests
