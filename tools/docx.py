"""
Minimal stub for `docx` so that static analysis (Pylance) can resolve
`from docx import Document` in the repository tools during development.

This file is intentionally tiny and should NOT be used as a replacement for
the real `python-docx` package at runtime. Install `python-docx` in the
Python environment if you need to actually parse .docx files.
"""

from typing import Any


class Document:  # pragma: no cover - dev-only shim
    """A tiny shim Document class exposing the minimal API used in tools.

    Methods in the real python-docx return objects with attributes and
    methods. This stub provides a very small compatible surface so linter
    and type checkers stop complaining. It's not functional for real
    document parsing.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        # store path if provided so tools can introspect in dev, but don't
        # attempt to open files.
        self.path = args[0] if args else None

    def paragraphs(self):
        return []

    def __repr__(self) -> str:  # pragma: no cover
        return f"<docx.Document stub path={self.path!r}>"
"""
A minimal stub to satisfy `from docx import Document` in `tools/extract_docx.py`
This avoids a Pylance missing-import diagnostic in environments where python-docx isn't installed.
This file is intentionally tiny and only used for static analysis; it does not implement full docx parsing.
"""

class Paragraph:
    def __init__(self, text, style_name=""):
        self.text = text
        self.style = type('S', (), {'name': style_name})()

class Document:
    def __init__(self, path=None):
        # Not implementing actual parsing here.
        self.paragraphs = []
        # If a path is provided, leave paragraphs empty; the real tool should install python-docx.

    def add_paragraph(self, text, style=None):
        p = Paragraph(text, style or '')
        self.paragraphs.append(p)
        return p
