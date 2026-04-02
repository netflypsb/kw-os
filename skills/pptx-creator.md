---
id: pptx-creator
name: PPTX Creator
description: Expert in creating, editing, and designing professional PowerPoint presentations programmatically
category: knowledge-work
tools: [powerpoint, chart, sequential-thinking, imagician]
triggers: [pptx, powerpoint, slides, presentation, deck, pitch deck, slide design]
source: Adapted from anthropics/skills (Apache 2.0)
---

# PPTX Creation and Design

## Quick Reference
| Task | Approach |
|------|----------|
| Read content | Unpack ZIP → parse XML, or use python-pptx |
| Create from scratch | python-pptx with custom layouts |
| Edit existing | python-pptx to modify slides |
| Convert to images | LibreOffice headless → PDF → images |

## Reading Content
```python
from pptx import Presentation

prs = Presentation("input.pptx")
for slide in prs.slides:
    for shape in slide.shapes:
        if shape.has_text_frame:
            for paragraph in shape.text_frame.paragraphs:
                print(paragraph.text)
```

## Creating from Scratch
```python
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

prs = Presentation()
prs.slide_width = Inches(13.333)   # Widescreen 16:9
prs.slide_height = Inches(7.5)

# Title slide
slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank layout
title = slide.shapes.add_textbox(Inches(1), Inches(2), Inches(11), Inches(2))
tf = title.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.text = "Presentation Title"
p.font.size = Pt(44)
p.font.bold = True
p.font.color.rgb = RGBColor(0x1A, 0x1A, 0x2E)
p.alignment = PP_ALIGN.CENTER

prs.save("output.pptx")
```

## Design Guidelines

### Color Palettes
```python
# Professional dark theme
DARK_BG = RGBColor(0x1A, 0x1A, 0x2E)
ACCENT = RGBColor(0x00, 0x7A, 0xCC)
TEXT_WHITE = RGBColor(0xFF, 0xFF, 0xFF)
TEXT_GRAY = RGBColor(0xB0, 0xB0, 0xB0)

# Professional light theme
LIGHT_BG = RGBColor(0xFF, 0xFF, 0xFF)
DARK_TEXT = RGBColor(0x33, 0x33, 0x33)
ACCENT_BLUE = RGBColor(0x00, 0x78, 0xD4)
SUBTLE_GRAY = RGBColor(0xF5, 0xF5, 0xF5)
```

### Typography Rules
- **Title slides**: 40-48pt bold
- **Section headers**: 32-36pt bold
- **Body text**: 18-24pt regular
- **Captions/footnotes**: 12-14pt
- Use max 2 font families (e.g., Calibri + Calibri Light)

### Spacing Rules
- Minimum 0.5" margin from all edges
- 1.5x line spacing for body text
- Consistent padding in all text boxes

### Layout Patterns
```python
# Two-column layout
left_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(5.5), Inches(5))
right_box = slide.shapes.add_textbox(Inches(7), Inches(1.5), Inches(5.5), Inches(5))

# Image + text layout
img = slide.shapes.add_picture("chart.png", Inches(0.8), Inches(1.5), Inches(5.5), Inches(5))
text_box = slide.shapes.add_textbox(Inches(7), Inches(1.5), Inches(5.5), Inches(5))
```

### Adding Charts
```python
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE

chart_data = CategoryChartData()
chart_data.categories = ['Q1', 'Q2', 'Q3', 'Q4']
chart_data.add_series('Revenue', (150, 200, 180, 250))

chart = slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED,
    Inches(1), Inches(2), Inches(8), Inches(4.5),
    chart_data
).chart
chart.has_legend = True
```

## Converting to Images
```bash
# LibreOffice headless conversion
libreoffice --headless --convert-to pdf presentation.pptx
pdftoppm -jpeg -r 150 presentation.pdf slide
```

## QA Checklist
- [ ] All text readable (no overflow, no truncation)
- [ ] Consistent fonts and sizes across all slides
- [ ] Color contrast meets accessibility standards
- [ ] No empty slides or placeholder text
- [ ] Charts have labels and legends
- [ ] Slide numbers present (except title slide)
- [ ] File size reasonable (compress images if > 20MB)

## Common Mistakes to Avoid
- Overcrowding slides with too much text
- Using more than 6-8 bullet points per slide
- Inconsistent alignment across slides
- Using too many colors (stick to 3-4 max)
- Forgetting to set widescreen aspect ratio (16:9)
- Not testing on different screen sizes

## Dependencies
- `pip install python-pptx` — Python PPTX manipulation
- `libreoffice` — Headless conversion (optional)
