---
"@craftlions/pdfium-rs": patch
---

Fix pdfToPng failing with PdfiumLibraryBindingsAlreadyInitialized on every call after the first. PDFium is now bound once per process and shared.
