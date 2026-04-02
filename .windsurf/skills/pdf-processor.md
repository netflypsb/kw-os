---
id: pdf-processor
name: PDF Processor
description: Expert in PDF text extraction, manipulation, creation, and conversion using Python libraries and CLI tools
category: knowledge-work
tools: [pdf-reader, markitdown, sequential-thinking]
triggers: [pdf, .pdf, extract text, pdf to text, watermark, merge pdf, split pdf, password protect]
source: Adapted from anthropics/skills (Apache 2.0)
---

# PDF Processing Guide

## Overview
PDF processing covers reading, creating, merging, splitting, and converting PDF files.

## Quick Start
| Task | Tool | Install |
|------|------|---------|
| Extract text | `pypdf` or `pdfplumber` | `pip install pypdf pdfplumber` |
| Create PDFs | `reportlab` | `pip install reportlab` |
| CLI text extraction | `pdftotext` | `apt install poppler-utils` / `brew install poppler` |
| Merge/split | `qpdf` | `apt install qpdf` / `brew install qpdf` |

## Python Libraries

### pypdf — Basic Operations
```python
from pypdf import PdfReader, PdfWriter

# Read text
reader = PdfReader("input.pdf")
for page in reader.pages:
    print(page.extract_text())

# Merge PDFs
writer = PdfWriter()
for pdf in ["file1.pdf", "file2.pdf"]:
    writer.append(pdf)
writer.write("merged.pdf")

# Split pages
writer = PdfWriter()
writer.add_page(reader.pages[0])  # First page only
writer.write("page1.pdf")

# Add password
writer = PdfWriter(clone_from="input.pdf")
writer.encrypt("userpassword", "ownerpassword")
writer.write("protected.pdf")
```

### pdfplumber — Text and Table Extraction
```python
import pdfplumber

with pdfplumber.open("input.pdf") as pdf:
    for page in pdf.pages:
        # Text extraction
        text = page.extract_text()
        
        # Table extraction (returns list of lists)
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                print(row)
```

### reportlab — Create PDFs
```python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("output.pdf", pagesize=letter)
width, height = letter

c.setFont("Helvetica", 12)
c.drawString(72, height - 72, "Hello, World!")
c.showPage()
c.save()
```

## Command-Line Tools

### pdftotext (poppler-utils)
```bash
pdftotext input.pdf output.txt        # Extract text
pdftotext -layout input.pdf output.txt # Preserve layout
pdftotext -f 1 -l 5 input.pdf -       # Pages 1-5 to stdout
```

### qpdf
```bash
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf  # Merge
qpdf input.pdf --pages . 1-5 -- output.pdf              # Extract pages
qpdf --decrypt protected.pdf decrypted.pdf               # Remove password
```

## Common Tasks

### Extract Text from Scanned PDFs (OCR)
```bash
pip install pytesseract pdf2image
```
```python
from pdf2image import convert_from_path
import pytesseract

images = convert_from_path("scanned.pdf")
for img in images:
    text = pytesseract.image_to_string(img)
    print(text)
```

### Add Watermark
```python
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io

# Create watermark
packet = io.BytesIO()
c = canvas.Canvas(packet, pagesize=letter)
c.setFont("Helvetica", 60)
c.setFillAlpha(0.3)
c.translate(300, 400)
c.rotate(45)
c.drawCentredString(0, 0, "CONFIDENTIAL")
c.save()
packet.seek(0)

watermark = PdfReader(packet).pages[0]
reader = PdfReader("input.pdf")
writer = PdfWriter()
for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)
writer.write("watermarked.pdf")
```

## Best Practices
- Always check if PDF is encrypted before processing
- Use `pdfplumber` for table extraction, `pypdf` for everything else
- For large PDFs, process page by page to manage memory
- Verify output PDFs open correctly after manipulation
