---
id: docx-creator
name: DOCX Creator
description: Expert in creating, editing, and analyzing Word documents using docx-js and XML manipulation
category: knowledge-work
tools: [word, pdf-reader, markitdown, sequential-thinking]
triggers: [docx, word document, .docx, report, memo, letter, template, tracked changes, comments]
source: Adapted from anthropics/skills (Apache 2.0)
---

# DOCX Creation, Editing, and Analysis

## Overview
A .docx file is a ZIP archive containing XML files.

| Task | Approach |
|------|----------|
| Read/analyze content | `pandoc` or unpack for raw XML |
| Create new document | Use `docx-js` (npm: `docx`) |
| Edit existing document | Unpack → edit XML → repack |

## Quick Reference

### Reading Content
```bash
# Text extraction with tracked changes
pandoc --track-changes=all document.docx -o output.md
```

### Converting to Images
```bash
python scripts/office/soffice.py --headless --convert-to pdf document.docx
pdftoppm -jpeg -r 150 document.pdf page
```

## Creating New Documents with docx-js

### Setup
```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
        Header, Footer, AlignmentType, PageOrientation, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak } = require('docx');

const doc = new Document({ sections: [{ children: [/* content */] }] });
Packer.toBuffer(doc).then(buffer => fs.writeFileSync("doc.docx", buffer));
```

### Page Size (Critical: defaults to A4, not US Letter)
```javascript
sections: [{
  properties: {
    page: {
      size: { width: 12240, height: 15840 }, // US Letter in DXA (1440 DXA = 1 inch)
      margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
    }
  },
  children: [/* content */]
}]
```

### Styles
```javascript
styles: {
  default: { document: { run: { font: "Arial", size: 24 } } }, // 12pt
  paragraphStyles: [
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 32, bold: true, font: "Arial" },
      paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
    { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 28, bold: true, font: "Arial" },
      paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 } },
  ]
}
```

### Lists (NEVER use unicode bullets)
```javascript
numbering: {
  config: [
    { reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
  ]
}
// Usage: new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [...] })
```

### Tables (Critical: need dual widths)
```javascript
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
new Table({
  width: { size: 9360, type: WidthType.DXA }, // Always DXA, never PERCENTAGE
  columnWidths: [4680, 4680], // Must sum to table width
  rows: [new TableRow({
    children: [new TableCell({
      borders: { top: border, bottom: border, left: border, right: border },
      width: { size: 4680, type: WidthType.DXA },
      shading: { fill: "D5E8F0", type: ShadingType.CLEAR }, // CLEAR not SOLID
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun("Cell")] })]
    })]
  })]
})
```

### Images
```javascript
new ImageRun({
  type: "png", // Required: png, jpg, jpeg, gif, bmp, svg
  data: fs.readFileSync("image.png"),
  transformation: { width: 200, height: 150 },
  altText: { title: "Title", description: "Desc", name: "Name" }
})
```

### Headers/Footers with Page Numbers
```javascript
headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun("Header")] })] }) },
footers: { default: new Footer({ children: [new Paragraph({
  children: [new TextRun("Page "), new TextRun({ children: [PageNumber.CURRENT] })]
})] }) }
```

## Critical Rules for docx-js
- **Set page size explicitly** — defaults to A4
- **Never use `\n`** — use separate Paragraph elements
- **Never use unicode bullets** — use `LevelFormat.BULLET`
- **PageBreak must be in Paragraph**
- **ImageRun requires `type` parameter**
- **Always use WidthType.DXA for tables** — PERCENTAGE breaks in Google Docs
- **Tables need dual widths** — both `columnWidths` array AND cell `width`
- **Use ShadingType.CLEAR** — never SOLID for table shading
- **Override built-in styles** with exact IDs: "Heading1", "Heading2"
- **Include outlineLevel** for TOC support (0 for H1, 1 for H2)

## Editing Existing Documents
1. **Unpack**: Extract the ZIP to access XML files
2. **Edit XML**: Modify `word/document.xml` directly
3. **Repack**: Re-ZIP maintaining the same structure

## Dependencies
- `npm install -g docx` — JavaScript DOCX generation
- `pandoc` — Document conversion and text extraction
