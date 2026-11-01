"""Build a Word-ready Chapter 7 DOCX from the verified Markdown and figures."""
import pathlib
import re
import sys

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'results/chapter7/08-report/CHUONG_7_KET_QUA_SAN_SANG_CHEN.md'
TARGET=SOURCE.with_suffix('.docx')
lines=SOURCE.read_text(encoding='utf-8').splitlines()
doc=Document()
section=doc.sections[0]
section.page_height=Cm(29.7)
section.page_width=Cm(21)
section.top_margin=Cm(2.0)
section.bottom_margin=Cm(2.0)
section.left_margin=Cm(2.5)
section.right_margin=Cm(2.5)

for name,size,bold in [('Normal',13,False),('Title',15,True),('Heading 1',14,True),('Heading 2',13,True),('Heading 3',13,True)]:
    style=doc.styles[name]
    style.font.name='Times New Roman'
    style.font.size=Pt(size)
    style.font.bold=bold
    style.font.color.rgb=RGBColor(0,0,0)
    style.paragraph_format.line_spacing=1.5
    style.paragraph_format.space_after=Pt(3)

# The built-in Word Title style carries a blue bottom rule in some themes.
title_ppr=doc.styles['Title']._element.get_or_add_pPr()
for border in title_ppr.findall(qn('w:pBdr')):
    title_ppr.remove(border)


def plain(text):
    return text.replace('`','').replace('**','')


caption_seen={'Bảng':0,'Hình':0}
def add_caption(text):
    p=doc.add_paragraph()
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    match=re.match(r'^(Bảng|Hình) 7\.(\d+)([a-z]?)\.(.*)$',plain(text))
    if not match:
        p.add_run(plain(text)).italic=True
        return
    kind,number,letter,rest=match.groups()
    prefix=p.add_run(kind+' 7.')
    prefix.italic=True
    if letter:
        r=p.add_run(number+letter)
        r.italic=True
    else:
        caption_seen[kind]+=1
        begin=OxmlElement('w:fldChar'); begin.set(qn('w:fldCharType'),'begin')
        instr=OxmlElement('w:instrText'); instr.set(qn('xml:space'),'preserve')
        instr.text=' SEQ '+('Bang' if kind=='Bảng' else 'Hinh')+(' \\r 1 ' if caption_seen[kind]==1 else ' ')
        separate=OxmlElement('w:fldChar'); separate.set(qn('w:fldCharType'),'separate')
        value=OxmlElement('w:t'); value.text=number
        end=OxmlElement('w:fldChar'); end.set(qn('w:fldCharType'),'end')
        for elem in (begin,instr,separate,value,end):
            r=p.add_run(); r.italic=True; r._r.append(elem)
    r=p.add_run('.'+rest)
    r.italic=True
    for run in p.runs: run.font.size=Pt(11)


def borders(table):
    tblPr=table._tbl.tblPr
    b=OxmlElement('w:tblBorders')
    for edge in ('top','left','bottom','right','insideH','insideV'):
        elem=OxmlElement('w:'+edge)
        elem.set(qn('w:val'),'single')
        elem.set(qn('w:sz'),'4')
        elem.set(qn('w:color'),'000000')
        b.append(elem)
    tblPr.append(b)


def add_table(rows):
    if not rows: return
    columns=len(rows[0])
    # Split very wide result tables into linked parts for readable portrait pages.
    parts=[list(range(columns))] if columns<=9 else [list(range(min(7,columns))),[0]+list(range(7,columns))]
    for part_index,part in enumerate(parts):
        if len(parts)>1:
            p=doc.add_paragraph('Phần '+str(part_index+1)+' của bảng',style='Normal')
            p.runs[0].italic=True
            p.paragraph_format.space_before=Pt(5)
        table=doc.add_table(rows=0,cols=len(part))
        table.autofit=True
        for i,row in enumerate(rows):
            cells=table.add_row().cells
            for j,k in enumerate(part):
                cells[j].vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
                p=cells[j].paragraphs[0]
                p.paragraph_format.line_spacing=1.05
                p.paragraph_format.space_after=Pt(1)
                p.alignment=WD_ALIGN_PARAGRAPH.CENTER if j else WD_ALIGN_PARAGRAPH.LEFT
                run=p.add_run(plain(row[k]))
                run.font.name='Times New Roman'
                run.font.size=Pt(9 if len(part)>7 else 10)
                run.font.bold=i==0
            if i==0:
                trPr=table.rows[0]._tr.get_or_add_trPr()
                trPr.append(OxmlElement('w:tblHeader'))
            trPr=table.rows[i]._tr.get_or_add_trPr()
            trPr.append(OxmlElement('w:cantSplit'))
            if i==len(rows)-1 and part_index==len(parts)-1:
                p.paragraph_format.keep_with_next=True
        borders(table)


i=0
while i<len(lines):
    line=lines[i].strip()
    if not line:
        i+=1
        continue
    if line.startswith('*Hình 7.3c.'):
        i+=1
        continue
    if line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            cells=[x.strip() for x in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r':?-{3,}:?',x) for x in cells): rows.append(cells)
            i+=1
        add_table(rows)
        continue
    if line.startswith('!['):
        match=re.match(r'!\[[^]]*\]\(([^)]+)\)',line)
        if match:
            image=(SOURCE.parent/match.group(1)).resolve()
            if image.name=='Grafana_Dashboard_K6_Large.png':
                i+=1
                if i<len(lines) and lines[i].startswith('*Hình 7.3c.'): i+=1
                continue
            if image.exists():
                p=doc.add_paragraph()
                p.alignment=WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.keep_with_next=True
                p.add_run().add_picture(str(image),width=Cm(14.7))
        i+=1
        continue
    if line.startswith('# '):
        doc.add_paragraph(plain(line[2:]),style='Title')
    elif line.startswith('## '):
        doc.add_paragraph(plain(line[3:]),style='Heading 1')
    elif line.startswith('### '):
        doc.add_paragraph(plain(line[4:]),style='Heading 2')
    elif line.startswith('*') and line.endswith('*'):
        add_caption(line.strip('*'))
    else:
        p=doc.add_paragraph(plain(line),style='Normal')
        p.alignment=WD_ALIGN_PARAGRAPH.LEFT
    i+=1

doc.core_properties.title='Chương 7 Thiết lập thực nghiệm CodeJudge'
doc.save(TARGET)
print(TARGET)
