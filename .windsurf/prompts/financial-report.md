---
id: financial-report
name: Monthly Financial Report
description: Generate a monthly financial report from ledger data with charts and presentation
---

# Monthly Financial Report

Generate a comprehensive monthly financial report by following these steps:

1. **Gather Data**: Query hledger for all transactions in the target month. Load any supplementary Excel files.
2. **Summarize**: Calculate total income, total expenses, net profit/loss. Break down by category.
3. **Analyze**: Compare to previous month (MoM) and same month last year (YoY). Calculate key ratios.
4. **Visualize**: Create charts — income vs expenses bar chart, expense breakdown pie chart, trend line chart.
5. **Report**: Generate a PowerPoint presentation with executive summary slide, detailed breakdowns, and charts.
6. **Save**: Save all outputs to `reports/financial/monthly-YYYY-MM/`.

**Parameters**: [month] [year] [ledger file path]
