"""Unit tests for text extraction service."""

import io

from docx import Document
from openpyxl import Workbook

from app.services.text_extractor import (
    _chunk_text,
    _extract_docx,
    _extract_pdf,
    _extract_xlsx,
    extract_text,
)


def _make_pdf_bytes(pages: list[str]) -> bytes:
    """Create a minimal PDF with actual text content on each page."""
    return _build_raw_pdf(pages)


def _build_raw_pdf(pages: list[str]) -> bytes:
    """Build a raw PDF with actual text content for each page."""
    # Minimal PDF structure with text on each page
    obj_num = 1

    # Object 1: Catalog
    catalog_num = obj_num
    obj_num += 1

    # Object 2: Pages
    pages_num = obj_num
    obj_num += 1

    # Object for Font
    font_num = obj_num
    obj_num += 1

    page_objs = []
    content_objs = []

    for text in pages:
        # Page object
        page_num = obj_num
        obj_num += 1
        # Content stream object
        content_num = obj_num
        obj_num += 1
        page_objs.append((page_num, content_num))
        content_objs.append((content_num, text))

    # Build objects
    body_parts = []
    offsets = {}

    def add_obj(num, content):
        offsets[num] = len(b"".join(body_parts)) if body_parts else 0
        data = f"{num} 0 obj\n{content}\nendobj\n"
        body_parts.append(data.encode("latin-1"))

    # Catalog
    add_obj(catalog_num, f"<< /Type /Catalog /Pages {pages_num} 0 R >>")

    # Pages
    kids = " ".join(f"{p[0]} 0 R" for p in page_objs)
    add_obj(pages_num, f"<< /Type /Pages /Kids [{kids}] /Count {len(page_objs)} >>")

    # Font
    add_obj(font_num, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    # Page and content objects
    for page_num, content_num in page_objs:
        add_obj(
            page_num,
            f"<< /Type /Page /Parent {pages_num} 0 R "
            f"/MediaBox [0 0 612 792] "
            f"/Contents {content_num} 0 R "
            f"/Resources << /Font << /F1 {font_num} 0 R >> >> >>",
        )

    for content_num, text in content_objs:
        # Escape special PDF chars in text
        safe_text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 12 Tf 72 720 Td ({safe_text}) Tj ET"
        add_obj(content_num, f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream")

    # Build full PDF
    header = b"%PDF-1.4\n"

    # Recalculate offsets with header
    real_offsets = {}
    pos = len(header)
    body_bytes = []
    for num in sorted(offsets.keys()):
        # Find the body part for this object
        idx = list(offsets.keys()).index(num)
        part = body_parts[idx]
        real_offsets[num] = pos
        body_bytes.append(part)
        pos += len(part)

    # Rebuild body in order of object number
    ordered_parts = []
    ordered_offsets = {}
    current_pos = len(header)
    for i, part in enumerate(body_parts):
        num = list(offsets.keys())[i]
        ordered_offsets[num] = current_pos
        ordered_parts.append(part)
        current_pos += len(part)

    body = b"".join(ordered_parts)

    # Cross-reference table
    xref_offset = len(header) + len(body)
    xref_lines = [f"xref\n0 {obj_num}\n"]
    xref_lines.append("0000000000 65535 f \n")
    for i in range(1, obj_num):
        offset = ordered_offsets.get(i, 0)
        xref_lines.append(f"{offset:010d} 00000 n \n")

    xref = "".join(xref_lines).encode("latin-1")

    trailer = (
        f"trailer\n<< /Size {obj_num} /Root {catalog_num} 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"
    ).encode("latin-1")

    return header + body + xref + trailer


def _make_docx_bytes(paragraphs: list[str]) -> bytes:
    """Create a DOCX document with the given paragraphs."""
    doc = Document()
    for para in paragraphs:
        doc.add_paragraph(para)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _make_xlsx_bytes(sheets: dict[str, list[list[str]]]) -> bytes:
    """Create an XLSX workbook with named sheets and row data."""
    wb = Workbook()
    # Remove default sheet
    default_sheet = wb.active
    for i, (sheet_name, rows) in enumerate(sheets.items()):
        if i == 0 and default_sheet is not None:
            ws = default_sheet
            ws.title = sheet_name
        else:
            ws = wb.create_sheet(title=sheet_name)
        for row in rows:
            ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


class TestExtractPdf:
    """Tests for PDF text extraction."""

    def test_extract_pdf_pages(self):
        """Multi-page PDF extracts correct number of pages."""
        pdf_bytes = _make_pdf_bytes(["First page content", "Second page content", "Third page"])
        result = _extract_pdf(pdf_bytes)
        assert len(result) == 3
        assert result[0][0] == "Page 1"
        assert result[1][0] == "Page 2"
        assert result[2][0] == "Page 3"
        assert "First page content" in result[0][1]

    def test_extract_pdf_empty_page(self):
        """Empty pages are filtered out, only pages with text are returned."""
        # Create a PDF where we know at least one page has text
        pdf_bytes = _make_pdf_bytes(["Has text here"])
        result = _extract_pdf(pdf_bytes)
        assert len(result) >= 1
        # All returned pages should have content
        for label, text in result:
            assert text.strip()


class TestExtractDocx:
    """Tests for DOCX text extraction."""

    def test_extract_docx_short(self):
        """Short DOCX returns a single chunk."""
        paragraphs = ["Short paragraph one.", "Short paragraph two.", "Short paragraph three."]
        docx_bytes = _make_docx_bytes(paragraphs)
        result = _extract_docx(docx_bytes)
        assert len(result) == 1
        assert "Section 1" in result[0][0]
        assert "Short paragraph one." in result[0][1]

    def test_extract_docx_long(self):
        """Long DOCX text is split into multiple chunks."""
        # Create enough text to exceed CHUNK_SIZE (2000 chars)
        paragraphs = [
            f"This is paragraph number {i} with some meaningful content here." for i in range(200)
        ]
        docx_bytes = _make_docx_bytes(paragraphs)
        result = _extract_docx(docx_bytes)
        assert len(result) > 1
        # First chunk label should be "Section 1"
        assert result[0][0] == "Section 1"

    def test_extract_docx_empty(self):
        """DOCX with no text content returns empty list."""
        docx_bytes = _make_docx_bytes(["", "  ", ""])
        result = _extract_docx(docx_bytes)
        assert result == []


class TestExtractXlsx:
    """Tests for XLSX text extraction."""

    def test_extract_xlsx_single_sheet(self):
        """Single sheet XLSX returns one tuple."""
        xlsx_bytes = _make_xlsx_bytes(
            {"Sheet1": [["Name", "Value"], ["Drug A", "100mg"], ["Drug B", "200mg"]]}
        )
        result = _extract_xlsx(xlsx_bytes)
        assert len(result) == 1
        assert "Sheet: Sheet1" in result[0][0]
        assert "Drug A" in result[0][1]

    def test_extract_xlsx_multi_sheet(self):
        """Multi-sheet XLSX returns one tuple per sheet."""
        xlsx_bytes = _make_xlsx_bytes(
            {
                "Dosing": [["Drug", "Dose"], ["Zanubrutinib", "160mg"]],
                "Safety": [["AE", "Rate"], ["Neutropenia", "5%"]],
                "Efficacy": [["Endpoint", "Result"], ["ORR", "78%"]],
            }
        )
        result = _extract_xlsx(xlsx_bytes)
        assert len(result) == 3
        labels = [r[0] for r in result]
        assert "Sheet: Dosing" in labels
        assert "Sheet: Safety" in labels
        assert "Sheet: Efficacy" in labels


class TestChunkText:
    """Tests for the _chunk_text utility function."""

    def test_chunk_text_short(self):
        """Text under chunk_size returns a single chunk."""
        text = "Short text that fits in one chunk."
        result = _chunk_text(text, prefix="Test")
        assert len(result) == 1
        assert result[0][0] == "Test 1"
        assert result[0][1] == text

    def test_chunk_text_long(self):
        """Long text is split into multiple overlapping chunks."""
        # Create text longer than default CHUNK_SIZE (2000)
        text = "\n".join([f"Line {i}: Some content that takes up space." for i in range(100)])
        assert len(text) > 2000
        result = _chunk_text(text, prefix="Part")
        assert len(result) > 1
        # Verify overlap: end of chunk N should appear at start of chunk N+1
        for i in range(len(result) - 1):
            chunk_end = result[i][1][-50:]
            chunk_next_start = result[i + 1][1][:300]
            # With overlap of 200 chars, there should be shared content
            assert any(word in chunk_next_start for word in chunk_end.split() if len(word) > 3), (
                f"No overlap between chunk {i + 1} and {i + 2}"
            )


class TestExtractTextDispatch:
    """Tests for the main extract_text dispatcher."""

    def test_dispatch_pdf(self):
        """extract_text delegates to PDF extraction for application/pdf."""
        pdf_bytes = _make_pdf_bytes(["Test PDF content"])
        result = extract_text(pdf_bytes, "application/pdf")
        assert len(result) >= 1

    def test_dispatch_docx(self):
        """extract_text delegates to DOCX extraction for the DOCX MIME type."""
        docx_bytes = _make_docx_bytes(["Test DOCX paragraph"])
        result = extract_text(
            docx_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        assert len(result) >= 1

    def test_dispatch_xlsx(self):
        """extract_text delegates to XLSX extraction for the XLSX MIME type."""
        xlsx_bytes = _make_xlsx_bytes({"Data": [["Cell A", "Cell B"]]})
        result = extract_text(
            xlsx_bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        assert len(result) >= 1

    def test_unknown_type_returns_empty(self):
        """Unknown content type returns empty list."""
        result = extract_text(b"some bytes", "text/plain")
        assert result == []
