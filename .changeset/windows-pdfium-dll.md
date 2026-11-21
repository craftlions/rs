---
"@craftlions/pdfium-rs": patch
---

Fix the Windows package (`@craftlions/pdfium-rs-win32-x64-msvc`), which shipped `pdfium.lib` instead of `pdfium.dll`, so PDFium could not be loaded at runtime.
