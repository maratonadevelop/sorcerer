from docx import Document
import json
import sys
from pathlib import Path

DOCX_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('uploads/Codex_Return_of_the_First_Sorcerer.docx')
OUT_PATH = Path('outputs/codex_structure.json')

if not DOCX_PATH.exists():
    print('Docx file not found:', DOCX_PATH)
    sys.exit(1)

print('Reading', DOCX_PATH)

doc = Document(DOCX_PATH)

structure = []
current = {'heading': None, 'level': 0, 'content': []}

for para in doc.paragraphs:
    style = para.style.name if para.style else ''
    text = para.text.strip()
    if not text:
        continue
    # Heuristic: Word heading styles often contain 'Heading' or 'Title'
    if 'Heading' in style or 'Title' in style:
        if current['heading'] or current['content']:
            structure.append(current)
        # extract level if like 'Heading 1'
        level = 1
        try:
            if 'Heading' in style:
                parts = style.split()
                if len(parts) > 1 and parts[1].isdigit():
                    level = int(parts[1])
        except Exception:
            level = 1
        current = {'heading': text, 'level': level, 'content': []}
    else:
        # append paragraph text
        current['content'].append(text)

if current['heading'] or current['content']:
    structure.append(current)

OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(structure, f, ensure_ascii=False, indent=2)

print('Wrote', OUT_PATH)
