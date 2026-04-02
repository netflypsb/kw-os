---
id: xlsx-creator
name: XLSX Creator
description: Expert in creating, editing, and analyzing Excel spreadsheets with formulas, charts, formatting, and financial models
category: knowledge-work
tools: [excel, chart, data-exploration, sequential-thinking]
triggers: [xlsx, excel, spreadsheet, .xlsx, pivot table, formula, financial model, budget, workbook]
source: Adapted from anthropics/skills (Apache 2.0)
---

# XLSX Creation, Editing, and Analysis

## Overview
Excel files (.xlsx) are the standard for business data, financial models, and reporting.

## Important Requirements
- **Always use formulas, not hardcoded values** for calculated cells
- **Professional font**: Calibri 11pt default
- **Zero formula errors**: verify all formulas resolve correctly
- **Preserve templates**: when editing existing files, keep formatting intact

## Reading and Analyzing Data

### With pandas
```python
import pandas as pd

df = pd.read_excel("data.xlsx", sheet_name="Sheet1")
print(df.describe())  # Summary statistics
print(df.head(20))    # First 20 rows
```

### With openpyxl
```python
from openpyxl import load_workbook

wb = load_workbook("data.xlsx", data_only=True)  # data_only=True reads cached values
ws = wb.active
for row in ws.iter_rows(min_row=1, max_row=5, values_only=True):
    print(row)
```

## CRITICAL: Use Formulas, Not Hardcoded Values

### Wrong — Hardcoding
```python
# ❌ NEVER do this
ws["C2"] = 150000  # Hardcoded sum
```

### Correct — Using Formulas
```python
# ✅ Always use Excel formulas
ws["C2"] = "=SUM(C3:C10)"
ws["D2"] = "=C2/B2"       # Ratio formula
ws["E2"] = '=IF(D2>0.1,"Above Target","Below Target")'
```

## Creating New Excel Files

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, numbers

wb = Workbook()
ws = wb.active
ws.title = "Financial Summary"

# Headers
headers = ["Category", "Q1", "Q2", "Q3", "Q4", "Total"]
header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
header_fill = PatternFill(start_color="2E75B6", end_color="2E75B6", fill_type="solid")

for col, header in enumerate(headers, 1):
    cell = ws.cell(row=1, column=col, value=header)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal="center")

# Data rows
data = [
    ["Revenue", 100000, 120000, 115000, 140000],
    ["COGS", 60000, 72000, 69000, 84000],
]

for row_idx, row_data in enumerate(data, 2):
    for col_idx, value in enumerate(row_data, 1):
        ws.cell(row=row_idx, column=col_idx, value=value)
    # Total formula
    ws.cell(row=row_idx, column=6, value=f"=SUM(B{row_idx}:E{row_idx})")

# Number formatting
for row in ws.iter_rows(min_row=2, min_col=2, max_col=6):
    for cell in row:
        cell.number_format = '#,##0'

# Column widths
ws.column_dimensions["A"].width = 20
for col in "BCDEF":
    ws.column_dimensions[col].width = 15

wb.save("financial_summary.xlsx")
```

## Financial Model Color Coding Standards

| Color | Use | Hex |
|-------|-----|-----|
| Blue font | Input/assumption cells | `0000FF` |
| Black font | Formula/calculated cells | `000000` |
| Green font | Links to other sheets | `008000` |
| Light yellow fill | Input cells | `FFFFCC` |
| Light gray fill | Calculated cells | `F2F2F2` |

```python
INPUT_FONT = Font(name="Calibri", size=11, color="0000FF")
INPUT_FILL = PatternFill(start_color="FFFFCC", end_color="FFFFCC", fill_type="solid")
CALC_FONT = Font(name="Calibri", size=11, color="000000")
CALC_FILL = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
```

## Number Formatting Standards
```python
cell.number_format = '#,##0'           # Integers: 1,234
cell.number_format = '#,##0.00'        # Decimals: 1,234.56
cell.number_format = '$#,##0'          # Currency: $1,234
cell.number_format = '0.0%'            # Percentage: 12.5%
cell.number_format = 'yyyy-mm-dd'      # Date: 2025-01-15
cell.number_format = '#,##0;(#,##0)'   # Accounting: negatives in parentheses
```

## Editing Existing Files
```python
from openpyxl import load_workbook

wb = load_workbook("existing.xlsx")
ws = wb["Sheet1"]

# Modify specific cells
ws["B5"] = "=SUM(B2:B4)"

# Add new sheet
ws_new = wb.create_sheet("Analysis")
ws_new["A1"] = "Summary"

wb.save("existing_modified.xlsx")
```

## Formula Verification Checklist
- [ ] All SUM ranges include correct cells
- [ ] No circular references
- [ ] Division formulas handle zero denominators: `=IF(B2=0,0,A2/B2)`
- [ ] VLOOKUP/INDEX-MATCH reference correct ranges
- [ ] Percentage formulas produce decimal values (not already multiplied)
- [ ] Date formulas use proper date serial numbers

## Best Practices
- **openpyxl** for formatting-heavy work (charts, styles, merged cells)
- **pandas** for data analysis and transformation
- **xlsxwriter** for write-only high-performance output
- Always freeze header row: `ws.freeze_panes = "A2"`
- Add auto-filter: `ws.auto_filter.ref = ws.dimensions`
- Print setup: `ws.print_title_rows = "1:1"` for repeated headers

## Dependencies
- `pip install openpyxl` — Read/write .xlsx with full formatting
- `pip install pandas openpyxl` — Data analysis (openpyxl as engine)
- `pip install xlsxwriter` — Write-only, high-performance alternative
